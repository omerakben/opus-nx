"""Deep Thinker agent — maximum reasoning depth.

Uses Opus 4.6's full adaptive thinking (effort: "max") to provide
the deepest, most thorough analysis. Writes structured reasoning
to the shared graph for other agents to read and challenge.

Ports from V1:
- Decision point regex patterns (think-graph.ts, lines 160-178)
- Confidence scoring (think-graph.ts, lines 517-581)
"""

from __future__ import annotations

import re
import time

from ..events.types import GraphNodeCreated
from ..graph.models import AgentName, AgentResult, EdgeRelation, ReasoningEdge, ReasoningNode
from ..graph.reasoning_graph import SharedReasoningGraph
from ..events.bus import EventBus
from .base import BaseOpusAgent

# ---------------------------------------------------------------------------
# Decision point regex patterns (ported from think-graph.ts lines 160-178)
# Opus 4.6 returns summarized thinking, so patterns handle both verbose
# reasoning and concise summaries.
# ---------------------------------------------------------------------------
DECISION_PATTERNS = [
    # Explicit decisions (verbose & summarized forms)
    re.compile(r"(?:I (?:could|should|will|might|need to) (?:either|choose|decide|go with|opt for|select))", re.IGNORECASE),
    re.compile(r"(?:(?:Option|Approach|Alternative|Choice|Path|Strategy|Method) [A-C1-5])", re.IGNORECASE),
    re.compile(r"(?:On (?:one|the other) hand)", re.IGNORECASE),
    # Summarized decision language (Opus 4.6 summarized thinking)
    re.compile(r"(?:(?:Decided|Choosing|Selected|Opted) (?:to|for|between))", re.IGNORECASE),
    re.compile(r"(?:(?:Weigh(?:ing|ed)|Evaluat(?:ing|ed)|Compar(?:ing|ed)) (?:the |several |multiple )?(?:options|approaches|strategies|alternatives|trade-?offs))", re.IGNORECASE),
    re.compile(r"(?:(?:Key|Main|Primary|Critical) (?:decision|choice|trade-?off|consideration))", re.IGNORECASE),
    # Comparisons
    re.compile(r"(?:(?:vs|versus|compared to|rather than|instead of|over|between))", re.IGNORECASE),
    # Trade-offs
    re.compile(r"(?:(?:trade-?off|pros? and cons?|advantages? (?:and|vs) disadvantages?|benefits? (?:and|vs) (?:costs?|drawbacks?)))", re.IGNORECASE),
    # Conclusions (verbose & summarized)
    re.compile(r"(?:(?:I(?:'ll| will) go with|I(?:'ve| have) decided|The best (?:approach|option|choice)|Therefore|Thus|Hence))", re.IGNORECASE),
    re.compile(r"(?:(?:Concluded|Determined|Settled on|Final (?:decision|choice|approach)))", re.IGNORECASE),
    # Rejection markers (verbose & summarized)
    re.compile(r"(?:(?:However|But|Although|While|rejected|ruled out|not (?:ideal|suitable|appropriate)))", re.IGNORECASE),
    re.compile(r"(?:(?:Eliminated|Discarded|Dismissed|Ruled against|Rejected (?:due to|because)))", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Confidence indicators (ported from think-graph.ts lines 187-203)
# ---------------------------------------------------------------------------
CONFIDENCE_INDICATORS = {
    "high": [
        re.compile(r"(?:certainly|definitely|clearly|undoubtedly|absolutely|confident|sure)", re.IGNORECASE),
        re.compile(r"(?:strong evidence|conclusive|proven|established|well-supported)", re.IGNORECASE),
        re.compile(r"(?:high confidence|very likely|overwhelmingly|robustly)", re.IGNORECASE),
    ],
    "medium": [
        re.compile(r"(?:likely|probably|reasonable|plausible|suggests)", re.IGNORECASE),
        re.compile(r"(?:based on|indicates|appears to|seems to)", re.IGNORECASE),
        re.compile(r"(?:moderate confidence|fairly confident|reasonable certainty|on balance)", re.IGNORECASE),
    ],
    "low": [
        re.compile(r"(?:uncertain|unclear|might|could|possibly|perhaps)", re.IGNORECASE),
        re.compile(r"(?:unsure|ambiguous|questionable|tentative)", re.IGNORECASE),
        re.compile(r"(?:low confidence|insufficient evidence|speculative|inconclusive|needs? (?:more|further) (?:analysis|investigation|data))", re.IGNORECASE),
    ],
}

# ---------------------------------------------------------------------------
# Tool definitions (SPEC 7)
# ---------------------------------------------------------------------------
DEEP_THINKER_TOOLS = [
    {
        "name": "write_reasoning_node",
        "description": "Write a reasoning step to the shared graph. Other agents will read this.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The reasoning step or conclusion"},
                "confidence": {"type": "number", "description": "Confidence 0.0-1.0"},
                "reasoning_type": {
                    "type": "string",
                    "enum": ["analysis", "hypothesis", "conclusion", "assumption", "evidence"],
                },
            },
            "required": ["content", "confidence"],
        },
    },
    {
        "name": "mark_decision_point",
        "description": "Flag a critical decision point where multiple valid paths exist.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {"type": "string"},
                "alternatives": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "chosen_path": {"type": "string"},
                "rationale": {"type": "string"},
            },
            "required": ["description", "alternatives", "chosen_path"],
        },
    },
    {
        "name": "read_graph_context",
        "description": "Read what other agents have written to the shared graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_filter": {
                    "type": "string",
                    "enum": ["deep_thinker", "contrarian", "verifier", "synthesizer", "metacognition"],
                },
            },
        },
    },
]

