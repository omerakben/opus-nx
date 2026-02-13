#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# docker-start.sh — Start Opus Nx with local Docker database
#
# One-command setup for contributors who want a fully local stack.
# Only requires: Docker, Node.js 22+, pnpm, and an Anthropic API key.
#
# Usage:
#   ./scripts/docker-start.sh              # Start DB + dev servers
#   ./scripts/docker-start.sh --db-only    # Start only the database
#   ./scripts/docker-start.sh --reset      # Wipe DB and start fresh
#   ./scripts/docker-start.sh --stop       # Stop everything
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.local.yml"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

# ── Parse flags ─────────────────────────────────────────────
DB_ONLY=false
RESET=false
STOP=false

for arg in "$@"; do
  case "$arg" in
    --db-only)  DB_ONLY=true ;;
    --reset)    RESET=true ;;
    --stop)     STOP=true ;;
    --help|-h)
      echo "Usage: ./scripts/docker-start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --db-only    Start only the local database (no dev servers)"
      echo "  --stop       Stop everything (dev servers + Docker database)"
      echo "  --reset      Wipe database volume and start fresh"
      echo "  -h, --help   Show this help"
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ── Banner ──────────────────────────────────────────────────
echo -e ""
echo -e "${BOLD}${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║    Opus Nx — Local Docker Setup           ║${NC}"
echo -e "${BOLD}${CYAN}  ║                                           ║${NC}"
echo -e "${BOLD}${CYAN}  ║  ${DIM}PostgreSQL + pgvector + PostgREST${NC}${BOLD}${CYAN}        ║${NC}"
echo -e "${BOLD}${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
echo -e ""

# ── Stop mode ───────────────────────────────────────────────
if [ "$STOP" = true ]; then
  step "Stopping all Opus Nx services"

  # Kill dev servers (pnpm dev / next dev / uvicorn)
  KILLED_DEVS=false
  for proc in "next-server" "next dev" "uvicorn src.main:app" "turbo dev"; do
    pids=$(pgrep -f "$proc" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill 2>/dev/null || true
      KILLED_DEVS=true
    fi
  done
  if [ "$KILLED_DEVS" = true ]; then
    ok "Dev servers stopped"
  else
    info "No dev servers were running"
  fi

  # Stop Docker containers
  if docker compose -f "$COMPOSE_FILE" ps --quiet 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" down
    ok "Docker database stopped"
  else
    info "Docker database was not running"
  fi

  echo -e ""
  ok "${BOLD}All Opus Nx services stopped.${NC}"
  echo -e "  ${DIM}Data is preserved in Docker volume. Use --reset to wipe it.${NC}"
  exit 0
fi

# ── Prerequisites ───────────────────────────────────────────
step "1/4  Checking prerequisites"

if ! command -v docker &>/dev/null; then
  fail "Docker is required. Install from https://docs.docker.com/get-docker/"
fi

if ! docker info &>/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker Desktop and try again."
fi

ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

if [ "$DB_ONLY" = false ]; then
  if ! command -v node &>/dev/null; then
    fail "Node.js v22+ is required. Install via: brew install node"
  fi
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 22 ]; then
    fail "Node.js v22+ required (found $(node -v)). Use --db-only to skip dev servers."
  fi
  if ! command -v pnpm &>/dev/null; then
    fail "pnpm is required. Install via: npm install -g pnpm"
  fi
  ok "Node $(node -v), pnpm $(pnpm -v)"

  if command -v uv &>/dev/null; then
    ok "uv $(uv --version | awk '{print $2}') (agent swarm will start)"
  else
    warn "uv not found — agent swarm will be skipped (install: curl -LsSf https://astral.sh/uv/install.sh | sh)"
  fi
fi

# ── Environment ─────────────────────────────────────────────
step "2/4  Environment setup"

ENV_FILE="$PROJECT_DIR/.env"
ENV_DOCKER="$PROJECT_DIR/.env.docker"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_DOCKER" ]; then
    cp "$ENV_DOCKER" "$ENV_FILE"
    ok "Created .env from .env.docker template"
  else
    fail ".env.docker template not found"
  fi
fi

# Check for placeholder Anthropic key
if grep -q "ANTHROPIC_API_KEY=sk-ant-\.\.\." "$ENV_FILE" 2>/dev/null; then
  echo -e ""
  echo -e "  ${YELLOW}${BOLD}Action required:${NC} Add your Anthropic API key to .env"
  echo -e "  ${DIM}Get one at: https://console.anthropic.com${NC}"
  echo -e ""
  read -rp "  Press Enter after adding your key (or Ctrl+C to exit)..."
  echo ""

  # Verify the key was actually added
  if grep -q "ANTHROPIC_API_KEY=sk-ant-\.\.\." "$ENV_FILE" 2>/dev/null; then
    fail "ANTHROPIC_API_KEY is still a placeholder. Add your actual API key to .env and re-run."
  fi
fi

# Sync agents/.env for the swarm backend
AGENTS_ENV="$PROJECT_DIR/agents/.env"
if [ ! -f "$AGENTS_ENV" ]; then
  # Extract shared keys from main .env
  ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" "$ENV_FILE" | cut -d= -f2-)
  AUTH=$(grep "^AUTH_SECRET=" "$ENV_FILE" | cut -d= -f2-)
  SUPA_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
  SUPA_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d= -f2-)

  cat > "$AGENTS_ENV" <<EOF
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
AUTH_SECRET=$AUTH
SUPABASE_URL=$SUPA_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPA_KEY
EOF
  ok "Created agents/.env (synced from .env)"
fi

ok "Environment configured"

