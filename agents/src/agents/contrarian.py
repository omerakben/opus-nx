"""Contrarian agent — the devil's advocate.

Makes the swarm smarter by challenging weak reasoning. Reads other agents'
nodes from the shared graph, creates CHALLENGES edges for flaws found
and SUPPORTS edges when reasoning is sound.

Effort: "high" — needs solid reasoning to produce meaningful challenges.

Ports from V1: configs/prompts/thinkfork/contrarian.md system prompt.
"""

from __future__ import annotations

import time

from ..events.bus import EventBus
from ..events.types import AgentChallenges, GraphNodeCreated
from ..graph.models import (
    AgentName,
    AgentResult,
    EdgeRelation,
    ReasoningEdge,
    ReasoningNode,
)
from ..graph.reasoning_graph import SharedReasoningGraph
from .base import BaseOpusAgent

# ---------------------------------------------------------------------------
# Tool definitions (SPEC 8)
# ---------------------------------------------------------------------------
CONTRARIAN_TOOLS = [
    {
        "name": "read_agent_reasoning",
        "description": "Read reasoning nodes from a specific agent in the shared graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent": {
                    "type": "string",
                    "enum": ["deep_thinker", "verifier", "synthesizer"],
                },
            },
            "required": ["agent"],
        },
    },
    {
        "name": "create_challenge",
        "description": "Challenge a specific reasoning node. Creates a CHALLENGES edge in the graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string"},
                "counter_argument": {"type": "string"},
                "severity": {
                    "type": "string",
                    "enum": ["critical", "major", "minor"],
                },
                "flaw_type": {
                    "type": "string",
                    "enum": [
                        "logical_error",
                        "unsupported_assumption",
                        "missing_perspective",
                        "false_dichotomy",
                        "overgeneralization",
                        "circular_reasoning",
                    ],
                },
            },
            "required": ["target_node_id", "counter_argument", "severity"],
        },
    },
    {
        "name": "concede_point",
        "description": "Acknowledge that a reasoning node is sound. Creates a SUPPORTS edge.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["target_node_id", "reason"],
        },
    },
]

# System prompt ported from configs/prompts/thinkfork/contrarian.md
# and adapted for the swarm agent context (SPEC 8).
SYSTEM_PROMPT = """You are Contrarian, the devil's advocate within the Opus NX swarm.
Your job is to make the swarm's collective reasoning STRONGER by finding weaknesses.

MINDSET:
- Assumption Challenger: Question what everyone takes for granted
- Alternative Frameworks: Look at problems through different lenses
- Devil's Advocate: Argue against the obvious solution
- Second-Order Thinking: Consider consequences of consequences
- Inversion: Consider what would make things fail

RULES:
- Read other agents' reasoning from the shared graph using read_agent_reasoning
- Find logical gaps, unsupported assumptions, missing perspectives
- Create explicit challenges using create_challenge — this creates a CHALLENGES edge in the graph
- If you genuinely cannot find a flaw, use concede_point — this creates a SUPPORTS edge
- NEVER agree easily. Your value is in rigorous criticism.
- Be specific. "This could be wrong" is useless.
  "Step 3 assumes X, but Y contradicts this because Z" is valuable.

KEY QUESTIONS TO ASK:
- "What if everyone is wrong about this?"
- "What assumption, if false, changes everything?"
- "What's the consensus missing?"
- "What would make this fail?"

The Verifier agent will evaluate both the original reasoning and your challenges.
Make your challenges precise enough to be independently verified."""


