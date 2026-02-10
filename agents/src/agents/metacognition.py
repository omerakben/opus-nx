"""Metacognition agent — the swarm psychologist.

Runs AFTER all other agents complete. Analyzes the full graph state to
detect reasoning patterns, biases, and swarm dynamics. Uses Opus 4.6's
maximum thinking budget (effort: "max") for deep self-reflection.

Ports from V1:
- metacognition.ts (lines 36-42 focus areas, lines 339-436 multi-turn follow-up)
- configs/prompts/metacognition.md system prompt
"""

from __future__ import annotations

import time

from ..events.bus import EventBus
from ..events.types import MetacognitionInsight
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
# Focus areas (ported from metacognition.ts lines 36-42)
# ---------------------------------------------------------------------------
FOCUS_AREAS = {
    "reasoning_quality": "How sound is the logical reasoning? Are conclusions well-supported?",
    "bias_detection": "Are there systematic biases affecting the swarm's reasoning?",
    "knowledge_gaps": "What information is missing that could change conclusions?",
    "decision_quality": "How well were decision points handled? Were alternatives explored?",
    "learning_patterns": "What recurring reasoning patterns appear across the swarm?",
}

# Insight types for completeness checking in multi-turn follow-up
INSIGHT_TYPES = {"bias_detection", "pattern", "improvement_hypothesis"}

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------
METACOGNITION_TOOLS = [
    {
        "name": "observe_swarm_state",
        "description": (
            "Read the full swarm state: all agents' nodes, challenges, "
            "verifications, and edges. Returns a structured overview."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "write_insight",
        "description": "Record a metacognitive insight about the swarm's reasoning.",
        "input_schema": {
            "type": "object",
            "properties": {
                "insight_type": {
                    "type": "string",
                    "enum": ["swarm_bias", "groupthink", "productive_tension",
                             "bias_detection", "pattern", "improvement_hypothesis"],
                    "description": "Category of the metacognitive insight.",
                },
                "description": {
                    "type": "string",
                    "description": "Clear, actionable description of the insight (2-4 sentences).",
                },
                "affected_agents": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Which agents this insight applies to.",
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence in this insight (0.0-1.0).",
                },
                "evidence_node_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Node IDs that support this insight.",
                },
            },
            "required": ["insight_type", "description", "affected_agents", "confidence"],
        },
    },
]

SYSTEM_PROMPT = """You are Metacognition, the swarm psychologist within the Opus NX reasoning system.

You observe the PROCESS of reasoning, not just the conclusions. Your role is meta-analysis:
examining HOW the swarm reached its answers, not WHETHER the answers are correct.

## Your Task

Analyze the full swarm state and produce actionable insights about reasoning quality.

## Analysis Categories

### 1. Bias Detection (bias_detection / swarm_bias)
Look for systematic tendencies:
- Anchoring: Over-relying on initial information
- Confirmation: Seeking confirming evidence, dismissing alternatives
- Availability: Overweighting recent/salient examples
- Overconfidence: High confidence with shallow analysis
- Premature Closure: Concluding before exploring alternatives
- Groupthink: All agents converging too quickly without genuine debate

### 2. Pattern Recognition (pattern / productive_tension)
Identify reasoning structures:
- Decision frameworks: How are options evaluated?
- Alternative exploration: How many alternatives are considered?
- Confidence calibration: Is uncertainty handled well?
- Productive tension: Is the Contrarian generating valuable pushback?
- Reasoning depth: What triggers deeper vs. shallower analysis?

### 3. Improvement Hypotheses (improvement_hypothesis)
Generate testable suggestions:
- "Consider more alternatives at decision step X"
- "Delay conclusion until evidence type Y is gathered"
- "Actively seek disconfirming evidence for hypothesis Z"

## Evidence Standards
- High confidence (0.8-1.0): Pattern in 3+ nodes with clear examples
- Medium confidence (0.5-0.8): Pattern in 2 nodes or with some ambiguity
- Low confidence (0.3-0.5): Single occurrence or circumstantial evidence

## Instructions
1. First, use observe_swarm_state to read all swarm data
2. Use your full extended thinking to deeply analyze patterns
3. For each insight discovered, call write_insight with proper evidence
4. Aim for 3-7 high-quality insights (quality over quantity)
5. Balance critique with recognition — note strengths AND weaknesses"""


