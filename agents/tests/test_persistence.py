"""Persistence layer tests -- Neo4j and Supabase with mocked drivers.

Tests save/sync dispatch, graceful degradation, retry behavior,
and the on_graph_change callback wiring pattern from server.py.

NOTE: The neo4j and supabase packages are not installed in the test
runner's environment (pytest runs outside the uv venv). We mock them
at the sys.modules level before importing persistence classes.
"""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

from src.config import Settings
from src.graph.models import (
    AgentName,
    EdgeRelation,
    ReasoningEdge,
    ReasoningNode,
)
from src.graph.reasoning_graph import SharedReasoningGraph


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEST_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
_TEST_SOURCE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
_TEST_TARGET_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"


def _make_node(session_id: str = _TEST_SESSION_ID) -> ReasoningNode:
    return ReasoningNode(
        agent=AgentName.DEEP_THINKER,
        session_id=session_id,
        content="Test reasoning content",
        confidence=0.85,
    )


def _make_edge() -> ReasoningEdge:
    return ReasoningEdge(
        source_id=_TEST_SOURCE_ID,
        target_id=_TEST_TARGET_ID,
        relation=EdgeRelation.LEADS_TO,
        weight=0.9,
    )


def _settings_with_neo4j():
    return Settings(
        anthropic_api_key="sk-test",
        supabase_url="http://localhost:54321",
        supabase_service_role_key="test-key",
        auth_secret="test-secret",
        voyage_api_key=None,
        neo4j_uri="bolt://localhost:7687",
        neo4j_password="test-pw",
    )


def _settings_base():
    return Settings(
        anthropic_api_key="sk-test",
        supabase_url="http://localhost:54321",
        supabase_service_role_key="test-key",
        auth_secret="test-secret",
        voyage_api_key=None,
    )


# ---------------------------------------------------------------------------
# Mock factories
# ---------------------------------------------------------------------------

def _mock_neo4j_driver():
    """Build a mock Neo4j async driver with session -> run chain."""
    mock_session = AsyncMock()
    mock_session.run = AsyncMock()

    mock_driver = MagicMock()
    session_cm = AsyncMock()
    session_cm.__aenter__ = AsyncMock(return_value=mock_session)
    session_cm.__aexit__ = AsyncMock(return_value=False)
    mock_driver.session.return_value = session_cm
    mock_driver.close = AsyncMock()

    return mock_driver, mock_session


def _mock_supabase_client():
    """Build a mock Supabase sync client with table -> upsert -> execute chain."""
    mock_execute = MagicMock(return_value=MagicMock(data=[]))
    mock_upsert = MagicMock(return_value=MagicMock(execute=mock_execute))
    mock_table_obj = MagicMock(upsert=mock_upsert)
    mock_table_fn = MagicMock(return_value=mock_table_obj)

    mock_client = MagicMock()
    mock_client.table = mock_table_fn

    return mock_client, mock_table_fn, mock_upsert, mock_execute


def _mock_supabase_client_with_mutations():
    """Build a mock Supabase client with insert/update/upsert mutation chains."""
    mock_execute = MagicMock(return_value=MagicMock(data=[]))
    mock_upsert = MagicMock(return_value=MagicMock(execute=mock_execute))
    mock_insert = MagicMock(return_value=MagicMock(execute=mock_execute))
    mock_eq = MagicMock(return_value=MagicMock(execute=mock_execute))
    mock_update = MagicMock(return_value=MagicMock(eq=mock_eq))
    mock_query = MagicMock()
    mock_query.eq.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute = mock_execute
    mock_select = MagicMock(return_value=mock_query)
    mock_table_obj = MagicMock(
        upsert=mock_upsert,
        insert=mock_insert,
        update=mock_update,
        select=mock_select,
    )
    mock_table_fn = MagicMock(return_value=mock_table_obj)

    mock_client = MagicMock()
    mock_client.table = mock_table_fn

    return mock_client, mock_table_fn, mock_insert, mock_update, mock_eq


