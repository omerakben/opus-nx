"""Supabase persistence -- syncs reasoning graph to PostgreSQL.

Maps Python ReasoningNode -> thinking_nodes table,
ReasoningEdge -> reasoning_edges table. Uses upsert pattern
for safe re-sync with UUID validation and graceful degradation.
"""
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import httpx
import structlog

try:
    from supabase import create_client, Client
except ModuleNotFoundError:
    Client = Any  # type: ignore[assignment,misc]
    create_client = None  # type: ignore[assignment]

from ..config import Settings
from ..graph.models import ReasoningEdge, ReasoningNode
from ..utils import async_retry

log = structlog.get_logger(__name__)

# Edge type normalization: Python enum values -> Supabase column values
_EDGE_TYPE_MAP = {
    "LEADS_TO": "influences",
    "CHALLENGES": "challenges",
    "VERIFIES": "verifies",
    "SUPPORTS": "supports",
    "CONTRADICTS": "contradicts",
    "MERGES": "merges",
    "OBSERVES": "observes",
}


def _coerce_uuid(value: str | None, *, field: str) -> str | None:
    """Validate and normalize a UUID string. Returns None on invalid input."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return str(UUID(raw))
    except (TypeError, ValueError):
        log.warning("invalid_uuid_skipped", field=field, value=value)
        return None


def _clamp_confidence(value: float, *, default: float = 0.0) -> float:
    """Clamp confidence to [0.0, 1.0] range."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, parsed))


def _normalize_edge_type(relation: str) -> str:
    """Map Python EdgeRelation enum values to Supabase edge_type strings."""
    return _EDGE_TYPE_MAP.get(relation.upper(), relation.lower())


def _is_missing_table_error(error: Exception, *, table: str) -> bool:
    """Detect Supabase PostgREST missing-table errors (PGRST205)."""
    message = str(error)
    return (
        "PGRST205" in message
        and "Could not find the table" in message
        and table in message
    )


def _is_missing_rpc_error(error: Exception, *, rpc_name: str) -> bool:
    message = str(error)
    return (
        "PGRST202" in message
        or f"function public.{rpc_name}" in message
        or rpc_name in message
    )


def _edge_fk_missing_node_ids(
    error: Exception,
    *,
    source_id: str,
    target_id: str,
) -> list[str]:
    """Best-effort parse of FK violations for reasoning_edges source/target IDs."""
    message = str(error)
    lowered = message.lower()
    if "foreign key" not in lowered and "reasoning_edges_" not in lowered:
        return []

    missing: list[str] = []
    if "reasoning_edges_source_id_fkey" in message:
        missing.append(source_id)
    if "reasoning_edges_target_id_fkey" in message:
        missing.append(target_id)
    if not missing:
        missing.extend([source_id, target_id])
    return missing


def _normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def _hypothesis_text_hash(value: str) -> str:
    return hashlib.md5(_normalize_text(value).lower().encode("utf-8")).hexdigest()


