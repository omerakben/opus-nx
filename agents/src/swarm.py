"""SwarmManager — coordinates agent lifecycle with staggered launches.

Orchestrates the full swarm pipeline:
  Phase 1: Primary agents (DeepThinker, Contrarian, Verifier) in parallel
  Phase 2: Synthesizer merges all results (sequential)
  Phase 3: Metacognition analyzes the swarm (sequential)

Uses asyncio.gather(return_exceptions=True) for partial results — NOT
asyncio.TaskGroup, which cancels ALL tasks when ANY fails.

Includes Maestro-like dynamic effort routing: classifies query complexity
using regex patterns ported from V1 orchestrator.ts (lines 33-47).

Rate limit strategy for Tier 2 (1,000 req/min, 80K input tokens/min):
- Stagger agent launches by settings.agent_stagger_seconds (default 2.5s)
- DeepThinker first (needs most time), Contrarian at +2.5s, Verifier at +5s
- Synthesizer and Metacognition run AFTER primaries (sequential)
"""

from __future__ import annotations

import asyncio
import re
import time
import uuid

import structlog
import structlog.contextvars

from .agents.base import BaseOpusAgent
from .agents.contrarian import ContrarianAgent
from .agents.deep_thinker import DeepThinkerAgent
from .agents.metacognition import MetacognitionAgent
from .agents.synthesizer import SynthesizerAgent
from .agents.verifier import VerifierAgent
from .config import Settings
from .events.bus import EventBus
from .events.types import SwarmStarted
from .graph.models import AgentResult, SwarmResult
from .graph.reasoning_graph import SharedReasoningGraph

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Complexity classification (ported from V1 orchestrator.ts lines 33-47)
# ---------------------------------------------------------------------------

COMPLEXITY_PATTERNS = {
    "simple": [
        re.compile(r"^(?:hi|hello|hey|thanks|thank you|ok|sure|yes|no)\b", re.IGNORECASE),
        re.compile(r"^(?:what (?:is|are)|who (?:is|are)|when (?:did|was|is))\b", re.IGNORECASE),
        re.compile(r"^(?:define|explain briefly|summarize)\b", re.IGNORECASE),
    ],
    "complex": [
        re.compile(r"(?:debug|troubleshoot|diagnose|fix (?:the|this|my))\b", re.IGNORECASE),
        re.compile(r"(?:architect|design|plan|strategy|analyze in depth)\b", re.IGNORECASE),
        re.compile(r"(?:compare and contrast|trade-?offs?|pros? and cons?)\b", re.IGNORECASE),
        re.compile(r"(?:research|investigate|deep dive|comprehensive)\b", re.IGNORECASE),
        re.compile(r"(?:step by step|multi-?step|workflow|pipeline)\b", re.IGNORECASE),
        re.compile(r"(?:refactor|optimize|improve performance)\b", re.IGNORECASE),
    ],
}

# Effort routing: simple -> medium, standard -> high, complex -> max
EFFORT_MAP = {
    "simple": "medium",
    "standard": "high",
    "complex": "max",
}


def classify_complexity(query: str) -> str:
    """Classify query complexity for dynamic effort routing.

    Returns: "simple", "standard", or "complex".
    """
    for pattern in COMPLEXITY_PATTERNS["simple"]:
        if pattern.search(query):
            return "simple"

    for pattern in COMPLEXITY_PATTERNS["complex"]:
        if pattern.search(query):
            return "complex"

    return "standard"


