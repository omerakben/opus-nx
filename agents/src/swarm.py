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
import json
import hashlib
import re
import time
import uuid
from datetime import datetime, timezone

import structlog
import structlog.contextvars

from .agents.base import BaseOpusAgent
from .agents.contrarian import ContrarianAgent
from .agents.deep_thinker import DeepThinkerAgent
from .agents.maestro import MaestroAgent
from .agents.metacognition import MetacognitionAgent
from .agents.synthesizer import SynthesizerAgent
from .agents.verifier import VerifierAgent
from .config import Settings
from .events.bus import EventBus
from .events.types import SwarmStarted
from .graph.models import AgentResult, SwarmResult
from .graph.reasoning_graph import SharedReasoningGraph
from .persistence.supabase_sync import SupabasePersistence

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
        persistence: SupabasePersistence | None = None,
    ) -> None:
        self.settings = settings
        self.graph = graph
        self.bus = bus
        self.persistence = persistence
        self._rehydration_total = 0
        self._rehydration_hits = 0
        self._rehydration_selected_total = 0

    def _parse_timestamp(self, value: object) -> datetime | None:
        if not isinstance(value, str):
            return None
        raw = value.strip()
        if not raw:
            return None
        normalized = raw.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None

    def _recency_score(self, timestamp: datetime | None) -> float:
        if timestamp is None:
            return 0.5
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        age_seconds = max(0.0, (datetime.now(timezone.utc) - timestamp).total_seconds())
        age_days = age_seconds / 86400.0
        return max(0.0, min(1.0, 1.0 - (age_days / 30.0)))

    def _compute_candidate_score(
        self,
        *,
        similarity: float,
        importance: float,
        recency: float,
        retained_policy_bonus: float,
    ) -> float:
        return (
            0.60 * similarity
            + 0.25 * importance
            + 0.10 * recency
            + 0.05 * retained_policy_bonus
        )

    async def _build_reasoning_rehydration_context(
        self,
        query: str,
        session_id: str,
    ) -> str:
        """Retrieve semantically similar reasoning artifacts for query rehydration."""
        if self.persistence is None:
            return ""

        embed_started = time.monotonic()
        query_embedding = await self.persistence.generate_reasoning_embedding(query)
        log.info(
            "rehydration_phase",
            phase="embed_generation",
            session_id=session_id,
            duration_ms=int((time.monotonic() - embed_started) * 1000),
            success=bool(query_embedding),
        )
        if not query_embedding:
            return ""

        semantic_started = time.monotonic()
        try:
            artifact_task = self.persistence.search_reasoning_artifacts(
                query_embedding,
                match_threshold=0.68,
                match_count=12,
                filter_artifact_type=None,
            )
            search_hypotheses = getattr(
                self.persistence,
                "search_structured_reasoning_hypotheses_semantic",
                None,
            )
            if callable(search_hypotheses):
                maybe_task = search_hypotheses(
                    query_embedding,
                    match_threshold=0.68,
                    match_count=12,
                )
                if asyncio.iscoroutine(maybe_task):
                    hypothesis_task = maybe_task
                else:
                    hypothesis_task = asyncio.sleep(0, result=[])
            else:
                hypothesis_task = asyncio.sleep(0, result=[])
            artifact_matches, hypothesis_matches = await asyncio.gather(
                artifact_task,
                hypothesis_task,
            )
        except Exception as exc:
            log.warning(
                "reasoning_rehydration_search_failed",
                session_id=session_id,
                error=str(exc),
            )
            return ""
        log.info(
            "rehydration_phase",
            phase="semantic_search",
            session_id=session_id,
            duration_ms=int((time.monotonic() - semantic_started) * 1000),
            artifact_candidates=len(artifact_matches),
            hypothesis_candidates=len(hypothesis_matches),
        )

        if not artifact_matches and not hypothesis_matches:
            return ""

        selection_started = time.monotonic()
        candidates: list[dict[str, object]] = []

        for row in artifact_matches:
            content = str(row.get("content") or "").strip()
            if not content:
                continue
            similarity = float(row.get("similarity") or 0.0)
            importance = float(row.get("importance_score") or 0.0)
            source_session = str(row.get("session_id") or "unknown")
            retained_bonus = 0.0
            snapshot = row.get("snapshot")
            if isinstance(snapshot, dict):
                if str(snapshot.get("retention_decision") or "") == "retain":
                    retained_bonus = 1.0
            recency = self._recency_score(
                self._parse_timestamp(row.get("updated_at"))
                or self._parse_timestamp(row.get("created_at"))
                or self._parse_timestamp(row.get("last_used_at"))
            )
            score = self._compute_candidate_score(
                similarity=similarity,
                importance=importance,
                recency=recency,
                retained_policy_bonus=retained_bonus,
            )
            text_hash = hashlib.md5(content.lower().encode("utf-8")).hexdigest()
            candidates.append(
                {
                    "source": "artifact",
                    "id": str(row.get("id") or ""),
                    "session_id": source_session,
                    "text": content,
                    "text_hash": text_hash,
                    "similarity": similarity,
                    "importance": importance,
                    "recency": recency,
                    "retained_policy_bonus": retained_bonus,
                    "score": score,
                }
            )

        for row in hypothesis_matches:
            hypothesis_text = str(row.get("hypothesis_text") or "").strip()
            if not hypothesis_text:
                continue
            source_session = str(row.get("session_id") or "unknown")
            similarity = float(row.get("similarity") or 0.0)
            importance = float(
                row.get("importance_score")
                or row.get("confidence")
                or 0.5
            )
            retained_bonus = float(row.get("retained_policy_bonus") or 0.0)
            recency = self._recency_score(self._parse_timestamp(row.get("created_at")))
            score = self._compute_candidate_score(
                similarity=similarity,
                importance=importance,
                recency=recency,
                retained_policy_bonus=retained_bonus,
            )
            text_hash = str(row.get("hypothesis_text_hash") or "").strip() or hashlib.md5(
                hypothesis_text.lower().encode("utf-8")
            ).hexdigest()
            candidates.append(
                {
                    "source": "hypothesis",
                    "id": str(row.get("hypothesis_id") or ""),
                    "session_id": source_session,
                    "text": hypothesis_text,
                    "text_hash": text_hash,
                    "similarity": similarity,
                    "importance": importance,
                    "recency": recency,
                    "retained_policy_bonus": retained_bonus,
                    "score": score,
                }
            )

        deduped: dict[str, dict[str, object]] = {}
        for candidate in candidates:
            key = f"{candidate['session_id']}:{candidate['text_hash']}"
            existing = deduped.get(key)
            if existing is None or float(candidate["score"]) > float(existing["score"]):
                deduped[key] = candidate

        ranked = sorted(
            deduped.values(),
            key=lambda item: float(item["score"]),
            reverse=True,
        )

        cross_session_ranked = [
            item
            for item in ranked
            if str(item.get("session_id") or "") != session_id
        ]
        selected_rows = (cross_session_ranked or ranked)[:4]

        lines: list[str] = []
        selected_artifact_ids: list[str] = []
        for idx, row in enumerate(selected_rows, start=1):
            content = str(row.get("text") or "").strip()
            if not content:
                continue
            source = str(row.get("source") or "artifact")
            source_session = str(row.get("session_id") or "unknown")
            similarity = float(row.get("similarity") or 0.0)
            importance = float(row.get("importance") or 0.0)
            recency = float(row.get("recency") or 0.0)
            retained_bonus = float(row.get("retained_policy_bonus") or 0.0)
            score = float(row.get("score") or 0.0)
            row_id = str(row.get("id") or "")
            if source == "artifact" and row_id:
                selected_artifact_ids.append(row_id)
            excerpt = content[:420] + ("..." if len(content) > 420 else "")
            lines.append(
                f"{idx}. source={source} session={source_session} score={score:.3f} "
                f"(sim={similarity:.2f} imp={importance:.2f} recency={recency:.2f} retain={retained_bonus:.2f})\n{excerpt}"
            )

        log.info(
            "rehydration_phase",
            phase="candidate_selection",
            session_id=session_id,
            duration_ms=int((time.monotonic() - selection_started) * 1000),
            total_candidates=len(candidates),
            deduped_candidates=len(ranked),
            selected_candidates=len(lines),
        )

        if not lines:
            return ""

        audit_started = time.monotonic()
        try:
            await asyncio.gather(
                *[
                    self.persistence.mark_reasoning_artifact_used(artifact_id)
                    for artifact_id in selected_artifact_ids
                ],
                return_exceptions=True,
            )
            await self.persistence.create_session_rehydration_run(
                session_id=session_id,
                query_text=query,
                query_embedding=query_embedding,
                selected_artifact_ids=selected_artifact_ids,
                candidate_count=len(candidates),
                metadata={
                    "source": "swarm_v2",
                    "selected_count": len(lines),
                    "selected_artifact_count": len(selected_artifact_ids),
                    "artifact_candidates": len(artifact_matches),
                    "hypothesis_candidates": len(hypothesis_matches),
                    "deduped_candidate_count": len(ranked),
                },
            )
        except Exception as exc:
            log.warning(
                "reasoning_rehydration_audit_failed",
                session_id=session_id,
                error=str(exc),
            )
        else:
            log.info(
                "rehydration_phase",
                phase="rehydration_audit_write",
                session_id=session_id,
                duration_ms=int((time.monotonic() - audit_started) * 1000),
                selected_artifacts=len(selected_artifact_ids),
            )

        self._rehydration_total += 1
        self._rehydration_selected_total += len(lines)
        if lines:
            self._rehydration_hits += 1
        hit_rate = self._rehydration_hits / max(1, self._rehydration_total)
        avg_selected = self._rehydration_selected_total / max(1, self._rehydration_total)
        log.info(
            "rehydration_metrics",
            session_id=session_id,
            hit_rate=round(hit_rate, 4),
            avg_selected_candidates=round(avg_selected, 4),
            total_runs=self._rehydration_total,
        )

        return (
            "Prior reasoning artifacts and hypotheses (semantic matches). "
            "Use as hypotheses/evidence, and verify before adopting:\n"
            + "\n\n".join(lines)
        )

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

        api_key = self.settings.anthropic_api_key
        rehydration_context = await self._build_reasoning_rehydration_context(
            query,
            session_id,
        )
        swarm_query = query
        if rehydration_context:
            swarm_query = (
                f"{query}\n\n{rehydration_context}\n\n"
                "Treat retrieved artifacts as prior hypotheses. Verify, refine, or reject."
            )
            log.info(
                "reasoning_rehydration_applied",
                session_id=session_id,
                context_length=len(rehydration_context),
            )

        # ---------------------------------------------------------------
        # Phase 0: Maestro — fast query decomposition & agent routing
        # Falls back to regex classification if Maestro times out/errors
        # ---------------------------------------------------------------
        deployment_plan = await self._run_maestro(swarm_query, session_id, api_key)

        # Extract selected agents and effort assignments from the plan
        selected_agent_names = deployment_plan.get("agents", [])
        effort_map = {
            a["name"]: a["effort"]
            for a in selected_agent_names
        } if selected_agent_names else {}

        # Build the agent name list for SwarmStarted
        agent_names_for_event = [a["name"] for a in selected_agent_names] if selected_agent_names else ["deep_thinker", "contrarian", "verifier"]

        # Fallback effort from regex classification (used when Maestro fails)
        complexity = classify_complexity(query)
        fallback_effort = EFFORT_MAP[complexity]

        log.info(
            "swarm_starting",
            session_id=session_id,
            complexity=complexity,
            maestro_plan=bool(selected_agent_names),
            selected_agents=agent_names_for_event,
        )

        # ---------------------------------------------------------------
        # Phase 1: Primary agents (parallel with staggered launches)
        # ---------------------------------------------------------------
        await self.bus.publish(
            session_id,
            SwarmStarted(
                session_id=session_id,
                agents=["maestro"] + agent_names_for_event,
                query=query,
            ),
        )

        # Build primary agents list based on Maestro's selection
        agent_constructors = {
            "deep_thinker": DeepThinkerAgent,
            "contrarian": ContrarianAgent,
            "verifier": VerifierAgent,
        }

        primary_agents: list[BaseOpusAgent] = []
        for name in agent_names_for_event:
            constructor = agent_constructors.get(name)
            if constructor:
                agent = constructor(self.graph, self.bus, session_id, api_key=api_key)
                # Use Maestro's effort assignment, or fallback
                if name == "deep_thinker":
                    agent.effort = effort_map.get(name, "max")
                else:
                    agent.effort = effort_map.get(name, fallback_effort)
                primary_agents.append(agent)

        async def run_staggered(agent: BaseOpusAgent, delay: float) -> AgentResult:
            """Launch an agent after a delay for rate limit management."""
            if delay > 0:
                await asyncio.sleep(delay)
            return await self._run_with_timeout(agent, swarm_query, session_id)

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

        # Backfill token_usage on persisted nodes for Phase 1 agents
        await self._backfill_tokens(agent_results)

        # ---------------------------------------------------------------
        # Phase 2: Synthesizer merges all results (sequential)
        # ---------------------------------------------------------------
        log.info("phase2_synthesis", session_id=session_id)
        synthesizer = SynthesizerAgent(self.graph, self.bus, session_id, api_key=api_key)
        synthesizer.effort = fallback_effort
        synthesis_result = await self._run_with_timeout(
            synthesizer, swarm_query, session_id
        )
        agent_results.append(synthesis_result)

        # Backfill tokens for synthesizer
        await self._backfill_tokens([synthesis_result])

        # ---------------------------------------------------------------
        # Phase 3: Metacognition analyzes the swarm (sequential)
        # ---------------------------------------------------------------
        log.info("phase3_metacognition", session_id=session_id)
        metacog = MetacognitionAgent(self.graph, self.bus, session_id, api_key=api_key)
        # Metacognition always uses max effort
        metacog.effort = "max"
        metacog_result = await self._run_with_timeout(
            metacog, swarm_query, session_id
        )
        agent_results.append(metacog_result)

        # Backfill tokens for metacognition
        await self._backfill_tokens([metacog_result])

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

    async def _run_maestro(
        self,
        query: str,
        session_id: str,
        api_key: str,
    ) -> dict:
        """Run Maestro with a 15-second timeout.

        Returns the deployment plan dict on success, or an empty dict
        on timeout/error (triggering regex fallback).
        """
        try:
            maestro = MaestroAgent(self.graph, self.bus, session_id, api_key=api_key)
            result = await asyncio.wait_for(maestro.run(query), timeout=15)

            if result.status == "completed" and result.conclusion:
                try:
                    plan = json.loads(result.conclusion)
                    log.info(
                        "maestro_plan_ready",
                        session_id=session_id,
                        agents=[a["name"] for a in plan.get("agents", [])],
                        subtasks=len(plan.get("subtasks", [])),
                    )
                    return plan
                except (json.JSONDecodeError, KeyError) as exc:
                    log.warning(
                        "maestro_plan_parse_error",
                        session_id=session_id,
                        error=str(exc),
                    )
                    return {}
            return {}

        except asyncio.TimeoutError:
            log.warning(
                "maestro_timeout",
                session_id=session_id,
                timeout_seconds=15,
            )
            return {}
        except Exception as exc:
            log.error(
                "maestro_error",
                session_id=session_id,
                error=str(exc),
            )
            return {}

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

    async def _backfill_tokens(self, results: list[AgentResult]) -> None:
        """Backfill token_usage on persisted nodes after agents complete."""
        if self.persistence is None:
            return
        for result in results:
            if (result.tokens_used > 0 or result.input_tokens_used > 0) and result.node_ids:
                try:
                    await self.persistence.backfill_node_tokens(
                        node_ids=result.node_ids,
                        tokens_used=result.tokens_used,
                        input_tokens_used=result.input_tokens_used,
                        agent_name=result.agent.value,
                    )
                except Exception as e:
                    log.warning(
                        "token_backfill_failed",
                        agent=result.agent.value,
                        error=str(e),
                    )

    async def rerun_with_correction(
        self,
        session_id: str,
        node_id: str,
        correction: str,
        *,
        experiment_id: str | None = None,
    ) -> dict:
        """Re-run specific agents with a human correction.

        Demo-first simplification: re-runs Deep Thinker and Contrarian
        with the correction appended to the query context.
        """
        from .events.types import SwarmRerunStarted

        log.info(
            "rerun_starting",
            session_id=session_id,
            node_id=node_id,
            experiment_id=experiment_id,
            correction_preview=correction,
        )

        rerun_agents = ["deep_thinker", "contrarian"]
        await self.bus.publish(
            session_id,
            SwarmRerunStarted(
                session_id=session_id,
                agents=rerun_agents,
                correction_preview=correction,
                experiment_id=experiment_id,
            ),
        )

        api_key = self.settings.anthropic_api_key
        corrected_query = (
            f"Previous analysis was checkpointed with human correction: "
            f"'{correction}'. Please re-analyze taking this feedback into account."
        )
        rehydration_context = await self._build_reasoning_rehydration_context(
            corrected_query,
            session_id,
        )
        rerun_query = corrected_query
        if rehydration_context:
            rerun_query = (
                f"{corrected_query}\n\n{rehydration_context}\n\n"
                "Treat retrieved artifacts as prior hypotheses. Verify, refine, or reject."
            )

        agents: list[BaseOpusAgent] = [
            DeepThinkerAgent(self.graph, self.bus, session_id, api_key=api_key),
            ContrarianAgent(self.graph, self.bus, session_id, api_key=api_key),
        ]

        stagger = self.settings.agent_stagger_seconds
        results = await asyncio.gather(
            *[
                self._run_staggered_agent(agent, rerun_query, session_id, i * stagger)
                for i, agent in enumerate(agents)
            ],
            return_exceptions=True,
        )

        for agent, result in zip(agents, results):
            if isinstance(result, BaseException):
                log.error(
                    "rerun_agent_error",
                    agent=agent.name.value,
                    error=str(result),
                )

        successful_results = [r for r in results if isinstance(r, AgentResult)]
        total_tokens = sum(r.tokens_used for r in successful_results)
        total_duration_ms = sum(r.duration_ms for r in successful_results)

        log.info(
            "rerun_complete",
            session_id=session_id,
            experiment_id=experiment_id,
            agents=rerun_agents,
            total_tokens=total_tokens,
            total_duration_ms=total_duration_ms,
        )
        return {
            "status": "rerun_complete",
            "agents": rerun_agents,
            "experiment_id": experiment_id,
            "total_tokens": total_tokens,
            "total_duration_ms": total_duration_ms,
        }

    async def _run_staggered_agent(
        self,
        agent: BaseOpusAgent,
        query: str,
        session_id: str,
        delay: float,
    ) -> AgentResult:
        """Launch an agent after a delay for rate limit management."""
        if delay > 0:
            await asyncio.sleep(delay)
        return await self._run_with_timeout(agent, query, session_id)
