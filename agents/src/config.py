"""Opus NX V2 agent backend configuration.

Single source of truth for all settings. Validates at startup —
no silent failures from missing env vars.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


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
