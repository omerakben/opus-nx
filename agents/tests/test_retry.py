"""Retry logic tests -- async_retry decorator and call_claude rate limit handling.

Tests the retry utilities from src/utils.py and the rate limit retry
logic in BaseOpusAgent.call_claude (src/agents/base.py).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import pytest

from src.utils import async_retry, _is_transient


# ===========================================================================
# T3.1 -- async_retry decorator: transient errors retried then succeed
# ===========================================================================

class TestAsyncRetrySuccess:
    async def test_retries_on_transient_error_then_succeeds(self):
        """Function that fails 2x with transient error then succeeds should be called 3 times."""
        call_count = 0

        @async_retry(max_retries=3, backoff_delays=(0.0, 0.0, 0.0))
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Connection refused")
            return "success"

        result = await flaky_func()
        assert result == "success"
        assert call_count == 3

    async def test_succeeds_on_first_try_no_retries(self):
        """If the function succeeds first try, no retries should happen."""
        call_count = 0

        @async_retry(max_retries=3, backoff_delays=(0.0,))
        async def stable_func():
            nonlocal call_count
            call_count += 1
            return "ok"

        result = await stable_func()
        assert result == "ok"
        assert call_count == 1


# ===========================================================================
# T3.2 -- async_retry with permanent error: no retries
# ===========================================================================

class TestAsyncRetryPermanentError:
    async def test_permanent_error_raises_immediately(self):
        """Permanent errors should raise immediately without retries."""
        call_count = 0

        @async_retry(max_retries=3, backoff_delays=(0.0, 0.0, 0.0))
        async def auth_fail():
            nonlocal call_count
            call_count += 1
            raise PermissionError("Permission denied: unauthorized")

        with pytest.raises(PermissionError, match="Permission denied"):
            await auth_fail()

        assert call_count == 1  # No retries for permanent errors

    async def test_constraint_violation_no_retry(self):
        """Constraint violation errors should not be retried."""
        call_count = 0

        @async_retry(max_retries=3, backoff_delays=(0.0, 0.0, 0.0))
        async def constraint_fail():
            nonlocal call_count
            call_count += 1
            raise ValueError("unique violation: duplicate key")

        with pytest.raises(ValueError, match="unique violation"):
            await constraint_fail()

        assert call_count == 1


# ===========================================================================
# T3.3 -- async_retry retries exhausted
# ===========================================================================

class TestAsyncRetryExhausted:
    async def test_raises_after_all_retries_exhausted(self):
        """If all retries fail, the last exception should be raised."""
        call_count = 0

        @async_retry(max_retries=2, backoff_delays=(0.0, 0.0))
        async def always_fail():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Connection refused")

        with pytest.raises(ConnectionError, match="Connection refused"):
            await always_fail()

        # initial + 2 retries = 3 total
        assert call_count == 3

    async def test_raises_after_max_retries_plus_one(self):
        """Total attempts should be max_retries + 1."""
        call_count = 0

        @async_retry(max_retries=4, backoff_delays=(0.0, 0.0, 0.0, 0.0))
        async def timeout_func():
            nonlocal call_count
            call_count += 1
            raise TimeoutError("timed out")

        with pytest.raises(TimeoutError):
            await timeout_func()

        assert call_count == 5  # 1 initial + 4 retries


# ===========================================================================
# T3.4 -- _is_transient() classification
# ===========================================================================

class TestIsTransient:
    def test_timeout_is_transient(self):
        assert _is_transient(TimeoutError("Connection timed out")) is True

    def test_rate_limit_is_transient(self):
        assert _is_transient(Exception("429 Too Many Requests rate limit exceeded")) is True

    def test_connection_refused_is_transient(self):
        assert _is_transient(ConnectionError("Connection refused")) is True

    def test_service_unavailable_is_transient(self):
        assert _is_transient(Exception("503 Service Unavailable temporarily unavailable")) is True

    def test_auth_error_is_permanent(self):
        assert _is_transient(Exception("unauthorized: invalid API key")) is False

    def test_constraint_error_is_permanent(self):
        assert _is_transient(Exception("constraint violation: unique key")) is False

    def test_not_found_is_permanent(self):
        assert _is_transient(Exception("not found: resource does not exist")) is False

    def test_permission_denied_is_permanent(self):
        assert _is_transient(Exception("permission denied")) is False

    def test_unknown_error_defaults_to_transient(self):
        """Unknown errors (no pattern match) should default to transient."""
        assert _is_transient(Exception("something weird happened")) is True


# ===========================================================================
# T3.5 -- call_claude rate limit retry
# ===========================================================================

class TestCallClaudeRateLimitRetry:
    async def test_rate_limit_retry_succeeds_on_third_attempt(
        self, mock_settings, test_graph, test_bus
    ):
        """call_claude should retry on RateLimitError and succeed."""
        from tests.conftest import MockStreamResponse

        call_count = 0

        def mock_stream(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise anthropic.RateLimitError(
                    message="Rate limit exceeded",
                    response=MagicMock(status_code=429, headers={}),
                    body=None,
                )
            return MockStreamResponse(
                text='{"result": "success"}',
                thinking="Recovered after rate limit...",
            )

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.stream = mock_stream

        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            from src.agents.deep_thinker import DeepThinkerAgent

            agent = DeepThinkerAgent(
                test_graph, test_bus, "rate-limit-session",
                api_key="sk-test",
            )
            # Replace the client with our mock
            agent.client = mock_client

            # Patch asyncio.sleep to avoid real delays
            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await agent.call_claude(
                    [{"role": "user", "content": "test"}]
                )

        # The call succeeded (didn't raise)
        assert call_count == 3
        # Usage from get_final_message() should be present
        assert result["usage"]["input_tokens"] == 100
        assert result["usage"]["output_tokens"] == 200

    async def test_rate_limit_accumulators_reset_between_retries(
        self, mock_settings, test_graph, test_bus
    ):
        """Accumulators (thinking, text, content_blocks) should reset on retry."""
        from tests.conftest import MockStreamResponse

        call_count = 0

        def mock_stream(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise anthropic.RateLimitError(
                    message="Rate limit exceeded",
                    response=MagicMock(status_code=429, headers={}),
                    body=None,
                )
            return MockStreamResponse(
                text="clean response",
                thinking="clean thinking",
            )

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.stream = mock_stream

        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            from src.agents.deep_thinker import DeepThinkerAgent

            agent = DeepThinkerAgent(
                test_graph, test_bus, "reset-session",
                api_key="sk-test",
            )
            agent.client = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await agent.call_claude(
                    [{"role": "user", "content": "test"}]
                )

        # call_claude succeeded on attempt 2
        assert call_count == 2
        # Content blocks from get_final_message should contain the second attempt's text
        text_blocks = [b for b in result["content_blocks"] if b["type"] == "text"]
        assert len(text_blocks) == 1
        assert text_blocks[0]["text"] == "clean response"


# ===========================================================================
# T3.6 -- call_claude rate limit retries exhausted
# ===========================================================================

class TestCallClaudeRateLimitExhausted:
    async def test_raises_after_all_rate_limit_retries(
        self, mock_settings, test_graph, test_bus
    ):
        """4 consecutive rate limit errors should raise RateLimitError."""
        call_count = 0

        def mock_stream(**kwargs):
            nonlocal call_count
            call_count += 1
            raise anthropic.RateLimitError(
                message="Rate limit exceeded",
                response=MagicMock(status_code=429, headers={}),
                body=None,
            )

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.stream = mock_stream

        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            from src.agents.deep_thinker import DeepThinkerAgent

            agent = DeepThinkerAgent(
                test_graph, test_bus, "exhausted-session",
                api_key="sk-test",
            )
            agent.client = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(anthropic.RateLimitError):
                    await agent.call_claude(
                        [{"role": "user", "content": "test"}]
                    )

        # 1 initial + 3 retries = 4 total (from _RATE_LIMIT_MAX_RETRIES=3)
        assert call_count == 4
