#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# dev-start.sh — Full Opus Nx platform setup and launcher
#
# For contributors: this is the single entry point.
#   git clone → ./scripts/dev-start.sh → running platform
#
# What it does:
#   1. Checks prerequisites (Node 22+, pnpm, Python 3.12+, uv)
#   2. Installs all dependencies (Node + Python)
#   3. Bootstraps env files if missing (pnpm setup)
#   4. Verifies API connections (pnpm setup:verify)
#   5. Builds TypeScript packages
#   6. Installs Playwright browsers (for E2E testing)
#   7. Launches dev servers (Next.js :3000 + Python :8000)
#
# Modes:
#   ./scripts/dev-start.sh              # Full setup + launch (tab mode)
#   ./scripts/dev-start.sh --inline     # Full setup + launch (single terminal)
#   ./scripts/dev-start.sh --skip-setup # Skip bootstrap/verify, just launch
#   ./scripts/dev-start.sh --setup-only # Run setup steps without launching
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Resolve project root (works from any cwd) ──────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
INLINE_MODE=false
SKIP_BUILD=false
SKIP_SETUP=false
SETUP_ONLY=false
SKIP_VERIFY=false
SKIP_PLAYWRIGHT=false
USE_DOCKER=false

for arg in "$@"; do
  case "$arg" in
    --inline)          INLINE_MODE=true ;;
    --skip-build)      SKIP_BUILD=true ;;
    --skip-setup)      SKIP_SETUP=true ;;
    --setup-only)      SETUP_ONLY=true ;;
    --skip-verify)     SKIP_VERIFY=true ;;
    --skip-playwright) SKIP_PLAYWRIGHT=true ;;
    --docker)          USE_DOCKER=true ;;
    --help|-h)
      echo "Usage: ./scripts/dev-start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --inline          Run all services in current terminal (no new tabs)"
      echo "  --docker          Use local Docker database instead of Supabase cloud"
      echo "  --skip-build      Skip initial pnpm build (use if dist/ is fresh)"
      echo "  --skip-setup      Skip env bootstrap and connection verify"
      echo "  --setup-only      Run setup steps only, don't launch servers"
      echo "  --skip-verify     Skip connection verification (faster startup)"
      echo "  --skip-playwright Skip Playwright browser installation"
      echo "  -h, --help        Show this help"
      echo ""
      echo "First time? Just run:  ./scripts/dev-start.sh"
      echo "  With Docker DB:    ./scripts/dev-start.sh --docker"
      echo "It will guide you through everything."
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ── Docker mode redirect ──────────────────────────────────
if [ "$USE_DOCKER" = true ]; then
  info "Docker mode selected — delegating to docker-start.sh"
  exec "$PROJECT_DIR/scripts/docker-start.sh"
fi

# ── Banner ──────────────────────────────────────────────────
echo -e ""
echo -e "${BOLD}${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║     Opus Nx — Platform Setup & Launcher   ║${NC}"
echo -e "${BOLD}${CYAN}  ║                                           ║${NC}"
echo -e "${BOLD}${CYAN}  ║  ${DIM}Built by Ozzy + TUEL AI + Claude${NC}${BOLD}${CYAN}          ║${NC}"
echo -e "${BOLD}${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
echo -e ""

# ── Detect first run ────────────────────────────────────────
FIRST_RUN=false
if [ ! -f "$PROJECT_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env.local" ]; then
  FIRST_RUN=true
fi

if [ "$FIRST_RUN" = true ] && [ "$SKIP_SETUP" = false ]; then
  echo -e "${YELLOW}${BOLD}  First run detected — running full platform setup.${NC}"
  echo -e "${DIM}  (Use --skip-setup on subsequent runs for faster startup)${NC}"
  echo -e ""
fi

# ════════════════════════════════════════════════════════════
# PHASE 1: Prerequisites
# ════════════════════════════════════════════════════════════
step "1/7  Checking prerequisites"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fail "$1 is required but not found. $2"
  fi
}

check_cmd node    "Install via: brew install node (need v22+)"
check_cmd pnpm    "Install via: npm install -g pnpm"
check_cmd python3 "Install via: brew install python@3.12"
check_cmd uv      "Install via: curl -LsSf https://astral.sh/uv/install.sh | sh"

# Verify Node.js >= 22
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node.js v22+ required (found $(node -v))"
fi

ok "Node $(node -v), pnpm $(pnpm -v), Python $(python3 --version | awk '{print $2}'), uv $(uv --version | awk '{print $2}')"

# ════════════════════════════════════════════════════════════
# PHASE 2: Install Dependencies
# ════════════════════════════════════════════════════════════
step "2/7  Installing dependencies"