class SupabasePersistence:
    """Sync reasoning graph to Supabase PostgreSQL.

    Gracefully degrades if supabase-py is not installed or init fails.
    Uses fire-and-forget pattern -- never blocks swarm operation on sync failure.
    """

    def __init__(self, settings: Settings) -> None:
        self._client: Client | None
        self._voyage_api_key = settings.voyage_api_key
        self._voyage_model = settings.voyage_model
        self._synced_node_ids: set[str] = set()
        self._pending_edges_by_node: dict[str, dict[str, ReasoningEdge]] = {}
        self._pending_edges_lock = asyncio.Lock()
        self._warned_capabilities_global: set[str] = set()
        self._warned_capabilities_by_session: dict[str, set[str]] = {}
        self._capabilities: dict[str, Any] | None = None
        if create_client is None:
            self._client = None
            log.warning("supabase_package_missing", msg="sync disabled")
            return
        try:
            self._client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
        except Exception:
            self._client = None
            log.exception("supabase_init_failed", msg="sync disabled")

    def _warn_capability_once(
        self,
        capability: str,
        *,
        session_id: str | None = None,
        **fields: Any,
    ) -> None:
        """Emit warning once globally or once per session for a capability key."""
        if session_id:
            scoped = self._warned_capabilities_by_session.setdefault(session_id, set())
            if capability in scoped:
                return
            scoped.add(capability)
        else:
            if capability in self._warned_capabilities_global:
                return
            self._warned_capabilities_global.add(capability)

        log.warning(
            "supabase_capability_unavailable",
            capability=capability,
            session_id=session_id,
            **fields,
        )

    def _edge_key(self, edge: ReasoningEdge) -> str:
        return f"{edge.source_id}:{edge.target_id}:{edge.relation.value}"

    async def _queue_edge_retry(
        self,
        edge: ReasoningEdge,
        *,
        missing_node_ids: list[str],
        error: str,
    ) -> None:
        """Queue edge retries by missing node IDs to resolve FK ordering races."""
        edge_key = self._edge_key(edge)
        unique_ids = sorted(set(missing_node_ids))
        async with self._pending_edges_lock:
            for node_id in unique_ids:
                bucket = self._pending_edges_by_node.setdefault(node_id, {})
                bucket[edge_key] = edge

        self._warn_capability_once(
            "reasoning_edges_fk_dependency",
            session_id=(
                str(edge.metadata.get("session_id"))
                if isinstance(edge.metadata, dict) and edge.metadata.get("session_id")
                else None
            ),
            edge_key=edge_key,
            missing_node_ids=unique_ids,
            error=error,
        )

    async def _flush_pending_edges_for_node(self, node_id: str) -> None:
        """Flush queued edges after a node is synced to satisfy FK constraints."""
        async with self._pending_edges_lock:
            bucket = self._pending_edges_by_node.pop(node_id, {})
            edges = list(bucket.values())

        if not edges:
            return

        log.info(
            "edge_retry_flush_started",
            node_id=node_id,
            queued_edges=len(edges),
        )
        for edge in edges:
            try:
                await self.sync_edge(edge)
            except Exception as exc:
                log.warning(
                    "edge_retry_flush_failed",
                    node_id=node_id,
                    source_id=edge.source_id,
                    target_id=edge.target_id,
                    error=str(exc),
                )

    async def _probe_table_exists(self, table_name: str) -> bool:
        if self._client is None:
            return False
        try:
            await asyncio.to_thread(
                lambda: self._client.table(table_name)  # type: ignore[union-attr]
                .select("id")
                .limit(1)
                .execute()
            )
            return True
        except Exception as exc:
            if _is_missing_table_error(exc, table=f"public.{table_name}"):
                return False
            # Unknown query failures should not disable capability by default.
            log.warning(
                "capability_probe_table_error",
                table=table_name,
                error=str(exc),
            )
            return True

    async def _probe_rpc_exists(
        self,
        rpc_name: str,
        payload: dict[str, Any],
    ) -> bool:
        if self._client is None:
            return False
        try:
            await asyncio.to_thread(
                lambda: self._client.rpc(rpc_name, payload).execute()  # type: ignore[union-attr]
            )
            return True
        except Exception as exc:
            if _is_missing_rpc_error(exc, rpc_name=rpc_name):
                return False
            # Unknown RPC failures should not disable capability by default.
            log.warning(
                "capability_probe_rpc_error",
                rpc_name=rpc_name,
                error=str(exc),
            )
            return True

    async def probe_capabilities(self) -> dict[str, Any]:
        """Probe table/RPC readiness once at startup for degraded-mode signaling."""
        if self._client is None:
            self._capabilities = {
                "configured": False,
                "tables": {},
                "rpc": {},
                "lifecycle_ready": False,
                "rehydration_ready": False,
            }
            return dict(self._capabilities)

        tables = {
            "reasoning_artifacts": await self._probe_table_exists("reasoning_artifacts"),
            "structured_reasoning_steps": await self._probe_table_exists("structured_reasoning_steps"),
            "structured_reasoning_hypotheses": await self._probe_table_exists(
                "structured_reasoning_hypotheses"
            ),
            "hypothesis_experiments": await self._probe_table_exists("hypothesis_experiments"),
            "hypothesis_experiment_actions": await self._probe_table_exists(
                "hypothesis_experiment_actions"
            ),
            "session_rehydration_runs": await self._probe_table_exists("session_rehydration_runs"),
        }
        rpc = {
            "match_reasoning_artifacts": await self._probe_rpc_exists(
                "match_reasoning_artifacts",
                {
                    "query_embedding": [0.0] * 1024,
                    "match_threshold": 1.1,
                    "match_count": 1,
                    "filter_session_id": None,
                    "filter_artifact_type": None,
                },
            ),
            "match_structured_reasoning_hypotheses": await self._probe_rpc_exists(
                "match_structured_reasoning_hypotheses",
                {
                    "query_embedding": [0.0] * 1024,
                    "match_threshold": 1.1,
                    "match_count": 1,
                    "filter_session_id": None,
                    "filter_status": None,
                },
            ),
        }
        lifecycle_ready = (
            tables["hypothesis_experiments"] and tables["hypothesis_experiment_actions"]
        )
        rehydration_ready = (
            tables["reasoning_artifacts"]
            and tables["structured_reasoning_hypotheses"]
            and tables["session_rehydration_runs"]
            and rpc["match_reasoning_artifacts"]
            and rpc["match_structured_reasoning_hypotheses"]
        )
        self._capabilities = {
            "configured": True,
            "tables": tables,
            "rpc": rpc,
            "lifecycle_ready": lifecycle_ready,
            "rehydration_ready": rehydration_ready,
            "probed_at": datetime.now(timezone.utc).isoformat(),
        }
        return dict(self._capabilities)

    def get_capabilities_snapshot(self) -> dict[str, Any]:
        return dict(self._capabilities) if isinstance(self._capabilities, dict) else {}

    async def generate_reasoning_embedding(self, text: str) -> list[float] | None:
        """Generate a Voyage embedding for reasoning retrieval.

        Returns None when Voyage is not configured or the request fails.
        """
        if not self._voyage_api_key:
            return None

        payload = {
            "model": self._voyage_model,
            "input": text,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    "https://api.voyageai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {self._voyage_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:
            log.warning(
                "voyage_embedding_failed",
                model=self._voyage_model,
                error=str(exc),
            )
            return None

        try:
            raw = body["data"][0]["embedding"]
            if not isinstance(raw, list):
                return None
            return [float(v) for v in raw]
        except Exception:
            log.warning("voyage_embedding_invalid_response")
            return None

    def _infer_step_type(self, content: str) -> str:
        lowered = content.lower()
        if any(token in lowered for token in ("hypothesis", "assume", "if ", "might", "could ")):
            return "hypothesis"
        if any(token in lowered for token in ("evaluate", "verify", "test", "evidence", "score")):
            return "evaluation"
        if any(token in lowered for token in ("consider", "alternative", "trade-off", "option")):
            return "consideration"
        if any(token in lowered for token in ("therefore", "thus", "conclusion", "recommend")):
            return "conclusion"
        return "analysis"

    def _extract_structured_steps(self, node: ReasoningNode) -> list[dict[str, Any]]:
        """Best-effort extraction of reasoning steps from node content + decision points."""
        steps: list[dict[str, Any]] = []
        seen: set[str] = set()

        line_candidates = [
            _normalize_text(line)
            for line in (node.content or "").splitlines()
            if _normalize_text(line)
        ]
        if not line_candidates:
            line_candidates = [_normalize_text(node.content or "")]
        if not line_candidates:
            return []

        for line in line_candidates:
            if line in seen:
                continue
            seen.add(line)
            steps.append(
                {
                    "content": line,
                    "step_type": self._infer_step_type(line),
                    "confidence": _clamp_confidence(node.confidence, default=0.5),
                    "metadata": {
                        "source": "node_content",
                        "agent": node.agent.value,
                    },
                }
            )

        for point in node.decision_points or []:
            if not isinstance(point, dict):
                continue
            description = _normalize_text(str(point.get("description") or point.get("text") or ""))
            if not description:
                continue
            alternatives = point.get("alternatives")
            alternatives_list = (
                [str(item).strip() for item in alternatives if str(item).strip()]
                if isinstance(alternatives, list)
                else []
            )
            chosen_path = _normalize_text(str(point.get("chosen_path") or ""))
            rationale = _normalize_text(str(point.get("rationale") or ""))

            decision_step = description
            if chosen_path:
                decision_step = f"{decision_step} Chosen path: {chosen_path}."
            if alternatives_list:
                decision_step = f"{decision_step} Alternatives: {', '.join(alternatives_list)}."
            if rationale:
                decision_step = f"{decision_step} Rationale: {rationale}."
            decision_step = _normalize_text(decision_step)
            if decision_step in seen:
                continue
            seen.add(decision_step)
            steps.append(
                {
                    "content": decision_step,
                    "step_type": "consideration",
                    "confidence": _clamp_confidence(node.confidence, default=0.5),
                    "metadata": {
                        "source": "decision_point",
                        "raw": point,
                    },
                }
            )

            for alternative in alternatives_list:
                hypothesis_text = _normalize_text(
                    f"Hypothesis alternative from decision point: {alternative}"
                )
                if not hypothesis_text or hypothesis_text in seen:
                    continue
                seen.add(hypothesis_text)
                steps.append(
                    {
                        "content": hypothesis_text,
                        "step_type": "hypothesis",
                        "confidence": _clamp_confidence(node.confidence, default=0.5),
                        "metadata": {
                            "source": "decision_point_alternative",
                            "decision_description": description,
                            "alternative": alternative,
                        },
                    }
                )

        return steps

    def _extract_hypothesis_candidates(self, step_text: str) -> list[str]:
        normalized = _normalize_text(step_text)
        if not normalized:
            return []
        lowered = normalized.lower()
        if any(
            token in lowered
            for token in ("hypothesis", "assume", "if ", "might", "could ", "alternative")
        ):
            return [normalized]

        if "?" in normalized and len(normalized) > 18:
            return [normalized]

        return []

    async def _sync_structured_reasoning_for_node(
        self,
        *,
        session_id: str,
        node_id: str,
        node: ReasoningNode,
    ) -> None:
        """Persist structured steps/hypotheses with graceful table degradation."""
        if self._client is None:
            return

        steps = self._extract_structured_steps(node)
        if not steps:
            return

        step_rows: list[dict[str, Any]] = []
        for idx, step in enumerate(steps, start=1):
            step_rows.append(
                {
                    "thinking_node_id": node_id,
                    "step_number": idx,
                    "step_type": step["step_type"],
                    "content": step["content"],
                    "confidence": step["confidence"],
                    "metadata": step["metadata"],
                }
            )

        try:
            await asyncio.to_thread(
                lambda: self._client.table("structured_reasoning_steps")  # type: ignore[union-attr]
                .upsert(step_rows, on_conflict="thinking_node_id,step_number")
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.structured_reasoning_steps"):
                self._warn_capability_once(
                    "structured_reasoning_steps_table_missing",
                    session_id=session_id,
                    node_id=node_id,
                    error=str(exc),
                )
                return
            log.warning(
                "structured_reasoning_steps_upsert_failed",
                node_id=node_id,
                error=str(exc),
            )
            return

        try:
            response = await asyncio.to_thread(
                lambda: self._client.table("structured_reasoning_steps")  # type: ignore[union-attr]
                .select("id,step_number,content,confidence,step_type")
                .eq("thinking_node_id", node_id)
                .order("step_number")
                .execute()
            )
        except Exception as exc:
            log.warning(
                "structured_reasoning_steps_fetch_failed",
                node_id=node_id,
                error=str(exc),
            )
            return

        db_steps = getattr(response, "data", None) or []
        if not db_steps:
            return

        hypothesis_rows: list[dict[str, Any]] = []
        for step in db_steps:
            step_id = str(step.get("id") or "")
            step_text = str(step.get("content") or "")
            if not step_id or not step_text:
                continue
            candidates = self._extract_hypothesis_candidates(step_text)
            if not candidates:
                continue
            raw_confidence = step.get("confidence")
            confidence_score = _clamp_confidence(
                float(raw_confidence) if isinstance(raw_confidence, (float, int)) else node.confidence,
                default=0.5,
            )
            for candidate in candidates:
                embedding = await self.generate_reasoning_embedding(candidate)
                hypothesis_rows.append(
                    {
                        "step_id": step_id,
                        "thinking_node_id": node_id,
                        "hypothesis_text": candidate,
                        "status": "proposed",
                        "confidence": confidence_score,
                        "evidence": [],
                        "embedding": embedding,
                        "metadata": {
                            "session_id": session_id,
                            "source_agent": node.agent.value,
                            "step_type": str(step.get("step_type") or "analysis"),
                            "hypothesis_text_hash": _hypothesis_text_hash(candidate),
                        },
                    }
                )

        if not hypothesis_rows:
            return

        try:
            await asyncio.to_thread(
                lambda: self._client.table("structured_reasoning_hypotheses")  # type: ignore[union-attr]
                .upsert(
                    hypothesis_rows,
                    on_conflict="thinking_node_id,hypothesis_text_hash",
                )
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.structured_reasoning_hypotheses"):
                self._warn_capability_once(
                    "structured_reasoning_hypotheses_table_missing",
                    session_id=session_id,
                    node_id=node_id,
                    error=str(exc),
                )
                return
            if "ON CONFLICT" in str(exc) or "hypothesis_text_hash" in str(exc):
                log.warning(
                    "structured_reasoning_hypotheses_upsert_conflict_fallback",
                    node_id=node_id,
                    error=str(exc),
                )
                try:
                    await asyncio.to_thread(
                        lambda: self._client.table("structured_reasoning_hypotheses")  # type: ignore[union-attr]
                        .insert(hypothesis_rows)
                        .execute()
                    )
                    return
                except Exception as fallback_exc:
                    log.warning(
                        "structured_reasoning_hypotheses_insert_fallback_failed",
                        node_id=node_id,
                        error=str(fallback_exc),
                    )
                    return
            log.warning(
                "structured_reasoning_hypotheses_upsert_failed",
                node_id=node_id,
                error=str(exc),
            )
            return
        log.debug("structured_reasoning_synced", node_id=node_id, steps=len(step_rows), hypotheses=len(hypothesis_rows))

    async def _upsert_reasoning_artifact_for_node(
        self,
        *,
        session_id: str,
        node_id: str,
        node: ReasoningNode,
    ) -> None:
        """Best-effort artifact persistence for semantic rehydration."""
        if self._client is None:
            return
        if not self._voyage_api_key:
            return

        content = (node.content or "").strip()
        if not content:
            return

        embedding = await self.generate_reasoning_embedding(content)
        if embedding is None:
            return

        row: dict[str, Any] = {
            "id": node_id,
            "session_id": session_id,
            "thinking_node_id": node_id,
            "artifact_type": "node",
            "title": f"{node.agent.value} reasoning node",
            "content": content,
            "snapshot": {
                "agent": node.agent.value,
                "reasoning": node.reasoning,
                "decision_points": node.decision_points,
            },
            "topic_tags": [
                f"agent:{node.agent.value}",
                f"reasoning:{node.reasoning or 'analysis'}",
            ],
            "importance_score": _clamp_confidence(node.confidence, default=0.5),
            "source_confidence": _clamp_confidence(node.confidence, default=0.5),
            "embedding": embedding,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            await asyncio.to_thread(
                lambda: self._client.table("reasoning_artifacts")  # type: ignore[union-attr]
                .upsert(row, on_conflict="id")
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.reasoning_artifacts"):
                self._warn_capability_once(
                    "reasoning_artifacts_table_missing",
                    session_id=session_id,
                    operation="upsert_reasoning_artifact_for_node",
                    error=str(exc),
                )
                return
            log.warning(
                "reasoning_artifact_upsert_failed",
                node_id=node_id,
                error=str(exc),
            )
            return
        log.debug("reasoning_artifact_upserted", node_id=node_id, session_id=session_id)

    async def _upsert_reasoning_artifact_for_hypothesis_experiment(
        self,
        *,
        experiment_id: str,
        session_id: str,
        hypothesis_node_id: str,
        alternative_summary: str,
        status: str,
        retention_decision: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Persist hypothesis lifecycle rows as semantic reasoning artifacts."""
        if self._client is None:
            return
        if not self._voyage_api_key:
            return

        summary = _normalize_text(alternative_summary)
        if not summary:
            return

        embedding = await self.generate_reasoning_embedding(summary)
        if embedding is None:
            return

        normalized_experiment_id = _coerce_uuid(experiment_id, field="reasoning_artifacts.id")
        normalized_session_id = _coerce_uuid(session_id, field="reasoning_artifacts.session_id")
        normalized_node_id = _coerce_uuid(
            hypothesis_node_id, field="reasoning_artifacts.thinking_node_id"
        )
        if normalized_experiment_id is None or normalized_session_id is None:
            return

        row: dict[str, Any] = {
            "id": normalized_experiment_id,
            "session_id": normalized_session_id,
            "thinking_node_id": normalized_node_id,
            "artifact_type": "hypothesis",
            "title": f"Hypothesis experiment {normalized_experiment_id[:8]}",
            "content": summary,
            "snapshot": {
                "experiment_id": normalized_experiment_id,
                "status": status,
                "retention_decision": retention_decision,
                "metadata": metadata or {},
            },
            "topic_tags": [
                "hypothesis_experiment",
                f"status:{status}",
                f"retention:{retention_decision or 'none'}",
            ],
            "importance_score": 0.8 if retention_decision == "retain" else 0.65,
            "source_confidence": 0.75,
            "embedding": embedding,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await asyncio.to_thread(
                lambda: self._client.table("reasoning_artifacts")  # type: ignore[union-attr]
                .upsert(row, on_conflict="id")
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.reasoning_artifacts"):
                self._warn_capability_once(
                    "reasoning_artifacts_table_missing",
                    session_id=normalized_session_id,
                    operation="upsert_reasoning_artifact_for_hypothesis_experiment",
                    error=str(exc),
                )
                return
            log.warning(
                "hypothesis_reasoning_artifact_upsert_failed",
                experiment_id=normalized_experiment_id,
                error=str(exc),
            )

    async def _refresh_hypothesis_experiment_artifact(self, experiment_id: str) -> None:
        if self._client is None:
            return
        normalized_experiment_id = _coerce_uuid(experiment_id, field="hypothesis_experiments.id")
        if normalized_experiment_id is None:
            return
        try:
            response = await asyncio.to_thread(
                lambda: self._client.table("hypothesis_experiments")  # type: ignore[union-attr]
                .select("*")
                .eq("id", normalized_experiment_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiments"):
                return
            log.warning(
                "hypothesis_experiment_artifact_refresh_failed",
                experiment_id=normalized_experiment_id,
                error=str(exc),
            )
            return

        rows = getattr(response, "data", None) or []
        if not rows:
            return
        row = rows[0]
        await self._upsert_reasoning_artifact_for_hypothesis_experiment(
            experiment_id=str(row.get("id") or normalized_experiment_id),
            session_id=str(row.get("session_id") or ""),
            hypothesis_node_id=str(row.get("hypothesis_node_id") or ""),
            alternative_summary=str(row.get("alternative_summary") or ""),
            status=str(row.get("status") or "promoted"),
            retention_decision=str(row.get("retention_decision") or "") or None,
            metadata=row.get("metadata") if isinstance(row.get("metadata"), dict) else {},
        )

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_node(self, node: ReasoningNode) -> None:
        """Upsert a reasoning node to the thinking_nodes table."""
        if self._client is None:
            return

        node_id = _coerce_uuid(node.id, field="thinking_nodes.id")
        session_id = _coerce_uuid(node.session_id, field="thinking_nodes.session_id")
        if node_id is None or session_id is None:
            log.warning("node_sync_skipped", reason="invalid UUID")
            return

        structured_steps = self._extract_structured_steps(node)
        row: dict[str, Any] = {
            "id": node_id,
            "session_id": session_id,
            "parent_node_id": None,
            "reasoning": node.reasoning or node.content,
            "response": node.content,
            "structured_reasoning": {
                "swarm": True,
                "agent": node.agent.value,
                "decision_points": node.decision_points,
                "steps": [
                    {
                        "step_number": idx + 1,
                        "step_type": step["step_type"],
                        "content": step["content"],
                    }
                    for idx, step in enumerate(structured_steps)
                ],
            },
            "confidence_score": _clamp_confidence(node.confidence),
            "signature": f"swarm-{node.agent.value}",
            "input_query": node.input_query,
            "token_usage": node.token_usage if node.token_usage else {"source": "swarm_v2"},
            "node_type": "thinking",
            "agent_name": node.agent.value,
            "created_at": node.created_at.isoformat()
            if isinstance(node.created_at, datetime)
            else datetime.now(timezone.utc).isoformat(),
        }

        await asyncio.to_thread(
            lambda: self._client.table("thinking_nodes")  # type: ignore[union-attr]
            .upsert(row, on_conflict="id")
            .execute()
        )
        self._synced_node_ids.add(node_id)
        await self._sync_structured_reasoning_for_node(
            session_id=session_id,
            node_id=node_id,
            node=node,
        )
        await self._upsert_reasoning_artifact_for_node(
            session_id=session_id,
            node_id=node_id,
            node=node,
        )
        await self._flush_pending_edges_for_node(node_id)
        log.debug("supabase_node_synced", node_id=node_id)

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_edge(self, edge: ReasoningEdge) -> None:
        """Upsert a reasoning edge to the reasoning_edges table."""
        if self._client is None:
            return

        source_id = _coerce_uuid(edge.source_id, field="reasoning_edges.source_id")
        target_id = _coerce_uuid(edge.target_id, field="reasoning_edges.target_id")
        if source_id is None or target_id is None:
            log.warning("edge_sync_skipped", reason="invalid UUID")
            return

        row: dict[str, Any] = {
            "source_id": source_id,
            "target_id": target_id,
            "edge_type": _normalize_edge_type(edge.relation.value),
            "weight": _clamp_confidence(edge.weight, default=1.0),
            "metadata": edge.metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            await asyncio.to_thread(
                lambda: self._client.table("reasoning_edges")  # type: ignore[union-attr]
                .upsert(row, on_conflict="source_id,target_id,edge_type")
                .execute()
            )
        except Exception as exc:
            missing_node_ids = _edge_fk_missing_node_ids(
                exc,
                source_id=source_id,
                target_id=target_id,
            )
            if missing_node_ids:
                await self._queue_edge_retry(
                    edge,
                    missing_node_ids=missing_node_ids,
                    error=str(exc),
                )
                return
            raise
        log.debug(
            "supabase_edge_synced",
            source=source_id,
            target=target_id,
        )

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def backfill_node_tokens(
        self,
        node_ids: list[str],
        tokens_used: int,
        agent_name: str,
        input_tokens_used: int = 0,
    ) -> None:
        """Backfill token_usage on nodes after an agent completes.

        Distributes the agent's total token count evenly across its nodes
        using the same schema as the Node.js ThinkGraph (inputTokens,
        outputTokens, thinkingTokens).
        """
        if self._client is None or not node_ids:
            return

        # Distribute tokens evenly across nodes
        n = max(len(node_ids), 1)
        out_per_node = tokens_used // n
        out_remainder = tokens_used % n
        in_per_node = input_tokens_used // n
        in_remainder = input_tokens_used % n

        for i, raw_id in enumerate(node_ids):
            node_id = _coerce_uuid(raw_id, field="backfill.node_id")
            if node_id is None:
                continue

            node_out_tokens = out_per_node + (1 if i < out_remainder else 0)
            node_in_tokens = in_per_node + (1 if i < in_remainder else 0)
            token_data = {
                "inputTokens": node_in_tokens,
                "outputTokens": node_out_tokens,
                "thinkingTokens": 0,
                "source": "swarm_v2",
                "agent": agent_name,
            }

            try:
                await asyncio.to_thread(
                    lambda nid=node_id, td=token_data: (
                        self._client.table("thinking_nodes")  # type: ignore[union-attr]
                        .update({"token_usage": td})
                        .eq("id", nid)
                        .execute()
                    )
                )
                log.debug("backfill_tokens_updated", node_id=node_id, output_tokens=node_out_tokens, input_tokens=node_in_tokens)
            except Exception as e:
                log.warning("backfill_tokens_failed", node_id=node_id, error=str(e))

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def create_hypothesis_experiment(
        self,
        session_id: str,
        hypothesis_node_id: str,
        alternative_summary: str,
        *,
        promoted_by: str = "human",
        status: str = "promoted",
        preferred_run_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        experiment_id: str | None = None,
    ) -> str | None:
        """Create a hypothesis experiment row and return its UUID."""
        if self._client is None:
            return None

        normalized_session_id = _coerce_uuid(
            session_id, field="hypothesis_experiments.session_id"
        )
        normalized_node_id = _coerce_uuid(
            hypothesis_node_id, field="hypothesis_experiments.hypothesis_node_id"
        )
        normalized_preferred_run_id = _coerce_uuid(
            preferred_run_id, field="hypothesis_experiments.preferred_run_id"
        )

        if normalized_session_id is None or normalized_node_id is None:
            log.warning(
                "hypothesis_experiment_create_skipped",
                reason="invalid UUID",
                session_id=session_id,
                hypothesis_node_id=hypothesis_node_id,
            )
            return None

        normalized_experiment_id = _coerce_uuid(
            experiment_id, field="hypothesis_experiments.id"
        ) or str(uuid4())

        row: dict[str, Any] = {
            "id": normalized_experiment_id,
            "session_id": normalized_session_id,
            "hypothesis_node_id": normalized_node_id,
            "promoted_by": promoted_by,
            "alternative_summary": alternative_summary,
            "status": status,
            "preferred_run_id": normalized_preferred_run_id,
            "metadata": metadata or {},
        }

        try:
            await asyncio.to_thread(
                lambda: self._client.table("hypothesis_experiments")  # type: ignore[union-attr]
                .insert(row)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiments"):
                self._warn_capability_once(
                    "hypothesis_experiments_table_missing",
                    session_id=normalized_session_id,
                    operation="create_hypothesis_experiment",
                    error=str(exc),
                )
                return None
            raise
        log.debug(
            "hypothesis_experiment_created",
            experiment_id=normalized_experiment_id,
            session_id=normalized_session_id,
            status=status,
        )
        await self._upsert_reasoning_artifact_for_hypothesis_experiment(
            experiment_id=normalized_experiment_id,
            session_id=normalized_session_id,
            hypothesis_node_id=normalized_node_id,
            alternative_summary=alternative_summary,
            status=status,
            metadata=metadata or {},
        )
        return normalized_experiment_id

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def update_hypothesis_experiment(
        self,
        experiment_id: str,
        *,
        status: str | None = None,
        comparison_result: dict[str, Any] | None = None,
        retention_decision: str | None = None,
        rerun_run_id: str | None = None,
        preferred_run_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Update mutable fields for a hypothesis experiment row."""
        if self._client is None:
            return

        normalized_experiment_id = _coerce_uuid(
            experiment_id, field="hypothesis_experiments.id"
        )
        if normalized_experiment_id is None:
            log.warning(
                "hypothesis_experiment_update_skipped",
                reason="invalid UUID",
                experiment_id=experiment_id,
            )
            return

        payload: dict[str, Any] = {}
        if status is not None:
            payload["status"] = status
        if comparison_result is not None:
            payload["comparison_result"] = comparison_result
        if retention_decision is not None:
            payload["retention_decision"] = retention_decision

        normalized_rerun_run_id = _coerce_uuid(
            rerun_run_id, field="hypothesis_experiments.rerun_run_id"
        )
        if rerun_run_id is not None:
            payload["rerun_run_id"] = normalized_rerun_run_id

        normalized_preferred_run_id = _coerce_uuid(
            preferred_run_id, field="hypothesis_experiments.preferred_run_id"
        )
        if preferred_run_id is not None:
            payload["preferred_run_id"] = normalized_preferred_run_id

        if metadata is not None:
            payload["metadata"] = metadata

        if not payload:
            return

        try:
            await asyncio.to_thread(
                lambda: self._client.table("hypothesis_experiments")  # type: ignore[union-attr]
                .update(payload)
                .eq("id", normalized_experiment_id)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiments"):
                self._warn_capability_once(
                    "hypothesis_experiments_table_missing",
                    operation="update_hypothesis_experiment",
                    error=str(exc),
                )
                return
            raise
        log.debug(
            "hypothesis_experiment_updated",
            experiment_id=normalized_experiment_id,
            status=status,
        )
        if self._voyage_api_key:
            await self._refresh_hypothesis_experiment_artifact(normalized_experiment_id)

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def create_hypothesis_experiment_action(
        self,
        experiment_id: str,
        session_id: str,
        action: str,
        *,
        performed_by: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> str | None:
        """Append an action row for a hypothesis experiment and return action UUID."""
        if self._client is None:
            return None

        normalized_experiment_id = _coerce_uuid(
            experiment_id, field="hypothesis_experiment_actions.experiment_id"
        )
        normalized_session_id = _coerce_uuid(
            session_id, field="hypothesis_experiment_actions.session_id"
        )
        if normalized_experiment_id is None or normalized_session_id is None:
            log.warning(
                "hypothesis_action_create_skipped",
                reason="invalid UUID",
                experiment_id=experiment_id,
                session_id=session_id,
            )
            return None

        action_id = str(uuid4())
        row: dict[str, Any] = {
            "id": action_id,
            "experiment_id": normalized_experiment_id,
            "session_id": normalized_session_id,
            "action": action,
            "performed_by": performed_by,
            "details": details or {},
        }

        try:
            await asyncio.to_thread(
                lambda: self._client.table("hypothesis_experiment_actions")  # type: ignore[union-attr]
                .insert(row)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiment_actions"):
                self._warn_capability_once(
                    "hypothesis_experiment_actions_table_missing",
                    session_id=normalized_session_id,
                    operation="create_hypothesis_experiment_action",
                    error=str(exc),
                )
                return None
            raise
        log.debug(
            "hypothesis_action_created",
            action_id=action_id,
            experiment_id=normalized_experiment_id,
            action=action,
        )
        return action_id

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def get_hypothesis_experiment(
        self,
        experiment_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single hypothesis experiment by UUID."""
        if self._client is None:
            return None

        normalized_experiment_id = _coerce_uuid(
            experiment_id, field="hypothesis_experiments.id"
        )
        if normalized_experiment_id is None:
            log.warning(
                "hypothesis_experiment_get_skipped",
                reason="invalid UUID",
                experiment_id=experiment_id,
            )
            return None

        try:
            response = await asyncio.to_thread(
                lambda: self._client.table("hypothesis_experiments")  # type: ignore[union-attr]
                .select("*")
                .eq("id", normalized_experiment_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiments"):
                self._warn_capability_once(
                    "hypothesis_experiments_table_missing",
                    operation="get_hypothesis_experiment",
                    error=str(exc),
                )
                return None
            raise
        data = getattr(response, "data", None) or []
        if not data:
            return None
        return data[0]

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def list_session_hypothesis_experiments(
        self,
        session_id: str,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List hypothesis experiments for a session."""
        if self._client is None:
            return []

        normalized_session_id = _coerce_uuid(
            session_id, field="hypothesis_experiments.session_id"
        )
        if normalized_session_id is None:
            log.warning(
                "hypothesis_experiment_list_skipped",
                reason="invalid UUID",
                session_id=session_id,
            )
            return []

        capped_limit = max(1, min(limit, 500))

        def _run_query():
            query = (
                self._client.table("hypothesis_experiments")  # type: ignore[union-attr]
                .select("*")
                .eq("session_id", normalized_session_id)
                .order("last_updated", desc=True)
                .limit(capped_limit)
            )
            if status:
                query = query.eq("status", status)
            return query.execute()

        try:
            response = await asyncio.to_thread(_run_query)
        except Exception as exc:
            if _is_missing_table_error(exc, table="public.hypothesis_experiments"):
                self._warn_capability_once(
                    "hypothesis_experiments_table_missing",
                    session_id=normalized_session_id,
                    operation="list_session_hypothesis_experiments",
                    error=str(exc),
                )
                return []
            raise
        data = getattr(response, "data", None) or []
        return list(data)

    @async_retry(max_retries=2, backoff_delays=(0.5, 1.0))
    async def search_reasoning_artifacts(
        self,
        query_embedding: list[float],
        *,
        match_threshold: float = 0.65,
        match_count: int = 5,
        filter_session_id: str | None = None,
        filter_artifact_type: str | None = "node",
    ) -> list[dict[str, Any]]:
        """Semantic reasoning artifact retrieval via match_reasoning_artifacts RPC."""
        if self._client is None:
            return []
        if not query_embedding:
            return []

        normalized_session_id = _coerce_uuid(
            filter_session_id, field="reasoning_artifacts.session_id"
        )

        try:
            response = await asyncio.to_thread(
                lambda: self._client.rpc(  # type: ignore[union-attr]
                    "match_reasoning_artifacts",
                    {
                        "query_embedding": query_embedding,
                        "match_threshold": match_threshold,
                        "match_count": max(1, min(match_count, 50)),
                        "filter_session_id": normalized_session_id,
                        "filter_artifact_type": filter_artifact_type,
                    },
                ).execute()
            )
        except Exception as exc:
            message = str(exc)
            if "match_reasoning_artifacts" in message or "reasoning_artifacts" in message:
                self._warn_capability_once(
                    "match_reasoning_artifacts_unavailable",
                    error=message,
                )
                return []
            raise
        data = getattr(response, "data", None) or []
        return list(data)

    @async_retry(max_retries=2, backoff_delays=(0.5, 1.0))
    async def search_structured_reasoning_hypotheses_semantic(
        self,
        query_embedding: list[float],
        *,
        match_threshold: float = 0.65,
        match_count: int = 8,
        filter_session_id: str | None = None,
        filter_status: str | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic hypothesis retrieval via match_structured_reasoning_hypotheses RPC."""
        if self._client is None:
            return []
        if not query_embedding:
            return []

        normalized_session_id = _coerce_uuid(
            filter_session_id, field="structured_reasoning_hypotheses.session_id"
        )
        try:
            response = await asyncio.to_thread(
                lambda: self._client.rpc(  # type: ignore[union-attr]
                    "match_structured_reasoning_hypotheses",
                    {
                        "query_embedding": query_embedding,
                        "match_threshold": match_threshold,
                        "match_count": max(1, min(match_count, 50)),
                        "filter_session_id": normalized_session_id,
                        "filter_status": filter_status,
                    },
                ).execute()
            )
        except Exception as exc:
            if _is_missing_rpc_error(exc, rpc_name="match_structured_reasoning_hypotheses"):
                self._warn_capability_once(
                    "match_structured_reasoning_hypotheses_unavailable",
                    error=str(exc),
                )
                return []
            raise
        data = getattr(response, "data", None) or []
        return list(data)

    @async_retry(max_retries=2, backoff_delays=(0.5, 1.0))
    async def create_session_rehydration_run(
        self,
        *,
        session_id: str,
        query_text: str,
        query_embedding: list[float] | None = None,
        selected_artifact_ids: list[str] | None = None,
        candidate_count: int = 0,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """Persist a rehydration audit row. Returns row id on success."""
        if self._client is None:
            return None

        normalized_session_id = _coerce_uuid(
            session_id, field="session_rehydration_runs.session_id"
        )
        if normalized_session_id is None:
            return None

        artifact_ids: list[str] = []
        for raw in selected_artifact_ids or []:
            normalized = _coerce_uuid(raw, field="session_rehydration_runs.selected_artifact_ids")
            if normalized:
                artifact_ids.append(normalized)

        row_id = str(uuid4())
        row = {
            "id": row_id,
            "session_id": normalized_session_id,
            "query_text": query_text,
            "query_embedding": query_embedding,
            "selected_artifact_ids": artifact_ids,
            "candidate_count": max(0, int(candidate_count)),
            "metadata": metadata or {},
        }
        try:
            await asyncio.to_thread(
                lambda: self._client.table("session_rehydration_runs")  # type: ignore[union-attr]
                .insert(row)
                .execute()
            )
        except Exception as exc:
            message = str(exc)
            if "session_rehydration_runs" in message:
                self._warn_capability_once(
                    "session_rehydration_runs_unavailable",
                    session_id=normalized_session_id,
                    error=message,
                )
                return None
            raise
        return row_id

    @async_retry(max_retries=2, backoff_delays=(0.5, 1.0))
    async def mark_reasoning_artifact_used(self, artifact_id: str) -> None:
        """Best-effort usage timestamp update for selected reasoning artifacts."""
        if self._client is None:
            return
        normalized_artifact_id = _coerce_uuid(
            artifact_id, field="reasoning_artifacts.id"
        )
        if normalized_artifact_id is None:
            return
        try:
            await asyncio.to_thread(
                lambda: self._client.table("reasoning_artifacts")  # type: ignore[union-attr]
                .update({"last_used_at": datetime.now(timezone.utc).isoformat()})
                .eq("id", normalized_artifact_id)
                .execute()
            )
        except Exception as exc:
            message = str(exc)
            if "reasoning_artifacts" in message:
                self._warn_capability_once(
                    "reasoning_artifact_mark_used_unavailable",
                    error=message,
                )
                return
            raise

    async def sync(self, event_type: str, data: Any) -> None:
        """Dispatch graph change events to the appropriate sync method."""
        try:
            if event_type == "node_added" and isinstance(data, ReasoningNode):
                await self.sync_node(data)
            elif event_type == "edge_added" and isinstance(data, ReasoningEdge):
                await self.sync_edge(data)
            else:
                log.debug("supabase_event_ignored", event_type=event_type)
        except Exception as e:
            log.warning("supabase_sync_failed", event_type=event_type, error=str(e))
