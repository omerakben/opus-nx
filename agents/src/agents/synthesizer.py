"""Synthesizer agent -- merges all agent conclusions into a coherent final answer.

Reads every node in the shared reasoning graph, groups by agent,
weighs conclusions by verification scores, accounts for Contrarian
challenges, and produces a unified synthesis with convergence/divergence
analysis and overall confidence.

The synthesis node creates MERGES edges to the key nodes it draws from,
making the information flow visible in the graph.
"""

from __future__ import annotations

import time

from ..events.bus import EventBus
from ..events.types import GraphNodeCreated, SynthesisReady
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
# Tool definitions
# ---------------------------------------------------------------------------
SYNTHESIZER_TOOLS = [
    {
        "name": "read_all_conclusions",
        "description": (
            "Read all reasoning nodes from every agent in the current session, "
            "grouped by agent. Includes challenge and verification status for each node."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "write_synthesis",
        "description": (
            "Write the final unified synthesis that merges all agents' conclusions. "
            "Identifies points of convergence and divergence across agents."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "synthesis": {
                    "type": "string",
                    "description": "The unified synthesis text merging all agent conclusions.",
                },
                "confidence": {
                    "type": "number",
                    "description": "Overall confidence in the synthesis (0.0-1.0).",
                },
                "convergence_points": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Points where agents agree.",
                },
                "divergence_points": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Points where agents disagree.",
                },
            },
            "required": ["synthesis", "confidence", "convergence_points", "divergence_points"],
        },
    },
]

SYSTEM_PROMPT = """You are Synthesizer, the integrative reasoning agent within the Opus NX swarm.
Your role is to merge ALL agent conclusions into a single, coherent final answer.

APPROACH:
- Read every agent's conclusions using read_all_conclusions
- Identify points of CONVERGENCE: where do agents agree? What is the consensus?
- Identify points of DIVERGENCE: where do agents disagree? What remains contested?
- Weight conclusions by verification scores when available (verified conclusions carry more weight)
- Account for challenges raised by the Contrarian: were they addressed or do they still stand?
- If a conclusion was challenged AND the challenge was not refuted, lower its weight
- If a conclusion was verified with a high score, increase its weight

OUTPUT:
- Use write_synthesis to produce the final merged answer
- Be comprehensive but do NOT repeat agent conclusions verbatim
- Synthesize: combine, reconcile, and distill into a unified perspective
- Acknowledge genuine uncertainty where it exists
- Rate your overall confidence based on the quality and agreement of the evidence

QUALITY CRITERIA:
- A good synthesis is shorter than the sum of all agent outputs
- It adds value by showing how pieces fit together
- It does not paper over real disagreements
- It gives the reader a clear, actionable understanding"""


