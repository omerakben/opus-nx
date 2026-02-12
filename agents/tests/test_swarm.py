"""Tests for SwarmManager complexity classification."""


from unittest.mock import AsyncMock, MagicMock

from src.swarm import SwarmManager, classify_complexity


class TestComplexityClassification:
    """Ported from V1 orchestrator.ts complexity patterns."""

    def test_simple_greetings(self):
        assert classify_complexity("hi") == "simple"
        assert classify_complexity("hello") == "simple"
        assert classify_complexity("hey") == "simple"
        assert classify_complexity("thanks") == "simple"
        assert classify_complexity("thank you") == "simple"

    def test_simple_questions(self):
        assert classify_complexity("What is Python?") == "simple"
        assert classify_complexity("Who is Alan Turing?") == "simple"
        assert classify_complexity("When was Linux created?") == "simple"

    def test_simple_commands(self):
        assert classify_complexity("Define recursion") == "simple"
        assert classify_complexity("explain briefly what REST is") == "simple"
        assert classify_complexity("summarize this article") == "simple"

    def test_complex_debugging(self):
        assert classify_complexity("debug this memory leak") == "complex"
        assert classify_complexity("troubleshoot the connection issue") == "complex"
        assert classify_complexity("diagnose why tests are failing") == "complex"
        assert classify_complexity("fix the auth bug") == "complex"

    def test_complex_architecture(self):
        assert classify_complexity("architect a microservices system") == "complex"
        assert classify_complexity("design a caching strategy") == "complex"
        assert classify_complexity("plan the migration") == "complex"

    def test_complex_analysis(self):
        assert classify_complexity("compare and contrast SQL vs NoSQL") == "complex"
        assert classify_complexity("analyze trade-offs of different approaches") == "complex"
        assert classify_complexity("research the best framework") == "complex"
        assert classify_complexity("deep dive into performance") == "complex"

    def test_complex_multi_step(self):
        assert classify_complexity("build step by step a deployment pipeline") == "complex"
        assert classify_complexity("create a multi-step workflow") == "complex"
        assert classify_complexity("refactor the auth module") == "complex"
        assert classify_complexity("optimize performance of the query") == "complex"

    def test_standard_default(self):
        assert classify_complexity("help me build a todo app") == "standard"
        assert classify_complexity("write a function to sort a list") == "standard"
        assert classify_complexity("how do I use React hooks?") == "standard"


class TestReasoningRehydration:
    async def test_build_context_returns_empty_without_persistence(
        self, mock_settings, test_graph, test_bus
    ):
        swarm = SwarmManager(mock_settings, test_graph, test_bus, persistence=None)
        context = await swarm._build_reasoning_rehydration_context(
            "Analyze model reliability",
            "session-current",
        )
        assert context == ""

    async def test_build_context_selects_prior_session_artifacts(
        self, mock_settings, test_graph, test_bus
    ):
        persistence = MagicMock()
        persistence.generate_reasoning_embedding = AsyncMock(return_value=[0.1, 0.2, 0.3])
        persistence.search_reasoning_artifacts = AsyncMock(
            return_value=[
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "session_id": "session-current",
                    "content": "Current-session artifact should be deprioritized.",
                    "similarity": 0.93,
                    "importance_score": 0.77,
                },
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "session_id": "session-prior-a",
                    "content": "Prior artifact A with relevant hypothesis.",
                    "similarity": 0.91,
                    "importance_score": 0.81,
                },
                {
                    "id": "33333333-3333-3333-3333-333333333333",
                    "session_id": "session-prior-b",
                    "content": "Prior artifact B with trade-off analysis.",
                    "similarity": 0.88,
                    "importance_score": 0.73,
                },
            ]
        )
        persistence.mark_reasoning_artifact_used = AsyncMock(return_value=None)
        persistence.create_session_rehydration_run = AsyncMock(return_value="run-id")

        swarm = SwarmManager(mock_settings, test_graph, test_bus, persistence=persistence)
        context = await swarm._build_reasoning_rehydration_context(
            "Analyze model reliability",
            "session-current",
        )

        assert "session=session-prior-a" in context
        assert "session=session-prior-b" in context
        assert "session=session-current" not in context
        persistence.generate_reasoning_embedding.assert_awaited_once()
        persistence.search_reasoning_artifacts.assert_awaited_once()
        assert persistence.mark_reasoning_artifact_used.await_count == 2
        persistence.create_session_rehydration_run.assert_awaited_once()

    async def test_build_context_merges_artifact_and_hypothesis_candidates_with_dedupe(
        self, mock_settings, test_graph, test_bus
    ):
        persistence = MagicMock()
        persistence.generate_reasoning_embedding = AsyncMock(return_value=[0.1, 0.2, 0.3])
        persistence.search_reasoning_artifacts = AsyncMock(
            return_value=[
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "session_id": "session-current",
                    "content": "Duplicate hypothesis body",
                    "similarity": 0.70,
                    "importance_score": 0.61,
                },
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "session_id": "session-prior-a",
                    "content": "Prior artifact retained strategy",
                    "similarity": 0.78,
                    "importance_score": 0.86,
                    "snapshot": {"retention_decision": "retain"},
                },
            ]
        )
        persistence.search_structured_reasoning_hypotheses_semantic = AsyncMock(
            return_value=[
                {
                    "hypothesis_id": "33333333-3333-3333-3333-333333333333",
                    "session_id": "session-current",
                    "hypothesis_text": "Duplicate hypothesis body",
                    "hypothesis_text_hash": "dup-hash",
                    "similarity": 0.88,
                    "importance_score": 0.84,
                    "retained_policy_bonus": 0.0,
                    "created_at": "2026-02-12T00:00:00+00:00",
                },
                {
                    "hypothesis_id": "44444444-4444-4444-4444-444444444444",
                    "session_id": "session-prior-b",
                    "hypothesis_text": "Prior hypothesis from checkpoint loop",
                    "hypothesis_text_hash": "prior-hash",
                    "similarity": 0.82,
                    "importance_score": 0.75,
                    "retained_policy_bonus": 1.0,
                    "created_at": "2026-02-12T00:00:00+00:00",
                },
            ]
        )
        persistence.mark_reasoning_artifact_used = AsyncMock(return_value=None)
        persistence.create_session_rehydration_run = AsyncMock(return_value="run-id")

        swarm = SwarmManager(mock_settings, test_graph, test_bus, persistence=persistence)
        context = await swarm._build_reasoning_rehydration_context(
            "Analyze reliability failures",
            "session-current",
        )

        assert "source=hypothesis" in context
        assert "source=artifact" in context
        # Prior-session candidates are prioritized when available.
        assert "Duplicate hypothesis body" not in context
        # Cross-session retrieval should be favored near the top of context.
        first_candidate_line = next(
            line for line in context.splitlines() if line.strip().startswith("1.")
        )
        assert "session=session-prior" in first_candidate_line
