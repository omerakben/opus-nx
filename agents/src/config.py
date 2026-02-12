"""Opus Nx agent backend configuration.

Single source of truth for all settings. Validates at startup —
no silent failures from missing env vars.
"""

import logging
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Required
    anthropic_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    auth_secret: str

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "https://opus-nx.vercel.app"]

    # Rate limiting
    rate_limit_requests: int = 20
    rate_limit_window_seconds: int = 60

    # Agent behavior
    agent_timeout_seconds: int = 120
    agent_stagger_seconds: float = 2.5
    max_concurrent_agents: int = 6

    # Optional semantic reasoning retrieval (Voyage)
    voyage_api_key: str | None = None
    voyage_model: str = "voyage-3"

    # Neo4j (optional — system works without it)
    neo4j_uri: str | None = None
    neo4j_user: str | None = None
    neo4j_password: str | None = None

    def validate_at_startup(self) -> list[str]:
        """Validate configuration at startup. Returns list of warnings.

        Does NOT raise — allows degraded mode with clear logging.
        """
        warnings: list[str] = []

        # Check Anthropic API key format
        if not self.anthropic_api_key.startswith("sk-ant-"):
            warnings.append(
                "ANTHROPIC_API_KEY does not start with 'sk-ant-' — "
                "may be invalid"
            )

        # Check Supabase URL is a valid URL
        try:
            parsed = urlparse(self.supabase_url)
            if not parsed.scheme or not parsed.netloc:
                warnings.append(
                    f"SUPABASE_URL '{self.supabase_url}' does not look like a valid URL"
                )
        except Exception:
            warnings.append(
                f"SUPABASE_URL '{self.supabase_url}' could not be parsed"
            )

        # Check CORS origins are valid URLs
        for origin in self.cors_origins:
            try:
                parsed = urlparse(origin)
                if not parsed.scheme or not parsed.netloc:
                    warnings.append(f"CORS origin '{origin}' is not a valid URL")
            except Exception:
                warnings.append(f"CORS origin '{origin}' could not be parsed")

        # Check AUTH_SECRET is not trivially weak
        if len(self.auth_secret) < 16:
            warnings.append(
                "AUTH_SECRET is shorter than 16 characters — consider using a stronger secret"
            )

        # Report optional services
        if not self.voyage_api_key:
            logger.info("VOYAGE_API_KEY not set — semantic retrieval will use FTS fallback")
        if not self.neo4j_uri:
            logger.info("NEO4J_URI not set — graph persistence uses Supabase only")

        for w in warnings:
            logger.warning("Config validation: %s", w)

        if not warnings:
            logger.info("Configuration validated successfully")

        return warnings
