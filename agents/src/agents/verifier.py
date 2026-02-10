"""Verifier agent — Process Reward Model (PRM) scoring.

Scores each reasoning step independently using the PRM approach from
"Let's Verify Step by Step" (Lightman et al., 2023). Creates VERIFIES
edges in the shared graph.

Effort: "high" — needs careful analysis to produce reliable verdicts.

Ports from V1:
- Verdict types (prm-verifier.ts lines 25-30)
- Issue types (prm-verifier.ts lines 48-57)
- Geometric mean scoring (prm-verifier.ts lines 326-356)
- Pattern detection (prm-verifier.ts lines 362-417)
"""

from __future__ import annotations

import time

from ..events.bus import EventBus
from ..events.types import GraphNodeCreated, VerificationScore
from ..graph.models import (
    AgentName,
    AgentResult,
    EdgeRelation,
    ReasoningEdge,
    ReasoningNode,
)
from ..graph.reasoning_graph import SharedReasoningGraph
from ..tools.verification import compute_chain_score, detect_patterns
from .base import BaseOpusAgent

# ---------------------------------------------------------------------------
# Tool definitions (SPEC 9)
# ---------------------------------------------------------------------------
VERIFIER_TOOLS = [
    {
        "name": "read_reasoning_chain",
        "description": "Read reasoning nodes from the shared graph. Optionally filter by agent.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_filter": {
                    "type": "string",
                    "enum": ["deep_thinker", "contrarian", "synthesizer", "metacognition"],
                    "description": "Filter to a specific agent's nodes (optional — omit to read all session nodes)",
                },
            },
        },
    },
    {
        "name": "verify_reasoning_step",
        "description": (
            "Verify a single reasoning step. Verdict: correct, incorrect, "
            "neutral, or uncertain. Issues: logical_error, factual_error, "
            "missing_context, unsupported_claim, circular_reasoning, "
            "non_sequitur, overgeneralization, false_dichotomy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "string",
                    "description": "ID of the reasoning node being verified",
                },
                "verdict": {
                    "type": "string",
                    "enum": ["correct", "incorrect", "neutral", "uncertain"],
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence in the verdict (0.0-1.0)",
                },
                "explanation": {
                    "type": "string",
                    "description": "Brief explanation for the verdict",
                },
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": [
                                    "logical_error",
                                    "factual_error",
                                    "missing_context",
                                    "unsupported_claim",
                                    "circular_reasoning",
                                    "non_sequitur",
                                    "overgeneralization",
                                    "false_dichotomy",
                                ],
                            },
                            "description": {"type": "string"},
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "major", "minor"],
                            },
                        },
                        "required": ["type", "description", "severity"],
                    },
                    "description": "Specific issues found (if verdict is incorrect)",
                },
            },
            "required": ["node_id", "verdict", "confidence", "explanation"],
        },
    },
    {
        "name": "emit_verification",
        "description": "Emit the final chain verification result with overall score and patterns.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Summary of the verification findings",
                },
            },
            "required": ["summary"],
        },
    },
]

SYSTEM_PROMPT = """You are Verifier, the Process Reward Model (PRM) within the Opus NX swarm.
Your role is to evaluate each reasoning step independently for correctness.

APPROACH (based on "Let's Verify Step by Step"):
- Read the full reasoning chain using read_reasoning_chain
- Verify EACH node individually using verify_reasoning_step
- Be precise: a chain is only as strong as its weakest step
- Look for: logical errors, factual mistakes, unsupported claims, circular reasoning
- Judge each step on its own merits, not by the final conclusion

VERDICTS:
- correct: Step is logically sound and well-supported
- incorrect: Step contains a clear error (specify the issue type)
- neutral: Step is neither clearly correct nor incorrect
- uncertain: Cannot determine correctness with available information

After verifying all steps, use emit_verification to produce your overall assessment.

The Contrarian agent may have created challenges. Verify both the original reasoning
AND the challenges — the Contrarian can be wrong too."""


