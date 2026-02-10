"""Entry point for the Opus NX V2 agent backend.

Usage:
    uv run python -m src.main
    uv run uvicorn src.server:app --reload
"""

import uvicorn

from .config import Settings
from .server import app  # noqa: F401 — imported for uvicorn reference


def main() -> None:
    settings = Settings()
    uvicorn.run(
        "src.server:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