class SwarmManager:
    """Coordinates agent lifecycle with rate-limit-aware staggered launches.

    Key design decisions:
    - asyncio.gather(return_exceptions=True) for partial results
    - Per-agent timeout via asyncio.wait_for()
    - Staggered launches to respect Tier 2 rate limits
    - Sequential Phase 2/3 after parallel Phase 1
    """

    def __init__(
        self,
        settings: Settings,
        graph: SharedReasoningGraph,
        bus: EventBus,
    ) -> None:
        self.settings = settings
        self.graph = graph
        self.bus = bus

    async def run(self, query: str, session_id: str) -> dict:
        """Full swarm execution pipeline with partial result support.

        Phase 1: Deploy primary agents (parallel, staggered)
        Phase 2: Synthesizer merges results (sequential)
        Phase 3: Metacognition analyzes the swarm (sequential)
        """
        trace_id = str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        try:
            return await self._run_pipeline(query, session_id)
        finally:
            structlog.contextvars.unbind_contextvars("trace_id")

    async def _run_pipeline(self, query: str, session_id: str) -> dict:
        """Internal pipeline — runs inside trace_id context."""
        overall_start = time.monotonic()

        # Dynamic effort routing
        complexity = classify_complexity(query)
        effort = EFFORT_MAP[complexity]
        log.info(
            "swarm_starting",
            session_id=session_id,
            complexity=complexity,
            effort=effort,
        )

        # ---------------------------------------------------------------
        # Phase 1: Primary agents (parallel with staggered launches)
        # ---------------------------------------------------------------
        await self.bus.publish(
            session_id,
            SwarmStarted(
                session_id=session_id,
                agents=["deep_thinker", "contrarian", "verifier"],
                query=query,
            ),
        )

        api_key = self.settings.anthropic_api_key

        primary_agents: list[BaseOpusAgent] = [
            DeepThinkerAgent(self.graph, self.bus, session_id, api_key=api_key),
            ContrarianAgent(self.graph, self.bus, session_id, api_key=api_key),
            VerifierAgent(self.graph, self.bus, session_id, api_key=api_key),
        ]

        # Override effort based on complexity classification
        # DeepThinker always uses max; others use the classified effort
        primary_agents[0].effort = "max"  # DeepThinker always max
        primary_agents[1].effort = effort
        primary_agents[2].effort = effort

        async def run_staggered(agent: BaseOpusAgent, delay: float) -> AgentResult:
            """Launch an agent after a delay for rate limit management."""
            if delay > 0:
                await asyncio.sleep(delay)
            return await self._run_with_timeout(agent, query, session_id)

        # asyncio.gather with return_exceptions=True for partial results
        # If one agent fails, others still return their results
        stagger = self.settings.agent_stagger_seconds
        results = await asyncio.gather(
            *[
                run_staggered(agent, i * stagger)
                for i, agent in enumerate(primary_agents)
            ],
            return_exceptions=True,
        )

        agent_results: list[AgentResult] = []
        for agent, result in zip(primary_agents, results):
            if isinstance(result, BaseException):
                log.error(
                    "agent_error",
                    agent=agent.name.value,
                    error=str(result),
                )
                agent_results.append(
                    AgentResult(
                        agent=agent.name,
                        status="error",
                        reasoning=str(result),
                        conclusion="",
                        confidence=0.0,
                        tokens_used=0,
                        duration_ms=0,
                    )
                )
            else:
                agent_results.append(result)

        # ---------------------------------------------------------------
        # Phase 2: Synthesizer merges all results (sequential)
        # ---------------------------------------------------------------
        log.info("phase2_synthesis", session_id=session_id)
        synthesizer = SynthesizerAgent(self.graph, self.bus, session_id, api_key=api_key)
        synthesizer.effort = effort
        synthesis_result = await self._run_with_timeout(
            synthesizer, query, session_id
        )
        agent_results.append(synthesis_result)

        # ---------------------------------------------------------------
        # Phase 3: Metacognition analyzes the swarm (sequential)
        # ---------------------------------------------------------------
        log.info("phase3_metacognition", session_id=session_id)
        metacog = MetacognitionAgent(self.graph, self.bus, session_id, api_key=api_key)
        # Metacognition always uses max effort
        metacog.effort = "max"
        metacog_result = await self._run_with_timeout(
            metacog, query, session_id
        )
        agent_results.append(metacog_result)

        # ---------------------------------------------------------------
        # Build final result
        # ---------------------------------------------------------------
        total_tokens = sum(r.tokens_used for r in agent_results)
        total_duration = int((time.monotonic() - overall_start) * 1000)

        # Extract synthesis and metacognition insights
        synthesis_text = synthesis_result.conclusion if synthesis_result.status == "completed" else None
        metacognition_insights = []
        if metacog_result.status == "completed":
            metacognition_insights = [
                {"conclusion": metacog_result.conclusion}
            ]

        swarm_result = SwarmResult(
            session_id=session_id,
            query=query,
            agents=agent_results,
            synthesis=synthesis_text,
            metacognition_insights=metacognition_insights,
            total_tokens=total_tokens,
            total_duration_ms=total_duration,
        )

        log.info(
            "swarm_complete",
            session_id=session_id,
            total_tokens=total_tokens,
            total_duration_ms=total_duration,
            agent_count=len(agent_results),
            errors=sum(1 for r in agent_results if r.status == "error"),
        )

        result = swarm_result.model_dump()
        result["metacognition"] = metacog_result.model_dump()
        result["graph"] = self.graph.to_json()
        return result

    async def _run_with_timeout(
        self,
        agent: BaseOpusAgent,
        query: str,
        session_id: str,
    ) -> AgentResult:
        """Run an agent with a timeout. Returns an error AgentResult on timeout."""
        try:
            return await asyncio.wait_for(
                agent.run(query),
                timeout=self.settings.agent_timeout_seconds,
            )
        except asyncio.TimeoutError:
            log.warning(
                "agent_timeout",
                agent=agent.name.value,
                timeout_seconds=self.settings.agent_timeout_seconds,
            )
            return AgentResult(
                agent=agent.name,
                status="timeout",
                reasoning="Agent timed out",
                conclusion="",
                confidence=0.0,
                tokens_used=0,
                duration_ms=self.settings.agent_timeout_seconds * 1000,
            )
        except Exception as exc:
            log.error(
                "agent_exception",
                agent=agent.name.value,
                error=str(exc),
            )
            return AgentResult(
                agent=agent.name,
                status="error",
                reasoning=str(exc),
                conclusion="",
                confidence=0.0,
                tokens_used=0,
                duration_ms=0,
            )