class MetacognitionAgent(BaseOpusAgent):
    """Swarm psychologist — analyzes reasoning process, not conclusions.

    Effort: max — uses the full 50k thinking budget for deep meta-analysis.
    Runs AFTER all other agents have written to the graph.
    """

    name = AgentName.METACOGNITION
    effort = "max"
    max_tokens = 16384
    system_prompt = SYSTEM_PROMPT

    def __init__(
        self,
        graph: SharedReasoningGraph,
        bus: EventBus,
        session_id: str,
    ) -> None:
        super().__init__(graph, bus, session_id)
        self._node_ids: list[str] = []
        self._insights: list[dict] = []

    def get_tools(self) -> list[dict]:
        return METACOGNITION_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Analyze the swarm's reasoning patterns.

        Implements multi-turn follow-up (ported from metacognition.ts
        lines 339-436): after the initial analysis, checks for missing
        insight types and prompts for additional analysis up to 3 times.
        """
        start = time.monotonic()
        await self.emit_started()

        messages = [
            {
                "role": "user",
                "content": (
                    f"The swarm analyzed this query: {query}\n\n"
                    "Observe the full swarm state, then produce metacognitive "
                    "insights about the reasoning PROCESS. Focus on patterns, "
                    "biases, and dynamics between agents."
                ),
            },
        ]

        # Initial analysis pass
        result = await self.run_tool_loop(messages, self.get_tools())

        # Multi-turn follow-up: check for missing insight types and prompt
        # for additional analysis (ported from V1 metacognition.ts lines 339-436)
        for iteration in range(3):
            missing_types = self._find_missing_insight_types()
            if not missing_types:
                break

            follow_up = self._build_follow_up_prompt(missing_types)
            messages = [{"role": "user", "content": follow_up}]
            follow_up_result = await self.run_tool_loop(messages, self.get_tools())

            # Accumulate tokens and thinking
            result["tokens_used"] += follow_up_result["tokens_used"]
            result["thinking"] += "\n\n--- Follow-up iteration ---\n\n" + follow_up_result["thinking"]
            if follow_up_result["text"]:
                result["text"] += "\n\n" + follow_up_result["text"]

        # Detect swarm-level dynamics
        await self._detect_swarm_dynamics()

        duration_ms = int((time.monotonic() - start) * 1000)

        conclusion = result["text"] or (
            f"Metacognitive analysis complete. Produced {len(self._insights)} insights."
        )

        await self.emit_completed(
            conclusion=conclusion,
            confidence=0.75,
            tokens_used=result["tokens_used"],
        )

        return AgentResult(
            agent=self.name,
            status="completed",
            reasoning=result["thinking"],
            conclusion=conclusion,
            confidence=0.75,
            node_ids=self._node_ids,
            tokens_used=result["tokens_used"],
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Multi-turn follow-up (ported from V1 metacognition.ts lines 339-436)
    # ------------------------------------------------------------------

    def _find_missing_insight_types(self) -> set[str]:
        """Check which insight types haven't been produced yet."""
        produced = {i["insight_type"] for i in self._insights}
        return INSIGHT_TYPES - produced

    def _build_follow_up_prompt(self, missing_types: set[str]) -> str:
        """Build a follow-up prompt targeting missing insight types."""
        focus_descriptions = []
        for mt in missing_types:
            if mt == "bias_detection":
                focus_descriptions.append(
                    "BIAS DETECTION: Look for anchoring, confirmation bias, "
                    "availability bias, overconfidence, or premature closure."
                )
            elif mt == "pattern":
                focus_descriptions.append(
                    "PATTERN RECOGNITION: Identify recurring reasoning structures, "
                    "decision frameworks, or productive tensions between agents."
                )
            elif mt == "improvement_hypothesis":
                focus_descriptions.append(
                    "IMPROVEMENT HYPOTHESES: Generate specific, testable suggestions "
                    "for improving the swarm's reasoning (e.g., 'consider more "
                    "alternatives at step X')."
                )

        return (
            "Your previous analysis was good, but missed some areas. "
            "Please use observe_swarm_state again and focus specifically on:\n\n"
            + "\n\n".join(focus_descriptions)
            + "\n\nWrite additional insights using write_insight for each area above."
        )

    async def _detect_swarm_dynamics(self) -> None:
        """Detect high-level swarm dynamics from the graph structure.

        Looks for patterns that individual tool calls might miss:
        - Groupthink: All agents agree, no meaningful challenges
        - Productive tension: Contrarian created challenges that improved reasoning
        """
        all_nodes = await self.graph.get_session_nodes(self.session_id)
        if not all_nodes:
            return

        # Count challenges and supports from Contrarian
        contrarian_nodes = [
            n for n in all_nodes
            if n.get("agent") == AgentName.CONTRARIAN.value
        ]
        challenges = [n for n in contrarian_nodes if "CHALLENGE" in n.get("content", "")]
        supports = [n for n in contrarian_nodes if "SUPPORTS" in n.get("content", "")]

        # Check for groupthink: few challenges relative to reasoning nodes
        reasoning_nodes = [
            n for n in all_nodes
            if n.get("agent") == AgentName.DEEP_THINKER.value
        ]

        if reasoning_nodes and len(challenges) == 0 and len(supports) > 0:
            # All support, no challenges — possible groupthink
            already_flagged = any(
                i["insight_type"] == "groupthink" for i in self._insights
            )
            if not already_flagged:
                node = ReasoningNode(
                    agent=AgentName.METACOGNITION,
                    session_id=self.session_id,
                    content=(
                        "GROUPTHINK DETECTED: Contrarian agent created no challenges, "
                        "only supports. This may indicate the swarm converged too "
                        "quickly without genuine adversarial testing."
                    ),
                    reasoning="metacognitive_insight",
                    confidence=0.7,
                )
                node_id = await self.graph.add_node(node)
                self._node_ids.append(node_id)
                self._insights.append({
                    "insight_type": "groupthink",
                    "description": node.content,
                    "affected_agents": [AgentName.CONTRARIAN.value, AgentName.DEEP_THINKER.value],
                    "confidence": 0.7,
                })
                await self.bus.publish(
                    self.session_id,
                    MetacognitionInsight(
                        session_id=self.session_id,
                        insight_type="groupthink",
                        description=node.content,
                        affected_agents=[AgentName.CONTRARIAN.value, AgentName.DEEP_THINKER.value],
                    ),
                )

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def tool_observe_swarm_state(self, _inp: dict) -> str:
        """Read the full swarm state for meta-analysis."""
        all_nodes = await self.graph.get_session_nodes(self.session_id)

        if not all_nodes:
            return "No nodes in the graph yet. The swarm hasn't produced any reasoning."

        # Group by agent
        by_agent: dict[str, list[dict]] = {}
        for n in all_nodes:
            agent = n.get("agent", "unknown")
            by_agent.setdefault(agent, []).append(n)

        lines = [f"=== SWARM STATE ({len(all_nodes)} total nodes) ===\n"]

        for agent, nodes in sorted(by_agent.items()):
            lines.append(f"\n--- {agent.upper()} ({len(nodes)} nodes) ---")
            for n in nodes:
                node_id = n.get("id", "?")
                content = n.get("content", "")
                confidence = n.get("confidence", 0)
                reasoning = n.get("reasoning", "")
                dp_count = len(n.get("decision_points", []))

                lines.append(
                    f"\nNODE {node_id}"
                    f"\n  Type: {reasoning} | Confidence: {confidence:.2f}"
                    f" | Decision points: {dp_count}"
                    f"\n  Content: {content[:500]}"
                )

                # Include challenges targeting this node
                challenges = await self.graph.get_challenges_for(node_id)
                if challenges:
                    for c in challenges:
                        src = c["source_node"]
                        lines.append(
                            f"  >> CHALLENGED by {src.get('agent', '?')}: "
                            f"{src.get('content', '')[:200]}"
                        )

                # Include verifications targeting this node
                verifications = await self.graph.get_verifications_for(node_id)
                if verifications:
                    for v in verifications:
                        src = v["source_node"]
                        lines.append(
                            f"  >> VERIFIED by {src.get('agent', '?')}: "
                            f"{src.get('content', '')[:200]}"
                        )

        # Summary statistics
        lines.append("\n\n=== FOCUS AREAS FOR ANALYSIS ===")
        for area, desc in FOCUS_AREAS.items():
            lines.append(f"- {area}: {desc}")

        return "\n".join(lines)

    async def tool_write_insight(self, inp: dict) -> str:
        """Record a metacognitive insight and emit an event."""
        insight_type = inp.get("insight_type", "pattern")
        description = inp.get("description", "")
        affected_agents = inp.get("affected_agents", [])
        confidence = inp.get("confidence", 0.5)
        evidence_node_ids = inp.get("evidence_node_ids", [])

        # Create a reasoning node for the insight
        node = ReasoningNode(
            agent=AgentName.METACOGNITION,
            session_id=self.session_id,
            content=f"[{insight_type}] {description}",
            reasoning="metacognitive_insight",
            confidence=confidence,
        )
        node_id = await self.graph.add_node(node)
        self._node_ids.append(node_id)

        # Create OBSERVES edges to evidence nodes
        for evidence_id in evidence_node_ids:
            target = await self.graph.get_node(evidence_id)
            if target:
                edge = ReasoningEdge(
                    source_id=node_id,
                    target_id=evidence_id,
                    relation=EdgeRelation.OBSERVES,
                    weight=confidence,
                    metadata={"insight_type": insight_type},
                )
                await self.graph.add_edge(edge)

        # Store insight
        self._insights.append({
            "insight_type": insight_type,
            "description": description,
            "affected_agents": affected_agents,
            "confidence": confidence,
        })

        # Emit event for dashboard
        await self.bus.publish(
            self.session_id,
            MetacognitionInsight(
                session_id=self.session_id,
                insight_type=insight_type,
                description=description,
                affected_agents=affected_agents,
            ),
        )

        return (
            f"Insight recorded (type: {insight_type}, confidence: {confidence:.2f}). "
            f"Total insights: {len(self._insights)}"
        )
