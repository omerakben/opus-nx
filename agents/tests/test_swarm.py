"""Tests for SwarmManager complexity classification."""


from src.swarm import classify_complexity


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