class SynthesizerAgent(BaseOpusAgent):
    """Merges all agent conclusions into a unified synthesis.

    Effort: high. Reads the entire reasoning graph, creates MERGES edges
    to key nodes, and emits a SynthesisReady event.
    """

    name = AgentName.SYNTHESIZER
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
        self._synthesis_text: str = ""
        self._synthesis_confidence: float = 0.0

    def get_tools(self) -> list[dict]:
        return SYNTHESIZER_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Read all agent reasoning and produce a unified synthesis."""
        start = time.monotonic()
        await self.emit_started()

        messages = [
            {
                "role": "user",
                "content": (
                    f"The swarm has been analyzing: {query}\n\n"
                    "First, use read_all_conclusions to see what every agent has written. "
                    "Then use write_synthesis to produce a unified final answer that "
                    "merges all perspectives. Identify convergence and divergence points. "
                    "Weight verified conclusions higher and account for unresolved challenges."
                ),
            },
        ]

        result = await self.run_tool_loop(messages, self.get_tools())

        duration_ms = int((time.monotonic() - start) * 1000)

        conclusion = self._synthesis_text or result["text"] or "Synthesis completed."
        confidence = self._synthesis_confidence or 0.5

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

    async def tool_read_all_conclusions(self, inp: dict) -> str:
        """Read all session nodes grouped by agent, with challenge/verification status."""
        nodes = await self.graph.get_session_nodes(self.session_id)

        if not nodes:
            return "No reasoning nodes found in the graph yet."

        # Group nodes by agent
        by_agent: dict[str, list[dict]] = {}
        for node in nodes:
            agent = node.get("agent", "unknown")
            by_agent.setdefault(agent, []).append(node)

        sections: list[str] = []
        for agent, agent_nodes in by_agent.items():
            lines = [f"=== Agent: {agent} ({len(agent_nodes)} nodes) ==="]

            for node in agent_nodes:
                node_id = node.get("id", "?")
                content = node.get("content", "")
                confidence = node.get("confidence", 0)
                reasoning_type = node.get("reasoning", "unknown")

                lines.append(
                    f"\nNODE {node_id}\n"
                    f"  Type: {reasoning_type} | Confidence: {confidence:.2f}\n"
                    f"  Content: {content}"
                )

                # Fetch challenges for this node
                challenges = await self.graph.get_challenges_for(node_id)
                if challenges:
                    for ch in challenges:
                        src = ch.get("source_node", {})
                        edge = ch.get("edge", {})
                        severity = edge.get("metadata", {}).get("severity", "?")
                        lines.append(
                            f"  CHALLENGED by {src.get('agent', '?')} "
                            f"(severity: {severity}): "
                            f"{src.get('content', '')[:200]}"
                        )
                else:
                    lines.append("  No challenges.")

                # Fetch verifications for this node
                verifications = await self.graph.get_verifications_for(node_id)
                if verifications:
                    for ver in verifications:
                        src = ver.get("source_node", {})
                        edge = ver.get("edge", {})
                        score = edge.get("weight", 0)
                        lines.append(
                            f"  VERIFIED (score: {score:.2f}): "
                            f"{src.get('content', '')[:200]}"
                        )
                else:
                    lines.append("  Not yet verified.")

            sections.append("\n".join(lines))

        return "\n\n".join(sections)

    async def tool_write_synthesis(self, inp: dict) -> str:
        """Write the unified synthesis and create MERGES edges to key nodes."""
        synthesis = inp.get("synthesis", "")
        confidence = inp.get("confidence", 0.5)
        convergence_points = inp.get("convergence_points", [])
        divergence_points = inp.get("divergence_points", [])

        # Store for the final AgentResult
        self._synthesis_text = synthesis
        self._synthesis_confidence = confidence

        # Create the synthesis node
        synthesis_node = ReasoningNode(
            agent=AgentName.SYNTHESIZER,
            session_id=self.session_id,
            content=synthesis,
            reasoning="synthesis",
            confidence=confidence,
            decision_points=[
                {
                    "convergence_points": convergence_points,
                    "divergence_points": divergence_points,
                },
            ],
        )
        synthesis_id = await self.graph.add_node(synthesis_node)
        self._node_ids.append(synthesis_id)

        # Create MERGES edges to the highest-confidence node from each agent
        nodes = await self.graph.get_session_nodes(self.session_id)
        best_by_agent: dict[str, dict] = {}
        for node in nodes:
            nid = node.get("id", "")
            agent = node.get("agent", "")
            # Skip our own synthesis node and the synthesizer agent
            if nid == synthesis_id or agent == AgentName.SYNTHESIZER.value:
                continue
            current_best = best_by_agent.get(agent)
            if current_best is None or node.get("confidence", 0) > current_best.get("confidence", 0):
                best_by_agent[agent] = node

        merge_count = 0
        for agent, node in best_by_agent.items():
            target_id = node.get("id", "")
            if not target_id:
                continue
            edge = ReasoningEdge(
                source_id=synthesis_id,
                target_id=target_id,
                relation=EdgeRelation.MERGES,
                weight=confidence,
                metadata={"agent": agent},
            )
            await self.graph.add_edge(edge)
            merge_count += 1

        # Emit graph node event for dashboard
        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=synthesis_id,
                agent=self.name.value,
                content_preview=synthesis[:150],
            ),
        )

        # Emit SynthesisReady event
        await self.bus.publish(
            self.session_id,
            SynthesisReady(
                session_id=self.session_id,
                synthesis=synthesis,
                confidence=confidence,
            ),
        )

        return (
            f"Synthesis {synthesis_id} written to graph "
            f"(confidence: {confidence:.2f}, "
            f"convergence: {len(convergence_points)}, "
            f"divergence: {len(divergence_points)}, "
            f"merged from {merge_count} agents)"
        )