# ---------------------------------------------------------------------------
# Import helpers -- inject mocks for neo4j/supabase if not available
# ---------------------------------------------------------------------------

def _ensure_neo4j_importable():
    """Force 'neo4j' imports to resolve to a mock module."""
    mock_neo4j = MagicMock()
    mock_neo4j.AsyncGraphDatabase = MagicMock()
    sys.modules["neo4j"] = mock_neo4j
    # Also clear cached persistence modules to force reimport
    for key in list(sys.modules):
        if "src.persistence" in key:
            del sys.modules[key]


def _ensure_supabase_importable():
    """Force 'supabase' imports to resolve to a mock module."""
    mock_supabase = MagicMock()
    mock_supabase.create_client = MagicMock()
    mock_supabase.Client = MagicMock()
    sys.modules["supabase"] = mock_supabase
    for key in list(sys.modules):
        if "src.persistence" in key:
            del sys.modules[key]


def _import_neo4j_persistence():
    """Import Neo4jPersistence with mocked neo4j module."""
    _ensure_neo4j_importable()
    _ensure_supabase_importable()
    from src.persistence.neo4j_client import Neo4jPersistence  # noqa: E402
    return Neo4jPersistence


def _import_supabase_persistence():
    """Import SupabasePersistence with mocked supabase module."""
    _ensure_supabase_importable()
    _ensure_neo4j_importable()
    from src.persistence.supabase_sync import SupabasePersistence  # noqa: E402
    return SupabasePersistence


# ===========================================================================
# T1.1 -- Neo4jPersistence.save_node()
# ===========================================================================

class TestNeo4jSaveNode:
    async def test_save_node_calls_merge_query(self):
        """save_node should call session.run with a MERGE Cypher query."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        node = _make_node()
        await persistence.save_node(node)

        mock_session.run.assert_called_once()
        cypher_query = mock_session.run.call_args[0][0]
        assert "MERGE" in cypher_query
        assert "ReasoningNode" in cypher_query

    async def test_save_node_passes_correct_params(self):
        """save_node should pass node attributes to the Cypher query."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        node = _make_node()
        await persistence.save_node(node)

        kwargs = mock_session.run.call_args[1]
        assert kwargs["id"] == node.id
        assert kwargs["agent"] == "deep_thinker"
        assert kwargs["session_id"] == _TEST_SESSION_ID
        assert kwargs["confidence"] == 0.85


# ===========================================================================
# T1.2 -- Neo4jPersistence.save_edge()
# ===========================================================================

class TestNeo4jSaveEdge:
    async def test_save_edge_calls_merge_query(self):
        """save_edge should call session.run with a MERGE relationship query."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        edge = _make_edge()
        await persistence.save_edge(edge)

        mock_session.run.assert_called_once()
        cypher_query = mock_session.run.call_args[0][0]
        assert "MERGE" in cypher_query
        assert "RELATES_TO" in cypher_query

    async def test_save_edge_passes_correct_params(self):
        """save_edge should pass edge attributes to the Cypher query."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        edge = _make_edge()
        await persistence.save_edge(edge)

        kwargs = mock_session.run.call_args[1]
        assert kwargs["source_id"] == _TEST_SOURCE_ID
        assert kwargs["target_id"] == _TEST_TARGET_ID
        assert kwargs["relation"] == "LEADS_TO"
        assert kwargs["weight"] == 0.9


# ===========================================================================
# T1.3 -- Neo4jPersistence.save() dispatch
# ===========================================================================

