"""Swarm event types for real-time streaming to the dashboard.

Every significant swarm action emits an event. The EventBus delivers
these to WebSocket subscribers per session.
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


class SwarmEvent(BaseModel):
    """Base event — all swarm events inherit from this."""

    event: str
    session_id: str
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class SwarmStarted(SwarmEvent):
    event: Literal["swarm_started"] = "swarm_started"
    agents: list[str]
    query: str


class AgentStarted(SwarmEvent):
    event: Literal["agent_started"] = "agent_started"
    agent: str
    effort: str


class AgentThinking(SwarmEvent):
    event: Literal["agent_thinking"] = "agent_thinking"
    agent: str
    delta: str  # Streaming thinking text


class GraphNodeCreated(SwarmEvent):
    event: Literal["graph_node_created"] = "graph_node_created"
    node_id: str
    agent: str
    content_preview: str


class AgentChallenges(SwarmEvent):
    event: Literal["agent_challenges"] = "agent_challenges"
    challenger: str
    target_node_id: str
    argument_preview: str


class VerificationScore(SwarmEvent):
    event: Literal["verification_score"] = "verification_score"
    node_id: str
    score: float
    verdict: str  # correct | incorrect | uncertain


class AgentCompleted(SwarmEvent):
    event: Literal["agent_completed"] = "agent_completed"
    agent: str
    conclusion_preview: str
    confidence: float
    tokens_used: int


class SynthesisReady(SwarmEvent):
    event: Literal["synthesis_ready"] = "synthesis_ready"
    synthesis: str
    confidence: float


class MetacognitionInsight(SwarmEvent):
    event: Literal["metacognition_insight"] = "metacognition_insight"
    insight_type: str  # swarm_bias | groupthink | productive_tension
    description: str
    affected_agents: list[str]