info "Node.js packages..."
(cd "$PROJECT_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install) > /dev/null 2>&1
ok "Node.js dependencies installed"

info "Python packages..."
(cd "$PROJECT_DIR/agents" && uv sync 2>/dev/null)
ok "Python dependencies installed"

# ════════════════════════════════════════════════════════════
# PHASE 3: Bootstrap Environment Files
# ════════════════════════════════════════════════════════════
step "3/7  Environment setup"

if [ "$SKIP_SETUP" = true ]; then
  info "Skipping bootstrap (--skip-setup)"
else
  if [ ! -f "$PROJECT_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env.local" ] || [ ! -f "$PROJECT_DIR/agents/.env" ]; then
    info "Running bootstrap to create env files..."
    (cd "$PROJECT_DIR" && pnpm setup)
    echo ""
    ok "Env files bootstrapped"
    echo ""
    echo -e "  ${YELLOW}${BOLD}Action required:${NC} Add your credentials to the env files."
    echo -e ""
    echo -e "  ${BOLD}Required keys:${NC}"
    echo -e "    ${CYAN}ANTHROPIC_API_KEY${NC}         → https://console.anthropic.com"
    echo -e "    ${CYAN}AUTH_SECRET${NC}               → Auto-generated (already set)"
    echo -e "    ${CYAN}SUPABASE_URL${NC}              → https://supabase.com/dashboard"
    echo -e "    ${CYAN}SUPABASE_SERVICE_ROLE_KEY${NC} → Project Settings → API"
    echo -e "    ${CYAN}SUPABASE_ANON_KEY${NC}         → Project Settings → API"
    echo -e ""
    echo -e "  ${DIM}Optional: VOYAGE_API_KEY, TAVILY_API_KEY${NC}"
    echo -e ""

    # Check if required keys are still placeholders
    ENV_FILE="$PROJECT_DIR/.env"
    if [ -f "$ENV_FILE" ]; then
      NEEDS_KEYS=false
      if grep -q "ANTHROPIC_API_KEY=$\|ANTHROPIC_API_KEY=\"\"" "$ENV_FILE" 2>/dev/null; then
        NEEDS_KEYS=true
      fi
      if grep -q "SUPABASE_URL=$\|SUPABASE_URL=\"\"" "$ENV_FILE" 2>/dev/null; then
        NEEDS_KEYS=true
      fi

      if [ "$NEEDS_KEYS" = true ]; then
        echo -e "  ${YELLOW}Edit your .env file now, then re-run this script.${NC}"
        echo -e "  ${DIM}  \$EDITOR $ENV_FILE${NC}"
        echo -e ""
        read -rp "  Press Enter after adding your keys (or Ctrl+C to exit)..."
        echo ""
      fi
    fi
  else
    ok "Env files already exist"
  fi
fi

# ════════════════════════════════════════════════════════════
# PHASE 4: Verify Connections
# ════════════════════════════════════════════════════════════
step "4/7  Verifying connections"

if [ "$SKIP_SETUP" = true ] || [ "$SKIP_VERIFY" = true ]; then
  info "Skipping verification (--skip-setup or --skip-verify)"
else
  if (cd "$PROJECT_DIR" && pnpm setup:verify 2>&1); then
    ok "All connections verified"
  else
    warn "Some connections failed — services may have limited functionality"
    echo -e "  ${DIM}You can fix credentials later and re-run: pnpm setup:verify${NC}"
    echo ""
  fi
fi

# ════════════════════════════════════════════════════════════
# PHASE 5: Build Packages
# ════════════════════════════════════════════════════════════
step "5/7  Building TypeScript packages"

if [ "$SKIP_BUILD" = true ]; then
  info "Skipping build (--skip-build)"
else
  (cd "$PROJECT_DIR" && pnpm build)
  ok "All packages built"
fi

# ════════════════════════════════════════════════════════════
# PHASE 6: Install Playwright (E2E Testing)
# ════════════════════════════════════════════════════════════
step "6/7  E2E test infrastructure"

if [ "$SKIP_PLAYWRIGHT" = true ]; then
  info "Skipping Playwright (--skip-playwright)"
else
  # Only install if playwright is a dependency and browsers aren't cached
  if [ -f "$PROJECT_DIR/apps/web/node_modules/.package-lock.json" ] 2>/dev/null || \
     (cd "$PROJECT_DIR" && pnpm --filter @opus-nx/web exec playwright --version &>/dev/null); then
    info "Installing Playwright chromium browser..."
    (cd "$PROJECT_DIR" && pnpm --filter @opus-nx/web exec playwright install chromium 2>/dev/null) && \
      ok "Playwright chromium installed" || \
      warn "Playwright install skipped (add @playwright/test to run E2E tests)"
  else
    info "Playwright not in dependencies — skipping browser install"
    info "To enable E2E tests: pnpm --filter @opus-nx/web add -D @playwright/test"
  fi
fi

# ════════════════════════════════════════════════════════════
# PHASE 7: Launch Services
# ════════════════════════════════════════════════════════════
step "7/7  Launching services"

if [ "$SETUP_ONLY" = true ]; then
  echo ""
  ok "${BOLD}Setup complete!${NC} Platform is ready."
  echo ""
  echo -e "  To start the platform:  ${CYAN}./scripts/dev-start.sh --skip-setup${NC}"
  echo -e "  Or manually:            ${CYAN}pnpm dev${NC}"
  echo -e "                          ${CYAN}cd agents && uv run uvicorn src.main:app --reload --port 8000${NC}"
  echo ""
  echo -e "  Run tests:              ${CYAN}pnpm test${NC}"
  echo -e "  Run E2E:                ${CYAN}cd apps/web && pnpm exec playwright test${NC}"
  echo -e "  Python tests:           ${CYAN}cd agents && uv run pytest${NC}"
  echo ""
  exit 0
fi

echo -e ""
info "Tab 1: ${BOLD}Turborepo${NC}  → pnpm dev (Next.js :3000 + TS watchers)"
info "Tab 2: ${BOLD}Agent Swarm${NC} → uvicorn :8000 (Python FastAPI)"
info "Tab 3: ${BOLD}Workspace${NC}   → Shell ready for git, tests, etc."
echo -e ""

# ── Helper: open a macOS terminal tab ──────────────────────
open_terminal_tab() {
  local title="$1"
  local cmd="$2"

  if [ "$TERMINAL_APP" = "iTerm2" ]; then
    osascript <<EOF
tell application "iTerm"
  tell current window
    create tab with default profile
    tell current session
      set name to "$title"
      write text "cd \"$PROJECT_DIR\" && $cmd"
    end tell
  end tell
end tell
EOF
  else
    # Terminal.app
    osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.3
  do script "cd \"$PROJECT_DIR\" && $cmd" in front window
end tell
EOF
  fi
}

# ── Inline mode: run in current terminal with bg processes ─
run_inline() {
  info "Running in inline mode (Ctrl+C to stop all)..."
  echo -e ""

  cleanup() {
    echo -e ""
    info "Shutting down services..."
    kill $PID_TURBO $PID_AGENTS 2>/dev/null || true
    wait $PID_TURBO $PID_AGENTS 2>/dev/null || true
    ok "All services stopped"
  }
  trap cleanup EXIT INT TERM

  # Start Turborepo (all TS + Next.js)
  (cd "$PROJECT_DIR" && exec pnpm dev) &
  PID_TURBO=$!

  # Start Python Agent Swarm
  (cd "$PROJECT_DIR/agents" && exec uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000) &
  PID_AGENTS=$!

  # Wait for Next.js to be ready
  info "Waiting for services to start..."
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -m 2 http://localhost:3000 2>/dev/null; then
      break
    fi
    sleep 1
  done

  echo -e ""
  ok "${BOLD}Platform is running!${NC}"
  echo -e ""
  echo -e "  ${CYAN}Dashboard${NC}     → ${BOLD}http://localhost:3000${NC}"
  echo -e "  ${CYAN}Agent Swarm${NC}   → ${BOLD}http://localhost:8000${NC}"
  echo -e "  ${CYAN}Swarm Docs${NC}    → ${BOLD}http://localhost:8000/docs${NC}"
  echo -e ""
  echo -e "  ${DIM}Landing:        GET /${NC}"
  echo -e "  ${DIM}Login:          GET /login${NC}"
  echo -e "  ${DIM}Workspace:      GET /workspace (requires auth)${NC}"
  echo -e ""
  info "Press ${BOLD}Ctrl+C${NC} to stop all services"

  # Wait for either process to exit (Bash 3.2 compat)
  if wait -n "$PID_TURBO" "$PID_AGENTS" 2>/dev/null; then
    :
  else
    while kill -0 "$PID_TURBO" 2>/dev/null && kill -0 "$PID_AGENTS" 2>/dev/null; do
      sleep 1
    done
  fi
}

# ── Tab mode: open new terminal tabs ───────────────────────
run_tabs() {
  TERMINAL_APP="Terminal"
  if [ -n "${ITERM_SESSION_ID:-}" ] || pgrep -q iTerm2 2>/dev/null; then
    TERMINAL_APP="iTerm2"
  fi
  info "Using ${BOLD}$TERMINAL_APP${NC} for terminal tabs"

  open_terminal_tab "Opus Nx — Turbo" "pnpm dev"
  open_terminal_tab "Opus Nx — Agents" "cd agents && uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"
  open_terminal_tab "Opus Nx — Shell" "echo -e '${GREEN}Opus Nx workspace ready.${NC} Run: pnpm test | cd agents && uv run pytest | cd apps/web && pnpm exec playwright test' && exec \$SHELL"

  echo -e ""
  ok "${BOLD}Platform is running!${NC}"
  echo -e ""
  echo -e "  ${CYAN}Dashboard${NC}     → ${BOLD}http://localhost:3000${NC}"
  echo -e "  ${CYAN}Agent Swarm${NC}   → ${BOLD}http://localhost:8000${NC}"
  echo -e "  ${CYAN}Swarm Docs${NC}    → ${BOLD}http://localhost:8000/docs${NC}"
  echo -e ""
  echo -e "  ${DIM}Landing:        GET /${NC}"
  echo -e "  ${DIM}Login:          GET /login${NC}"
  echo -e "  ${DIM}Workspace:      GET /workspace (requires auth)${NC}"
  echo -e ""
}

# ── Dispatch ────────────────────────────────────────────────
if [ "$INLINE_MODE" = true ]; then
  run_inline
else
  run_tabs
fi