class TestNeo4jSaveDispatch:
    async def test_dispatch_node_added_routes_to_save_node(self):
        """save() with 'node_added' should call save_node."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        await persistence.save("node_added", _make_node())

        mock_session.run.assert_called_once()
        cypher = mock_session.run.call_args[0][0]
        assert "ReasoningNode" in cypher

    async def test_dispatch_edge_added_routes_to_save_edge(self):
        """save() with 'edge_added' should call save_edge."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        await persistence.save("edge_added", _make_edge())

        mock_session.run.assert_called_once()
        cypher = mock_session.run.call_args[0][0]
        assert "RELATES_TO" in cypher

    async def test_dispatch_unknown_event_is_ignored(self):
        """save() with unknown event type should not call session.run."""
        mock_driver, mock_session = _mock_neo4j_driver()

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        persistence = Neo4jPersistence(_settings_with_neo4j())
        await persistence.save("something_else", {"data": 123})

        mock_session.run.assert_not_called()


# ===========================================================================
# T1.4 -- SupabasePersistence.sync_node()
# ===========================================================================

class TestSupabaseSyncNode:
    async def test_sync_node_upserts_correct_row(self):
        """sync_node should call table('thinking_nodes').upsert() with correct row."""
        mock_client, mock_table_fn, mock_upsert, _ = _mock_supabase_client()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        node = _make_node()
        await persistence.sync_node(node)

        mock_table_fn.assert_any_call("thinking_nodes")
        row = None
        for call in mock_upsert.call_args_list:
            candidate = call.args[0]
            if isinstance(candidate, dict) and candidate.get("id") == node.id:
                row = candidate
                break
        assert row is not None
        assert row["id"] == node.id
        assert row["session_id"] == _TEST_SESSION_ID
        assert row["agent_name"] == "deep_thinker"
        assert row["confidence_score"] == 0.85
        assert row["reasoning"] == "Test reasoning content"


# ===========================================================================
# T1.5 -- SupabasePersistence.sync_edge()
# ===========================================================================

class TestSupabaseSyncEdge:
    async def test_sync_edge_upserts_correct_row(self):
        """sync_edge should call table('reasoning_edges').upsert() with correct row."""
        mock_client, mock_table_fn, mock_upsert, _ = _mock_supabase_client()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        edge = _make_edge()
        await persistence.sync_edge(edge)

        mock_table_fn.assert_called_with("reasoning_edges")
        upsert_args = mock_upsert.call_args
        row = upsert_args[0][0]
        assert row["source_id"] == _TEST_SOURCE_ID
        assert row["target_id"] == _TEST_TARGET_ID
        assert row["edge_type"] == "influences"  # LEADS_TO normalizes to "influences"
        assert row["weight"] == 0.9

    async def test_sync_edge_queues_fk_violation_and_retries_on_flush(self):
        """FK failures should queue edges by missing node ID and retry on flush."""
        mock_client = MagicMock()
        edge_execute = MagicMock(
            side_effect=[
                Exception(
                    "{'message': 'insert or update on table \"reasoning_edges\" violates foreign key constraint \"reasoning_edges_source_id_fkey\"'}"
                ),
                MagicMock(data=[]),
            ]
        )
        edge_upsert = MagicMock(return_value=MagicMock(execute=edge_execute))
        edge_table = MagicMock(upsert=edge_upsert)
        mock_client.table = MagicMock(return_value=edge_table)

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        edge = _make_edge()

        await persistence.sync_edge(edge)
        assert _TEST_SOURCE_ID in persistence._pending_edges_by_node

        await persistence._flush_pending_edges_for_node(_TEST_SOURCE_ID)
        assert _TEST_SOURCE_ID not in persistence._pending_edges_by_node
        assert edge_upsert.call_count == 2


# ===========================================================================
# T1.6 -- SupabasePersistence.sync() dispatch
# ===========================================================================

