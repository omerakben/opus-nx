"""Pydantic models for the shared reasoning graph.

All data flowing through the swarm is typed here: nodes, edges,
agent results, and swarm results.
"""

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class AgentName(str, Enum):
    MAESTRO = "maestro"
    DEEP_THINKER = "deep_thinker"
    CONTRARIAN = "contrarian"
    VERIFIER = "verifier"
    SYNTHESIZER = "synthesizer"
    METACOGNITION = "metacognition"


class EdgeRelation(str, Enum):
    LEADS_TO = "LEADS_TO"
    CHALLENGES = "CHALLENGES"
    VERIFIES = "VERIFIES"
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    MERGES = "MERGES"
    OBSERVES = "OBSERVES"


class ReasoningNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent: AgentName
    session_id: str
    content: str
    reasoning: str | None = None
    confidence: float = 0.0
    decision_points: list[dict] = []
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class ReasoningEdge(BaseModel):
    source_id: str
    target_id: str
    relation: EdgeRelation
    weight: float = 1.0
    metadata: dict = {}


class AgentResult(BaseModel):
    agent: AgentName
    status: str  # "completed" | "timeout" | "error"
    reasoning: str
    conclusion: str
    confidence: float
    node_ids: list[str] = []
    tokens_used: int = 0
    duration_ms: int = 0


class SwarmResult(BaseModel):
    session_id: str
    query: str
    agents: list[AgentResult]
    synthesis: str | None = None
    metacognition_insights: list[dict] = []
    total_tokens: int = 0
    total_duration_ms: int = 0