class VerifierAgent(BaseOpusAgent):
    """PRM agent that scores reasoning steps and creates VERIFIES edges.

    Effort: high. Reads reasoning chains, scores each step, detects patterns.
    """

    name = AgentName.VERIFIER
    effort = "high"
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
        self._step_scores: list[dict] = []

    def get_tools(self) -> list[dict]:
        return VERIFIER_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Verify reasoning chains from other agents."""
        start = time.monotonic()
        await self.emit_started()

        messages = [
            {
                "role": "user",
                "content": (
                    f"The swarm is analyzing: {query}\n\n"
                    "Use read_reasoning_chain to read the deep_thinker's reasoning. "
                    "Then verify each reasoning step using verify_reasoning_step. "
                    "Also read the contrarian's reasoning and verify their challenges. "
                    "Finally, use emit_verification to produce your overall assessment."
                ),
            },
        ]

        result = await self.run_tool_loop(messages, self.get_tools())

        # Compute overall score from step scores
        chain_score = compute_chain_score(self._step_scores) if self._step_scores else 0.5

        duration_ms = int((time.monotonic() - start) * 1000)

        conclusion = result["text"] or (
            f"Verified {len(self._step_scores)} steps. "
            f"Chain score: {chain_score:.2f}"
        )

        await self.emit_completed(
            conclusion=conclusion,
            confidence=chain_score,
            tokens_used=result["tokens_used"],
        )

        return AgentResult(
            agent=self.name,
            status="completed",
            reasoning=result["thinking"],
            conclusion=conclusion,
            confidence=chain_score,
            node_ids=self._node_ids,
            tokens_used=result["tokens_used"],
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def tool_read_reasoning_chain(self, inp: dict) -> str:
        """Read reasoning nodes from the graph, optionally filtered by agent."""
        agent_filter = inp.get("agent_filter")

        if agent_filter:
            try:
                agent_name = AgentName(agent_filter)
            except ValueError:
                return f"Unknown agent: {agent_filter}"
            nodes = await self.graph.get_nodes_by_agent(agent_name)
            if not nodes:
                return f"No reasoning nodes from {agent_filter} yet."
        else:
            nodes = await self.graph.get_session_nodes(self.session_id)
            if not nodes:
                return "No reasoning nodes in this session yet."

        lines = []
        for i, n in enumerate(nodes):
            node_id = n.get("id", "?")
            content = n.get("content", "")
            confidence = n.get("confidence", 0)
            reasoning_type = n.get("reasoning", "unknown")
            agent = n.get("agent", "unknown")

            # Check for existing challenges
            challenges = await self.graph.get_challenges_for(node_id)
            challenge_info = ""
            if challenges:
                challenge_info = f"\n  Challenges: {len(challenges)} — " + "; ".join(
                    c["source_node"].get("content", "")[:100] for c in challenges
                )

            lines.append(
                f"STEP {i} — NODE {node_id} (agent: {agent})\n"
                f"  Type: {reasoning_type} | Confidence: {confidence:.2f}\n"
                f"  Content: {content}{challenge_info}"
            )
        return "\n\n".join(lines)

    async def tool_verify_reasoning_step(self, inp: dict) -> str:
        """Verify a single reasoning step and create a VERIFIES edge."""
        node_id = inp.get("node_id", "")
        verdict = inp.get("verdict", "uncertain")
        confidence = inp.get("confidence", 0.5)
        explanation = inp.get("explanation", "")
        issues = inp.get("issues", [])

        # Verify target node exists
        target = await self.graph.get_node(node_id)
        if not target:
            return f"Node {node_id} not found in graph."

        # Record step score for chain scoring
        step_score = {
            "node_id": node_id,
            "verdict": verdict,
            "confidence": confidence,
            "explanation": explanation,
            "issues": issues,
        }
        self._step_scores.append(step_score)

        # Create verification node
        verification_node = ReasoningNode(
            agent=AgentName.VERIFIER,
            session_id=self.session_id,
            content=(
                f"VERIFICATION ({verdict}, confidence: {confidence:.2f}): "
                f"{explanation}"
            ),
            reasoning="verification",
            confidence=confidence,
        )
        v_id = await self.graph.add_node(verification_node)
        self._node_ids.append(v_id)

        # Create VERIFIES edge
        edge = ReasoningEdge(
            source_id=v_id,
            target_id=node_id,
            relation=EdgeRelation.VERIFIES,
            weight=confidence,
            metadata={
                "verdict": verdict,
                "explanation": explanation,
                "issues": issues,
            },
        )
        await self.graph.add_edge(edge)

        # Emit verification score event for dashboard
        await self.bus.publish(
            self.session_id,
            VerificationScore(
                session_id=self.session_id,
                node_id=node_id,
                score=confidence,
                verdict=verdict,
            ),
        )

        issue_summary = ""
        if issues:
            issue_summary = " Issues: " + ", ".join(
                f"{iss.get('type')} ({iss.get('severity')})" for iss in issues
            )

        return (
            f"Step scored: {verdict} (confidence: {confidence:.2f}). "
            f"{explanation}{issue_summary}"
        )

    async def tool_emit_verification(self, inp: dict) -> str:
        """Emit the final chain verification result."""
        summary = inp.get("summary", "")

        chain_score = compute_chain_score(self._step_scores)
        patterns = detect_patterns(self._step_scores)

        # Determine overall validity
        incorrect_count = sum(
            1 for s in self._step_scores if s.get("verdict") == "incorrect"
        )
        is_valid = chain_score >= 0.7 and incorrect_count == 0

        # Find first error
        first_error = -1
        for i, s in enumerate(self._step_scores):
            if s.get("verdict") == "incorrect":
                first_error = i
                break

        # Create summary node
        summary_content = (
            f"CHAIN VERIFICATION: score={chain_score:.2f}, "
            f"valid={is_valid}, steps={len(self._step_scores)}, "
            f"errors={incorrect_count}"
        )
        if patterns:
            pattern_names = [p["name"] for p in patterns]
            summary_content += f", patterns=[{', '.join(pattern_names)}]"
        summary_content += f"\n{summary}"

        summary_node = ReasoningNode(
            agent=AgentName.VERIFIER,
            session_id=self.session_id,
            content=summary_content,
            reasoning="chain_verification",
            confidence=chain_score,
        )
        s_id = await self.graph.add_node(summary_node)
        self._node_ids.append(s_id)

        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=s_id,
                agent=self.name.value,
                content_preview=f"Chain score: {chain_score:.2f} ({len(self._step_scores)} steps)",
            ),
        )

        pattern_info = ""
        if patterns:
            pattern_info = "\nPatterns detected:\n" + "\n".join(
                f"  - {p['name']}: {p['description']}" for p in patterns
            )

        return (
            f"Chain verification complete. Score: {chain_score:.2f}, "
            f"Valid: {is_valid}, Steps: {len(self._step_scores)}, "
            f"Errors: {incorrect_count}, First error at: {first_error}"
            f"{pattern_info}"
        )
