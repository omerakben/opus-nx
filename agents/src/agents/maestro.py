"""Maestro agent — swarm conductor and query decomposer.

Maestro is the first agent to run. It analyzes the user's query,
decomposes it into sub-tasks, and decides which agents to deploy
with what effort levels. Designed to be FAST (effort: high, max_tokens: 4096,
15-second timeout) so it doesn't bottleneck the pipeline.

If Maestro times out or errors, the SwarmManager falls back to
regex-based complexity classification from V1.
"""

from __future__ import annotations

import json
import time

import structlog

from ..events.types import GraphNodeCreated, MaestroDecomposition
from ..graph.models import AgentName, AgentResult, ReasoningNode
from ..graph.reasoning_graph import SharedReasoningGraph
from ..events.bus import EventBus
from .base import BaseOpusAgent

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

MAESTRO_TOOLS = [
    {
        "name": "decompose_query",
        "description": "Break the user's query into 2-4 sub-tasks or aspects that can be analyzed independently.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subtasks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "2-4 sub-tasks or aspects to analyze",
                    "minItems": 2,
                    "maxItems": 4,
                },
                "reasoning": {
                    "type": "string",
                    "description": "Brief explanation of the decomposition strategy",
                },
            },
            "required": ["subtasks", "reasoning"],
        },
    },
    {
        "name": "select_agents",
        "description": "Choose which agents to deploy for this query. Available: deep_thinker, contrarian, verifier.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agents": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["deep_thinker", "contrarian", "verifier"],
                    },
                    "description": "Which agents to deploy",
                },
                "rationale": {
                    "type": "string",
                    "description": "Why these agents were selected",
                },
            },
            "required": ["agents", "rationale"],
        },
    },
    {
        "name": "set_agent_effort",
        "description": "Assign an effort level to each selected agent. Higher effort = deeper thinking but slower.",
        "input_schema": {
            "type": "object",
            "properties": {
                "assignments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "agent": {
                                "type": "string",
                                "enum": ["deep_thinker", "contrarian", "verifier"],
                            },
                            "effort": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "max"],
                            },
                        },
                        "required": ["agent", "effort"],
                    },
                    "description": "Effort assignments per agent",
                },
            },
            "required": ["assignments"],
        },
    },
]

SYSTEM_PROMPT = """You are Maestro, the swarm conductor. Analyze the query, decompose it into sub-tasks, and decide which agents to deploy.

Your job is to be FAST and decisive. You have three tools:

1. decompose_query — Break the query into 2-4 sub-tasks
2. select_agents — Choose which agents to deploy (deep_thinker, contrarian, verifier)
3. set_agent_effort — Assign effort levels per agent

GUIDELINES:
- Simple factual questions: deploy only deep_thinker at medium effort
- Questions with clear right/wrong: deploy deep_thinker + verifier
- Controversial or opinion-heavy: deploy all three (deep_thinker + contrarian + verifier)
- Complex multi-faceted: deploy all three with high/max effort for deep_thinker

EFFORT LEVELS:
- low: Quick response, minimal thinking (simple lookups)
- medium: Standard analysis (factual questions)
- high: Thorough analysis (most queries)
- max: Maximum depth, 50k thinking tokens (complex research, debugging)

Always use all three tools in sequence: decompose first, then select agents, then set efforts."""


class MaestroAgent(BaseOpusAgent):
    """Swarm conductor — fast query decomposition and agent routing.

    Effort: high (NOT max — Maestro must be fast, 5-10 seconds).
    Max tokens: 4096 (lightweight decomposition, not deep analysis).
    """

    name = AgentName.MAESTRO
    effort = "high"
    max_tokens = 4096
    system_prompt = SYSTEM_PROMPT

    def __init__(
        self,
        graph: SharedReasoningGraph,
        bus: EventBus,
        session_id: str,
        api_key: str | None = None,
    ) -> None:
        super().__init__(graph, bus, session_id, api_key=api_key)
        self._subtasks: list[str] = []
        self._selected_agents: list[str] = []
        self._effort_assignments: dict[str, str] = {}
        self._reasoning: str = ""
        self._node_ids: list[str] = []

    def get_tools(self) -> list[dict]:
        return MAESTRO_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Decompose query, select agents, assign efforts."""
        start = time.monotonic()
        await self.emit_started()

        messages = [{"role": "user", "content": query}]

        result = await self.run_tool_loop(messages, self.get_tools())

        # Build deployment plan from collected tool results
        plan = {
            "agents": [
                {"name": name, "effort": self._effort_assignments.get(name, "high")}
                for name in self._selected_agents
            ],
            "subtasks": self._subtasks,
            "reasoning": self._reasoning,
        }

        conclusion = json.dumps(plan)

        # Emit MaestroDecomposition event
        await self.bus.publish(
            self.session_id,
            MaestroDecomposition(
                session_id=self.session_id,
                subtasks=self._subtasks,
                selected_agents=self._selected_agents,
                reasoning_preview=self._reasoning[:200],
            ),
        )

        duration_ms = int((time.monotonic() - start) * 1000)

        await self.emit_completed(
            conclusion=conclusion,
            confidence=0.9,
            tokens_used=result["tokens_used"],
        )

        return AgentResult(
            agent=self.name,
            status="completed",
            reasoning=result["thinking"],
            conclusion=conclusion,
            confidence=0.9,
            node_ids=self._node_ids,
            tokens_used=result["tokens_used"],
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def tool_decompose_query(self, inp: dict) -> str:
        """Break the query into sub-tasks."""
        subtasks = inp.get("subtasks", [])
        reasoning = inp.get("reasoning", "")

        self._subtasks = subtasks
        self._reasoning = reasoning

        # Write a decomposition node to the graph
        node = ReasoningNode(
            agent=AgentName.MAESTRO,
            session_id=self.session_id,
            content=f"Decomposition: {reasoning}\nSub-tasks: {', '.join(subtasks)}",
            reasoning="decomposition",
            confidence=0.9,
        )

        node_id = await self.graph.add_node(node)
        self._node_ids.append(node_id)

        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=node_id,
                agent=self.name.value,
                content_preview=f"Decomposed into {len(subtasks)} sub-tasks",
            ),
        )

        return f"Decomposed into {len(subtasks)} sub-tasks: {', '.join(subtasks)}"

    async def tool_select_agents(self, inp: dict) -> str:
        """Choose which agents to deploy."""
        agents = inp.get("agents", [])
        rationale = inp.get("rationale", "")

        self._selected_agents = agents

        log.info(
            "maestro_agent_selection",
            agents=agents,
            rationale=rationale,
        )

        return f"Selected agents: {', '.join(agents)}. Rationale: {rationale}"

    async def tool_set_agent_effort(self, inp: dict) -> str:
        """Assign effort levels to selected agents."""
        assignments = inp.get("assignments", [])

        for assignment in assignments:
            agent = assignment.get("agent", "")
            effort = assignment.get("effort", "high")
            self._effort_assignments[agent] = effort

        summary = ", ".join(
            f"{a.get('agent')}={a.get('effort')}" for a in assignments
        )

        log.info("maestro_effort_assignment", assignments=summary)

        return f"Effort assignments: {summary}"
