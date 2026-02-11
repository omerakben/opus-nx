"""Shared utilities for the Opus NX agent backend.

Provides reusable async retry logic with exponential backoff,
distinguishing transient errors from permanent ones.
"""

from __future__ import annotations

import asyncio
import functools
from collections.abc import Callable
from typing import Any, TypeVar

import structlog

log = structlog.get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])

# Transient error substrings — connection/rate limit/temporary issues
_TRANSIENT_PATTERNS = (
    "timeout",
    "timed out",
    "rate limit",
    "too many requests",
    "temporarily unavailable",
    "service unavailable",
    "connection refused",
    "connection reset",
    "connection error",
    "broken pipe",
    "503",
    "429",
)

# Permanent error substrings — retrying won't help
_PERMANENT_PATTERNS = (
    "auth",
    "unauthorized",
    "forbidden",
    "not found",
    "constraint",
    "unique violation",
    "duplicate key",
    "invalid",
    "permission denied",
)


def _is_transient(exc: Exception) -> bool:
    """Classify an exception as transient (worth retrying) or permanent."""
    msg = str(exc).lower()
    # If it matches a permanent pattern, don't retry
    for pattern in _PERMANENT_PATTERNS:
        if pattern in msg:
            return False
    # If it matches a transient pattern, retry
    for pattern in _TRANSIENT_PATTERNS:
        if pattern in msg:
            return True
    # Default: treat unknown errors as transient (safer for persistence)
    return True


def async_retry(
    max_retries: int = 3,
    backoff_delays: tuple[float, ...] = (1.0, 2.0, 4.0),
) -> Callable[[F], F]:
    """Decorator for async functions that retries on transient errors.

    Args:
        max_retries: Maximum number of retry attempts.
        backoff_delays: Delay in seconds before each retry attempt.

    Permanent errors (auth failures, constraint violations) are logged
    and re-raised immediately without retrying.
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exc: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if not _is_transient(exc):
                        log.warning(
                            "permanent_error_no_retry",
                            func=func.__qualname__,
                            error=str(exc),
                        )
                        raise
                    if attempt < max_retries:
                        delay = backoff_delays[min(attempt, len(backoff_delays) - 1)]
                        log.warning(
                            "transient_error_retrying",
                            func=func.__qualname__,
                            attempt=attempt + 1,
                            max_retries=max_retries,
                            delay_seconds=delay,
                            error=str(exc),
                        )
                        await asyncio.sleep(delay)
                    else:
                        log.error(
                            "all_retries_exhausted",
                            func=func.__qualname__,
                            attempts=max_retries + 1,
                            error=str(exc),
                        )
            raise last_exc  # type: ignore[misc]

        return wrapper  # type: ignore[return-value]

    return decorator