SYSTEM_PROMPT = """You are Deep Thinker, an analytical reasoning specialist within the Opus NX swarm.
Your role is to provide the deepest, most thorough analysis of the user's question.

APPROACH:
- Break the problem into fundamental components
- Consider multiple perspectives and frameworks
- Identify key assumptions and their implications
- Trace cause-and-effect chains to their conclusions
- Quantify uncertainty where possible

OUTPUT:
Use the write_reasoning_node tool to persist your key reasoning steps to the shared graph.
Use the mark_decision_point tool when you identify a critical juncture where multiple paths exist.

Other agents in the swarm (Contrarian, Verifier) will read your reasoning and respond to it.
Write clearly so they can engage with your logic."""


def calculate_confidence_score(text: str) -> float:
    """Calculate a confidence score based on language indicators.

    Ported from think-graph.ts lines 517-581. Factors in text length,
    decision points, and produces varied scores across the full range.
    """
    if not text:
        return 0.5

    high_count = 0
    medium_count = 0
    low_count = 0

    for pattern in CONFIDENCE_INDICATORS["high"]:
        high_count += len(pattern.findall(text))
    for pattern in CONFIDENCE_INDICATORS["medium"]:
        medium_count += len(pattern.findall(text))
    for pattern in CONFIDENCE_INDICATORS["low"]:
        low_count += len(pattern.findall(text))

    total = high_count + medium_count + low_count

    # Base score from language indicators
    if total == 0:
        text_len = len(text)
        if text_len > 2000:
            score = 0.65  # Long thorough reasoning
        elif text_len > 500:
            score = 0.55
        else:
            score = 0.45
    else:
        score = (high_count * 0.88 + medium_count * 0.58 + low_count * 0.28) / total

    # Factor in reasoning depth
    depth_bonus = min(0.08, len(text) / 50000)
    score += depth_bonus

    # Factor in decision points found
    decision_matches = re.findall(
        r"(?:decided|choosing|selected|opted|therefore|thus|hence|concluded)",
        text,
        re.IGNORECASE,
    )
    if decision_matches:
        score += min(0.05, len(decision_matches) * 0.015)

    # Deterministic jitter based on text hash for visual variety
    hash_val = 0
    for ch in text[:200]:
        hash_val = ((hash_val << 5) - hash_val + ord(ch)) & 0xFFFFFFFF
    jitter = ((hash_val % 100) / 100) * 0.12 - 0.06
    score += jitter

    # Clamp to valid range, never return exactly 0.5
    score = max(0.15, min(0.95, score))
    if abs(score - 0.5) < 0.03:
        score += 0.08 if hash_val % 2 == 0 else -0.08

    return round(score, 2)


def extract_decision_points(text: str) -> list[dict]:
    """Extract decision points from reasoning text using regex patterns.

    Ported from think-graph.ts lines 160-178.
    """
    points: list[dict] = []
    sentences = re.split(r"[.!?]\s+", text)

    for sentence in sentences:
        for pattern in DECISION_PATTERNS:
            if pattern.search(sentence):
                points.append({
                    "text": sentence.strip(),
                    "pattern": pattern.pattern,
                })
                break  # One match per sentence is enough

    return points


