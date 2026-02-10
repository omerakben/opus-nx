# ============================================================
# Opus NX V2 Agent Backend
# Multi-stage build with uv for fast dependency resolution
# ============================================================

FROM python:3.12-slim AS base

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies (cached layer)
RUN uv sync --frozen --no-dev

# Copy source code
COPY src/ src/

# Expose FastAPI port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health').raise_for_status()" || exit 1

# Run with uvicorn
CMD ["uv", "run", "uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]