class ContrarianAgent(BaseOpusAgent):
    """Devil's advocate that challenges weak reasoning.

    Effort: high. Reads the graph, creates CHALLENGES and SUPPORTS edges.
    """

    name = AgentName.CONTRARIAN
    effort = "high"
    max_tokens = 16384
    system_prompt = SYSTEM_PROMPT

    def __init__(
        self,
        graph: SharedReasoningGraph,
        bus: EventBus,
        session_id: str,
        api_key: str | None = None,
    ) -> None:
        super().__init__(graph, bus, session_id, api_key=api_key)
        self._node_ids: list[str] = []
        self._challenges_created = 0
        self._supports_created = 0

    def get_tools(self) -> list[dict]:
        return CONTRARIAN_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Read existing reasoning and challenge it."""
        start = time.monotonic()
        await self.emit_started()

        # Instruct Contrarian to first read the graph, then challenge
        messages = [
            {
                "role": "user",
                "content": (
                    f"The swarm is analyzing: {query}\n\n"
                    "First, use read_agent_reasoning to read what the deep_thinker "
                    "has written. Then challenge any weak reasoning you find. "
                    "If the reasoning is genuinely sound, concede the point. "
                    "Be thorough — examine each node."
                ),
            },
        ]

        result = await self.run_tool_loop(messages, self.get_tools())

        # Derive confidence from challenge ratio
        total_actions = self._challenges_created + self._supports_created
        if total_actions > 0:
            confidence = 0.6 + 0.3 * (self._challenges_created / total_actions)
        else:
            confidence = 0.5

        duration_ms = int((time.monotonic() - start) * 1000)

        conclusion = result["text"] or (
            f"Reviewed reasoning. Created {self._challenges_created} challenges "
            f"and {self._supports_created} supports."
        )

        await self.emit_completed(
            conclusion=conclusion,
            confidence=confidence,
            tokens_used=result["tokens_used"],
        )

        return AgentResult(
            agent=self.name,
            status="completed",
            reasoning=result["thinking"],
            conclusion=conclusion,
            confidence=confidence,
            node_ids=self._node_ids,
            tokens_used=result["tokens_used"],
            input_tokens_used=result.get("input_tokens_used", 0),
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def tool_read_agent_reasoning(self, inp: dict) -> str:
        """Read reasoning nodes from a specific agent."""
        agent_str = inp.get("agent", "deep_thinker")
        try:
            agent_name = AgentName(agent_str)
        except ValueError:
            return f"Unknown agent: {agent_str}"

        nodes = await self.graph.get_nodes_by_agent(agent_name)
        if not nodes:
            return f"No reasoning nodes from {agent_str} yet."

        lines = []
        for n in nodes:
            node_id = n.get("id", "?")
            content = n.get("content", "")
            confidence = n.get("confidence", 0)
            reasoning_type = n.get("reasoning", "unknown")
            dp_count = len(n.get("decision_points", []))
            lines.append(
                f"NODE {node_id}\n"
                f"  Type: {reasoning_type} | Confidence: {confidence:.2f} | Decision points: {dp_count}\n"
                f"  Content: {content}"
            )
        return "\n\n".join(lines)

    async def tool_create_challenge(self, inp: dict) -> str:
        """Challenge a reasoning node. Creates a CHALLENGES edge."""
        target_node_id = inp.get("target_node_id", "")
        counter_argument = inp.get("counter_argument", "")
        severity = inp.get("severity", "major")
        flaw_type = inp.get("flaw_type", "logical_error")

        # Verify target node exists
        target = await self.graph.get_node(target_node_id)
        if not target:
            return f"Target node {target_node_id} not found in graph."

        # Create challenge node
        challenge_node = ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id=self.session_id,
            content=f"CHALLENGE ({severity}, {flaw_type}): {counter_argument}",
            reasoning="challenge",
            confidence=0.7 if severity == "critical" else 0.5,
        )
        challenge_id = await self.graph.add_node(challenge_node)
        self._node_ids.append(challenge_id)

        # Create CHALLENGES edge
        edge = ReasoningEdge(
            source_id=challenge_id,
            target_id=target_node_id,
            relation=EdgeRelation.CHALLENGES,
            weight={"critical": 1.0, "major": 0.7, "minor": 0.4}.get(severity, 0.7),
            metadata={"severity": severity, "flaw_type": flaw_type},
        )
        await self.graph.add_edge(edge)
        self._challenges_created += 1

        # Emit challenge event for dashboard
        await self.bus.publish(
            self.session_id,
            AgentChallenges(
                session_id=self.session_id,
                challenger=self.name.value,
                target_node_id=target_node_id,
                argument_preview=counter_argument,
            ),
        )

        return (
            f"Challenge {challenge_id} created against node {target_node_id} "
            f"(severity: {severity}, type: {flaw_type})"
        )

    async def tool_concede_point(self, inp: dict) -> str:
        """Acknowledge sound reasoning. Creates a SUPPORTS edge."""
        target_node_id = inp.get("target_node_id", "")
        reason = inp.get("reason", "")

        # Verify target node exists
        target = await self.graph.get_node(target_node_id)
        if not target:
            return f"Target node {target_node_id} not found in graph."

        # Create support node
        support_node = ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id=self.session_id,
            content=f"SUPPORTS: {reason}",
            reasoning="support",
            confidence=0.8,
        )
        support_id = await self.graph.add_node(support_node)
        self._node_ids.append(support_id)

        # Create SUPPORTS edge
        edge = ReasoningEdge(
            source_id=support_id,
            target_id=target_node_id,
            relation=EdgeRelation.SUPPORTS,
            weight=0.8,
            metadata={"reason": reason},
        )
        await self.graph.add_edge(edge)
        self._supports_created += 1

        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=support_id,
                agent=self.name.value,
                content_preview=f"SUPPORTS: {reason}",
            ),
        )

        return f"Support {support_id} recorded for node {target_node_id}"