# ── Database ────────────────────────────────────────────────
step "3/4  Starting local database"

if [ "$RESET" = true ]; then
  warn "Resetting database (removing volume)..."
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
fi

docker compose -f "$COMPOSE_FILE" up -d

# Wait for gateway to be reachable
info "Waiting for database to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -m 2 http://localhost:54321/health 2>/dev/null; then
    break
  fi
  sleep 1
done

# Verify the REST API is responding
if curl -s -o /dev/null -m 2 http://localhost:54321/health 2>/dev/null; then
  ok "Local database is ready"
else
  warn "Database may still be initializing — check: docker compose -f docker-compose.local.yml logs"
fi

echo -e ""
echo -e "  ${CYAN}REST API${NC}   → ${BOLD}http://localhost:54321${NC}  (Supabase-compatible)"
echo -e "  ${CYAN}PostgreSQL${NC} → ${BOLD}localhost:54322${NC}        (user: postgres, pass: postgres)"
echo -e ""

# ── Dev servers ─────────────────────────────────────────────
if [ "$DB_ONLY" = true ]; then
  step "4/4  Done (database only)"
  echo -e ""
  ok "${BOLD}Local database is running!${NC}"
  echo -e ""
  echo -e "  Next steps:"
  echo -e "    ${CYAN}pnpm install && pnpm build${NC}   # First time only"
  echo -e "    ${CYAN}pnpm dev${NC}                     # Start Next.js dashboard"
  echo -e "    ${CYAN}cd agents && uv run uvicorn src.main:app --reload --port 8000${NC}"
  echo -e ""
  echo -e "  Management:"
  echo -e "    ${DIM}Stop:   ./scripts/docker-start.sh --stop${NC}"
  echo -e "    ${DIM}Reset:  ./scripts/docker-start.sh --reset${NC}"
  echo -e "    ${DIM}Logs:   docker compose -f docker-compose.local.yml logs -f postgres${NC}"
  echo -e "    ${DIM}psql:   docker exec -it opus-nx-postgres psql -U postgres -d opus_nx${NC}"
  echo -e ""
  exit 0
fi

step "4/4  Installing dependencies & starting dev servers"

# Install Node.js dependencies if needed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  info "Installing Node.js dependencies (first run — this takes a minute)..."
  (cd "$PROJECT_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
  ok "Node.js dependencies installed"
else
  ok "Node.js dependencies already installed"
fi

# Install Python dependencies if uv is available
if command -v uv &>/dev/null && [ -f "$PROJECT_DIR/agents/pyproject.toml" ]; then
  if [ ! -d "$PROJECT_DIR/agents/.venv" ]; then
    info "Installing Python dependencies..."
    (cd "$PROJECT_DIR/agents" && uv sync 2>/dev/null)
    ok "Python dependencies installed"
  else
    ok "Python dependencies already installed"
  fi
fi

# Build TypeScript packages if dist/ doesn't exist
if [ ! -d "$PROJECT_DIR/packages/core/dist" ]; then
  info "Building TypeScript packages..."
  (cd "$PROJECT_DIR" && pnpm build)
  ok "Packages built"
else
  ok "TypeScript packages already built"
fi

# Launch dev servers
info "Starting dev servers..."
echo -e ""
(cd "$PROJECT_DIR" && exec pnpm dev) &
PID_DEV=$!

# Start agent swarm if uv is available
if command -v uv &>/dev/null && [ -d "$PROJECT_DIR/agents/.venv" ]; then
  (cd "$PROJECT_DIR/agents" && exec uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000) &
  PID_AGENTS=$!
fi

cleanup() {
  echo -e ""
  info "Shutting down dev servers..."
  kill $PID_DEV ${PID_AGENTS:-} 2>/dev/null || true
  wait $PID_DEV ${PID_AGENTS:-} 2>/dev/null || true
  ok "Dev servers stopped (Docker DB still running)"
  echo -e "  ${DIM}Stop everything: ./scripts/docker-start.sh --stop${NC}"
}
trap cleanup EXIT INT TERM

# Wait for Next.js
for i in $(seq 1 30); do
  if curl -s -o /dev/null -m 2 http://localhost:3000 2>/dev/null; then
    break
  fi
  sleep 1
done

echo -e ""
ok "${BOLD}Opus Nx is running!${NC}"
echo -e ""
echo -e "  ${GREEN}${BOLD}→ Open http://localhost:3000 in your browser${NC}"
echo -e ""
echo -e "  ${CYAN}Dashboard${NC}     → ${BOLD}http://localhost:3000${NC}"
if [ -n "${PID_AGENTS:-}" ]; then
echo -e "  ${CYAN}Agent Swarm${NC}   → ${BOLD}http://localhost:8000${NC}"
echo -e "  ${CYAN}Swarm Docs${NC}    → ${BOLD}http://localhost:8000/docs${NC}"
fi
echo -e "  ${CYAN}Database API${NC}  → ${BOLD}http://localhost:54321${NC}"
echo -e "  ${CYAN}PostgreSQL${NC}    → ${BOLD}localhost:54322${NC}  ${DIM}(user: postgres, pass: postgres)${NC}"
echo -e ""
echo -e "  ${DIM}Ctrl+C stops dev servers (DB keeps running)${NC}"
echo -e "  ${DIM}Full teardown: ./scripts/docker-start.sh --stop${NC}"

# Wait for processes
if wait -n $PID_DEV ${PID_AGENTS:-} 2>/dev/null; then
  :
else
  while kill -0 "$PID_DEV" 2>/dev/null; do
    sleep 1
  done
fi