class TestSupabaseSyncDispatch:
    async def test_dispatch_node_added_routes_to_sync_node(self):
        """sync() with 'node_added' should call sync_node."""
        mock_client, mock_table_fn, _, _ = _mock_supabase_client()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        await persistence.sync("node_added", _make_node())

        mock_table_fn.assert_any_call("thinking_nodes")

    async def test_dispatch_edge_added_routes_to_sync_edge(self):
        """sync() with 'edge_added' should call sync_edge."""
        mock_client, mock_table_fn, _, _ = _mock_supabase_client()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        await persistence.sync("edge_added", _make_edge())

        mock_table_fn.assert_called_with("reasoning_edges")

    async def test_dispatch_unknown_event_is_ignored(self):
        """sync() with unknown event type should not call table()."""
        mock_client, mock_table_fn, _, _ = _mock_supabase_client()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        mock_table_fn.reset_mock()
        await persistence.sync("something_else", {"data": 123})

        mock_table_fn.assert_not_called()


# ===========================================================================
# T1.6b -- SupabasePersistence hypothesis lifecycle helpers
# ===========================================================================

class TestSupabaseHypothesisLifecycle:
    async def test_create_hypothesis_experiment_inserts_expected_row(self):
        """create_hypothesis_experiment should insert a valid experiment row."""
        (
            mock_client,
            mock_table_fn,
            mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        experiment_id = await persistence.create_hypothesis_experiment(
            session_id=_TEST_SESSION_ID,
            hypothesis_node_id=_TEST_SOURCE_ID,
            alternative_summary="Use a cache-aware strategy",
            promoted_by="human",
            status="promoted",
            metadata={"source": "test"},
        )

        assert experiment_id is not None
        mock_table_fn.assert_called_with("hypothesis_experiments")
        row = mock_insert.call_args[0][0]
        assert row["session_id"] == _TEST_SESSION_ID
        assert row["hypothesis_node_id"] == _TEST_SOURCE_ID
        assert row["alternative_summary"] == "Use a cache-aware strategy"
        assert row["status"] == "promoted"

    async def test_update_hypothesis_experiment_updates_by_id(self):
        """update_hypothesis_experiment should issue update().eq(id).execute()."""
        (
            mock_client,
            mock_table_fn,
            _mock_insert,
            mock_update,
            mock_eq,
        ) = _mock_supabase_client_with_mutations()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        await persistence.update_hypothesis_experiment(
            _TEST_SOURCE_ID,
            status="comparing",
            comparison_result={"verdict": "improved"},
        )

        mock_table_fn.assert_called_with("hypothesis_experiments")
        update_payload = mock_update.call_args[0][0]
        assert update_payload["status"] == "comparing"
        assert update_payload["comparison_result"]["verdict"] == "improved"
        mock_eq.assert_called_once_with("id", _TEST_SOURCE_ID)

    async def test_create_hypothesis_experiment_action_inserts_expected_row(self):
        """create_hypothesis_experiment_action should insert an action row."""
        (
            mock_client,
            mock_table_fn,
            mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        action_id = await persistence.create_hypothesis_experiment_action(
            experiment_id=_TEST_SOURCE_ID,
            session_id=_TEST_SESSION_ID,
            action="checkpoint",
            performed_by="human",
            details={"verdict": "questionable"},
        )

        assert action_id is not None
        mock_table_fn.assert_called_with("hypothesis_experiment_actions")
        row = mock_insert.call_args[0][0]
        assert row["experiment_id"] == _TEST_SOURCE_ID
        assert row["session_id"] == _TEST_SESSION_ID
        assert row["action"] == "checkpoint"
        assert row["details"]["verdict"] == "questionable"

    async def test_get_hypothesis_experiment_returns_first_row(self):
        """get_hypothesis_experiment should return first row when present."""
        (
            mock_client,
            mock_table_fn,
            _mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        table_obj = mock_table_fn.return_value
        query_obj = table_obj.select.return_value
        query_obj.execute.return_value = MagicMock(
            data=[{"id": _TEST_SOURCE_ID, "session_id": _TEST_SESSION_ID}]
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        row = await persistence.get_hypothesis_experiment(_TEST_SOURCE_ID)

        assert row is not None
        assert row["id"] == _TEST_SOURCE_ID
        mock_table_fn.assert_called_with("hypothesis_experiments")
        table_obj.select.assert_called_with("*")
        query_obj.eq.assert_called_once_with("id", _TEST_SOURCE_ID)

    async def test_list_session_hypothesis_experiments_applies_filters(self):
        """list_session_hypothesis_experiments should apply session/status/limit."""
        (
            mock_client,
            mock_table_fn,
            _mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        table_obj = mock_table_fn.return_value
        query_obj = table_obj.select.return_value
        query_obj.execute.return_value = MagicMock(
            data=[
                {
                    "id": _TEST_SOURCE_ID,
                    "session_id": _TEST_SESSION_ID,
                    "status": "comparing",
                }
            ]
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        rows = await persistence.list_session_hypothesis_experiments(
            _TEST_SESSION_ID,
            status="comparing",
            limit=25,
        )

        assert len(rows) == 1
        assert rows[0]["status"] == "comparing"
        mock_table_fn.assert_called_with("hypothesis_experiments")
        table_obj.select.assert_called_with("*")
        query_obj.eq.assert_any_call("session_id", _TEST_SESSION_ID)
        query_obj.eq.assert_any_call("status", "comparing")
        query_obj.order.assert_called_once_with("last_updated", desc=True)
        query_obj.limit.assert_called_with(25)

    async def test_list_session_hypothesis_experiments_returns_empty_when_table_missing(self):
        """list_session_hypothesis_experiments should degrade to [] on missing table."""
        (
            mock_client,
            mock_table_fn,
            _mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        table_obj = mock_table_fn.return_value
        query_obj = table_obj.select.return_value
        query_obj.execute.side_effect = Exception(
            "{'message': \"Could not find the table 'public.hypothesis_experiments' in the schema cache\", 'code': 'PGRST205'}"
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        rows = await persistence.list_session_hypothesis_experiments(_TEST_SESSION_ID)

        assert rows == []

    async def test_get_hypothesis_experiment_returns_none_when_table_missing(self):
        """get_hypothesis_experiment should degrade to None on missing table."""
        (
            mock_client,
            mock_table_fn,
            _mock_insert,
            _mock_update,
            _mock_eq,
        ) = _mock_supabase_client_with_mutations()

        table_obj = mock_table_fn.return_value
        query_obj = table_obj.select.return_value
        query_obj.execute.side_effect = Exception(
            "{'message': \"Could not find the table 'public.hypothesis_experiments' in the schema cache\", 'code': 'PGRST205'}"
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        row = await persistence.get_hypothesis_experiment(_TEST_SOURCE_ID)

        assert row is None


# ===========================================================================
# T1.7 -- Graceful degradation / retry behavior
# ===========================================================================

class TestPersistenceGracefulDegradation:
    async def test_neo4j_save_catches_connection_error(self):
        """save() should log warning and not crash on connection errors."""
        mock_driver, mock_session = _mock_neo4j_driver()
        mock_session.run.side_effect = ConnectionError("Connection refused")

        Neo4jPersistence = _import_neo4j_persistence()
        neo4j_mod = sys.modules["neo4j"]
        neo4j_mod.AsyncGraphDatabase.driver.return_value = mock_driver

        with patch("asyncio.sleep", new_callable=AsyncMock):
            persistence = Neo4jPersistence(_settings_with_neo4j())
            # save() wraps save_node() in try/except, should not crash
            await persistence.save("node_added", _make_node())

    async def test_supabase_sync_catches_connection_error(self):
        """sync() should log warning and not crash on connection errors."""
        mock_client = MagicMock()
        mock_client.table.side_effect = ConnectionError("Connection refused")

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        with patch("asyncio.sleep", new_callable=AsyncMock):
            persistence = SupabasePersistence(_settings_base())
            # sync() wraps sync_node() in try/except, should not crash
            await persistence.sync("node_added", _make_node())

    async def test_semantic_hypothesis_search_maps_rpc_rows(self):
        """search_structured_reasoning_hypotheses_semantic should map RPC rows."""
        mock_client = MagicMock()
        mock_execute = MagicMock(
            return_value=MagicMock(
                data=[
                    {
                        "hypothesis_id": _TEST_SOURCE_ID,
                        "session_id": _TEST_SESSION_ID,
                        "thinking_node_id": _TEST_SOURCE_ID,
                        "step_id": _TEST_TARGET_ID,
                        "hypothesis_text": "Hypothesis A",
                        "status": "proposed",
                        "confidence": 0.72,
                        "created_at": "2026-02-12T00:00:00+00:00",
                        "importance_score": 0.72,
                        "retained_policy_bonus": 0.0,
                        "similarity": 0.88,
                        "hypothesis_text_hash": "abcd",
                    }
                ]
            )
        )
        mock_client.rpc = MagicMock(
            return_value=MagicMock(execute=mock_execute)
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        rows = await persistence.search_structured_reasoning_hypotheses_semantic(
            [0.1, 0.2, 0.3],
            match_threshold=0.7,
            match_count=4,
        )

        assert len(rows) == 1
        assert rows[0]["hypothesis_id"] == _TEST_SOURCE_ID
        mock_client.rpc.assert_called_once_with(
            "match_structured_reasoning_hypotheses",
            {
                "query_embedding": [0.1, 0.2, 0.3],
                "match_threshold": 0.7,
                "match_count": 4,
                "filter_session_id": None,
                "filter_status": None,
            },
        )

    async def test_semantic_hypothesis_search_returns_empty_when_rpc_missing(self):
        """search_structured_reasoning_hypotheses_semantic should degrade on missing RPC."""
        mock_client = MagicMock()
        mock_client.rpc = MagicMock(
            side_effect=Exception(
                "{'message': \"Could not find function public.match_structured_reasoning_hypotheses\", 'code': 'PGRST202'}"
            )
        )

        SupabasePersistence = _import_supabase_persistence()
        supabase_mod = sys.modules["supabase"]
        supabase_mod.create_client.return_value = mock_client

        persistence = SupabasePersistence(_settings_base())
        rows = await persistence.search_structured_reasoning_hypotheses_semantic(
            [0.1, 0.2, 0.3]
        )

        assert rows == []


# ===========================================================================
# T1.8 -- on_graph_change callback wiring
# ===========================================================================

class TestOnGraphChangeCallback:
    async def test_graph_add_node_fires_listener(self):
        """When graph.add_node() is called, registered listeners should fire."""
        graph = SharedReasoningGraph()
        received_events: list[tuple] = []

        async def listener(event_type: str, data):
            received_events.append((event_type, data))

        graph.on_change(listener)

        node = _make_node()
        await graph.add_node(node)

        assert len(received_events) == 1
        assert received_events[0][0] == "node_added"
        assert received_events[0][1].id == node.id

    async def test_graph_add_edge_fires_listener(self):
        """When graph.add_edge() is called, registered listeners should fire."""
        graph = SharedReasoningGraph()
        received_events: list[tuple] = []

        async def listener(event_type: str, data):
            received_events.append((event_type, data))

        graph.on_change(listener)

        node_a = _make_node()
        node_b = _make_node()
        await graph.add_node(node_a)
        await graph.add_node(node_b)

        edge = ReasoningEdge(
            source_id=node_a.id,
            target_id=node_b.id,
            relation=EdgeRelation.LEADS_TO,
            weight=0.7,
        )
        await graph.add_edge(edge)

        assert len(received_events) == 3
        assert received_events[2][0] == "edge_added"

    async def test_listener_error_does_not_crash_graph(self):
        """A failing listener should not prevent graph mutations."""
        graph = SharedReasoningGraph()

        async def bad_listener(event_type: str, data):
            raise RuntimeError("Listener crashed!")

        graph.on_change(bad_listener)

        node = _make_node()
        node_id = await graph.add_node(node)

        retrieved = await graph.get_node(node_id)
        assert retrieved is not None
