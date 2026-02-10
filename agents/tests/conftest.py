"""Shared test fixtures for the Opus NX agent test suite."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings
from src.events.bus import EventBus
from src.graph.reasoning_graph import SharedReasoningGraph


@pytest.fixture
def mock_settings() -> Settings:
    """Settings with test values -- no real API keys needed."""
    return Settings(
        anthropic_api_key="sk-ant-test-key",
        supabase_url="http://localhost:54321",
        supabase_service_role_key="test-service-key",
        auth_secret="test-secret-key",
        agent_timeout_seconds=10,
        agent_stagger_seconds=0.1,  # Fast for tests
        neo4j_uri=None,
        neo4j_password=None,
    )


@pytest.fixture
def test_graph() -> SharedReasoningGraph:
    return SharedReasoningGraph()


@pytest.fixture
def test_bus() -> EventBus:
    return EventBus()


# ---------------------------------------------------------------------------
# Smart mock for AsyncAnthropic -- routes responses by system prompt
# ---------------------------------------------------------------------------


class MockStreamResponse:
    """Mock for anthropic streaming response.

    Implements both the async context manager protocol (``async with``)
    and the async iterator protocol (``async for``) required by the
    ``BaseOpusAgent.call_claude`` method.
    """

    def __init__(self, text: str, thinking: str = ""):
        self.text = text
        self.thinking = thinking
        self._events: list = []
        self._index = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self._events):
            raise StopAsyncIteration
        event = self._events[self._index]
        self._index += 1
        return event

    async def get_final_message(self):
        """Return a mock final message with content blocks."""
        content = []
        if self.thinking:
            content.append(
                MagicMock(
                    type="thinking",
                    thinking=self.thinking,
                    signature="test-sig-001",
                )
            )
        content.append(
            MagicMock(
                type="text",
                text=self.text,
            )
        )

        usage = MagicMock()
        usage.input_tokens = 100
        usage.output_tokens = 200

        msg = MagicMock()
        msg.content = content
        msg.usage = usage
        msg.stop_reason = "end_turn"
        return msg


class SmartMockAsyncAnthropic:
    """Mock AsyncAnthropic that routes responses by system prompt.

    Identifies which agent is calling based on system prompt keywords
    and returns appropriate mock responses.
    """

    def __init__(self):
        self.messages = MagicMock()
        self.messages.stream = self._stream

    def _stream(self, **kwargs):
        system = kwargs.get("system", "")

        if "deep" in system.lower() or "thorough" in system.lower():
            return MockStreamResponse(
                text='{"conclusion": "Deep analysis complete", "confidence": 0.9, "key_insights": ["insight1"]}',
                thinking="Deep thinking about the problem...",
            )
        elif "contrarian" in system.lower() or "challenge" in system.lower():
            return MockStreamResponse(
                text='{"conclusion": "Challenge identified", "confidence": 0.75, "challenges": ["challenge1"]}',
                thinking="Challenging assumptions...",
            )
        elif "verif" in system.lower():
            return MockStreamResponse(
                text='{"conclusion": "Verification passed", "confidence": 0.85, "verdict": "correct", "score": 0.88}',
                thinking="Verifying step by step...",
            )
        elif "synth" in system.lower():
            return MockStreamResponse(
                text='{"synthesis": "All perspectives merged", "confidence": 0.82}',
                thinking="Synthesizing all viewpoints...",
            )
        elif "metacog" in system.lower() or "self-reflect" in system.lower():
            return MockStreamResponse(
                text='{"insight_type": "productive_tension", "description": "Healthy debate observed", "confidence": 0.78}',
                thinking="Reflecting on reasoning patterns...",
            )
        else:
            return MockStreamResponse(
                text='{"result": "Generic response"}',
                thinking="Thinking...",
            )


@pytest.fixture
def mock_anthropic():
    """Fixture that patches AsyncAnthropic with SmartMockAsyncAnthropic."""
    mock = SmartMockAsyncAnthropic()
    with patch("anthropic.AsyncAnthropic", return_value=mock):
        yield mock