class DeepThinkerAgent(BaseOpusAgent):
    """Maximum thinking depth for thorough analysis.

    Effort: max — uses Opus 4.6's full adaptive thinking.
    Writes structured reasoning nodes to the shared graph.
    """

    name = AgentName.DEEP_THINKER
    effort = "max"
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
        self._previous_node_id: str | None = None

    def get_tools(self) -> list[dict]:
        return DEEP_THINKER_TOOLS

    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Execute deep analysis of the query."""
        start = time.monotonic()
        self._original_query = query
        await self.emit_started()

        messages = [{"role": "user", "content": query}]

        result = await self.run_tool_loop(messages, self.get_tools())

        # Calculate confidence from the full thinking + response
        full_text = result["thinking"] + " " + result["text"]
        confidence = calculate_confidence_score(full_text)

        duration_ms = int((time.monotonic() - start) * 1000)

        await self.emit_completed(
            conclusion=result["text"],
            confidence=confidence,
            tokens_used=result["tokens_used"],
        )

        return AgentResult(
            agent=self.name,
            status="completed",
            reasoning=result["thinking"],
            conclusion=result["text"],
            confidence=confidence,
            node_ids=self._node_ids,
            tokens_used=result["tokens_used"],
            input_tokens_used=result.get("input_tokens_used", 0),
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def tool_write_reasoning_node(self, inp: dict) -> str:
        """Write a reasoning step to the shared graph."""
        content = inp.get("content", "")
        confidence = inp.get("confidence", 0.5)
        reasoning_type = inp.get("reasoning_type", "analysis")

        # Extract decision points from the content
        decision_points = extract_decision_points(content)

        node = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id=self.session_id,
            content=content,
            reasoning=reasoning_type,
            confidence=confidence,
            decision_points=decision_points,
            input_query=self._original_query if len(self._node_ids) == 0 else None,
        )

        node_id = await self.graph.add_node(node)
        self._node_ids.append(node_id)

        # Create LEADS_TO edge from previous node
        if self._previous_node_id:
            edge = ReasoningEdge(
                source_id=self._previous_node_id,
                target_id=node_id,
                relation=EdgeRelation.LEADS_TO,
                weight=confidence,
            )
            await self.graph.add_edge(edge)

        self._previous_node_id = node_id

        # Emit event for dashboard
        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=node_id,
                agent=self.name.value,
                content_preview=content,
            ),
        )

        return f"Node {node_id} written to graph (confidence: {confidence}, type: {reasoning_type}, decision_points: {len(decision_points)})"

    async def tool_mark_decision_point(self, inp: dict) -> str:
        """Flag a critical decision point in the reasoning."""
        description = inp.get("description", "")
        alternatives = inp.get("alternatives", [])
        chosen_path = inp.get("chosen_path", "")
        rationale = inp.get("rationale", "")

        content = (
            f"DECISION: {description}\n"
            f"Alternatives: {', '.join(alternatives)}\n"
            f"Chosen: {chosen_path}\n"
            f"Rationale: {rationale}"
        )

        node = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id=self.session_id,
            content=content,
            reasoning="decision_point",
            confidence=0.8,
            decision_points=[{
                "description": description,
                "alternatives": alternatives,
                "chosen_path": chosen_path,
                "rationale": rationale,
            }],
        )

        node_id = await self.graph.add_node(node)
        self._node_ids.append(node_id)

        if self._previous_node_id:
            edge = ReasoningEdge(
                source_id=self._previous_node_id,
                target_id=node_id,
                relation=EdgeRelation.LEADS_TO,
                weight=0.8,
            )
            await self.graph.add_edge(edge)

        self._previous_node_id = node_id

        await self.bus.publish(
            self.session_id,
            GraphNodeCreated(
                session_id=self.session_id,
                node_id=node_id,
                agent=self.name.value,
                content_preview=f"DECISION: {description}",
            ),
        )

        return f"Decision point {node_id} recorded: {description[:100]}"

    async def tool_read_graph_context(self, inp: dict) -> str:
        """Read what other agents have written to the shared graph."""
        agent_filter = inp.get("agent_filter")

        if agent_filter:
            try:
                agent_name = AgentName(agent_filter)
            except ValueError:
                return f"Unknown agent: {agent_filter}"
            nodes = await self.graph.get_nodes_by_agent(agent_name)
        else:
            nodes = await self.graph.get_session_nodes(self.session_id)

        if not nodes:
            return "No nodes found in the graph yet."

        lines = []
        for n in nodes:
            lines.append(
                f"[{n.get('agent', '?')}] (confidence: {n.get('confidence', 0):.2f}) "
                f"{n.get('content', '')[:200]}"
            )
        return "\n\n".join(lines)
