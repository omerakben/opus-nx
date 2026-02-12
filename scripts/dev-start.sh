#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# dev-start.sh — Launch the full Opus Nx development environment
#
# Opens three terminal tabs:
#   1. Turborepo (TS packages watch + Next.js dev on :3000)
#   2. Python Agent Swarm (FastAPI + uvicorn on :8000)
#   3. Workspace shell (for git, tests, etc.)
#
# Usage:
#   ./scripts/dev-start.sh            # Auto-detect terminal (iTerm2 → Terminal.app)
#   ./scripts/dev-start.sh --inline   # Run all services in current terminal (no tabs)
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
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; exit 1; }

# ── Parse flags ─────────────────────────────────────────────
INLINE_MODE=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --inline)     INLINE_MODE=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --help|-h)
      echo "Usage: ./scripts/dev-start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --inline       Run all services in current terminal (no new tabs)"
      echo "  --skip-build   Skip initial pnpm build (use if dist/ is fresh)"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ── Banner ──────────────────────────────────────────────────
echo -e ""
echo -e "${BOLD}${CYAN}  ╔═══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║         Opus Nx — Dev Launcher        ║${NC}"
echo -e "${BOLD}${CYAN}  ╚═══════════════════════════════════════╝${NC}"
echo -e ""

# ── 1. Check prerequisites ─────────────────────────────────
info "Checking prerequisites..."

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fail "$1 is required but not found. $2"
  fi
}

check_cmd node       "Install via: brew install node (need v22+)"
check_cmd pnpm       "Install via: npm install -g pnpm"
check_cmd python3    "Install via: brew install python@3.12"
check_cmd uv         "Install via: curl -LsSf https://astral.sh/uv/install.sh | sh"

# Verify Node.js >= 22
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node.js v22+ required (found $(node -v))"
fi

ok "Prerequisites satisfied (Node $(node -v), pnpm $(pnpm -v), Python $(python3 --version | awk '{print $2}'), uv $(uv --version | awk '{print $2}'))"

# ── 2. Validate environment files ──────────────────────────
info "Checking environment files..."

if [ ! -f "$PROJECT_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env.local" ]; then
  warn "No .env or .env.local found in project root"
  warn "Copy .env.example → .env and fill in your keys"
  warn "  cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
  echo ""
fi

if [ ! -f "$PROJECT_DIR/agents/.env" ]; then
  warn "No agents/.env found — Python swarm may fail to start"
  warn "  cp $PROJECT_DIR/agents/.env.example $PROJECT_DIR/agents/.env"
  echo ""
fi

ok "Environment check complete"

# ── 3. Install dependencies ────────────────────────────────
info "Installing Node.js dependencies..."
(cd "$PROJECT_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
ok "Node.js dependencies installed"

info "Installing Python dependencies..."
(cd "$PROJECT_DIR/agents" && uv sync)
ok "Python dependencies installed"

# ── 4. Build packages (shared → db → core → agents) ───────
if [ "$SKIP_BUILD" = false ]; then
  info "Building TypeScript packages (shared → db → core → agents)..."
  (cd "$PROJECT_DIR" && pnpm build)
  ok "All packages built"
else
  warn "Skipping build (--skip-build flag set)"
fi

# ── 5. Launch services ─────────────────────────────────────
echo -e ""
echo -e "${BOLD}${GREEN}  Launching services...${NC}"
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

  # Trap to kill background processes on exit
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

  echo -e ""
  ok "Services running:"
  echo -e "  ${CYAN}Dashboard${NC}    → http://localhost:3000"
  echo -e "  ${CYAN}Agent Swarm${NC}  → http://localhost:8000"
  echo -e "  ${CYAN}Swarm Docs${NC}   → http://localhost:8000/docs"
  echo -e ""
  info "Press ${BOLD}Ctrl+C${NC} to stop all services"

  # Wait for either process to exit
  wait -n $PID_TURBO $PID_AGENTS 2>/dev/null || true
}

# ── Tab mode: open new terminal tabs ───────────────────────
run_tabs() {
  # Detect terminal app
  TERMINAL_APP="Terminal"
  if [ -n "${ITERM_SESSION_ID:-}" ] || pgrep -q iTerm2 2>/dev/null; then
    TERMINAL_APP="iTerm2"
  fi
  info "Using ${BOLD}$TERMINAL_APP${NC} for terminal tabs"

  # Tab 1: Turborepo
  open_terminal_tab "Opus Nx — Turbo" "pnpm dev"

  # Tab 2: Python Agent Swarm
  open_terminal_tab "Opus Nx — Agents" "cd agents && uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"

  # Tab 3: Workspace shell
  open_terminal_tab "Opus Nx — Shell" "echo -e '${GREEN}Opus Nx workspace ready.${NC} Run tests: pnpm test | Python: cd agents && uv run pytest' && exec \$SHELL"

  echo -e ""
  ok "All terminals launched!"
  echo -e ""
  echo -e "  ${CYAN}Dashboard${NC}    → http://localhost:3000"
  echo -e "  ${CYAN}Agent Swarm${NC}  → http://localhost:8000"
  echo -e "  ${CYAN}Swarm Docs${NC}   → http://localhost:8000/docs"
  echo -e ""
}

# ── Dispatch ────────────────────────────────────────────────
if [ "$INLINE_MODE" = true ]; then
  run_inline
else
  run_tabs
fi
