"""Base agent class for the Opus NX swarm.

Every agent shares the same Claude API calling pattern, tool interface,
and event publishing. Uses AsyncAnthropic with Opus 4.6 adaptive thinking.

Key invariants:
- Thinking block signatures are PRESERVED from the API, never fabricated
- content_blocks preserves ALL blocks for multi-turn tool loop continuation
- All operations are async (AsyncAnthropic, not Anthropic)
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod

import anthropic

from ..events.bus import EventBus
from ..events.types import AgentCompleted, AgentStarted, AgentThinking
from ..graph.models import AgentName, AgentResult
from ..graph.reasoning_graph import SharedReasoningGraph


class BaseOpusAgent(ABC):
    """Base class for all Opus NX swarm agents.

    Subclasses must define: name, system_prompt, get_tools(), run().
    Optionally override: effort, max_tokens.
    """

    name: AgentName
    effort: str = "high"  # low | medium | high | max
    max_tokens: int = 16384
    system_prompt: str = ""

    def __init__(
        self,
        graph: SharedReasoningGraph,
        bus: EventBus,
        session_id: str,
        api_key: str | None = None,
    ) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=api_key) if api_key else anthropic.AsyncAnthropic()
        self.graph = graph
        self.bus = bus
        self.session_id = session_id

    @abstractmethod
    async def run(self, query: str, context: dict | None = None) -> AgentResult:
        """Execute the agent's primary task."""
        ...

    @abstractmethod
    def get_tools(self) -> list[dict]:
        """Return the tool definitions available to this agent."""
        ...

    async def call_claude(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        stream_thinking: bool = True,
    ) -> dict:
        """Call Claude Opus 4.6 with adaptive thinking + streaming.

        Returns dict with keys: thinking, text, tool_uses, content_blocks,
        usage, duration_ms, stop_reason.

        CRITICAL: content_blocks preserves thinking block signatures from
        the API for multi-turn continuation. Never fabricate signatures.
        """
        start = time.monotonic()

        params: dict = {
            "model": "claude-opus-4-6",
            "max_tokens": self.max_tokens,
            "thinking": {"type": "adaptive"},
            "output_config": {"effort": self.effort},
            "system": self.system_prompt,
            "messages": messages,
        }
        if tools:
            params["tools"] = tools

        thinking_text = ""
        response_text = ""
        tool_uses: list[dict] = []
        # Preserve ALL content blocks for multi-turn tool loops
        content_blocks: list[dict] = []

        async with self.client.messages.stream(**params) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "thinking_delta":
                        thinking_text += event.delta.thinking
                        if stream_thinking:
                            await self.bus.publish(
                                self.session_id,
                                AgentThinking(
                                    session_id=self.session_id,
                                    agent=self.name.value,
                                    delta=event.delta.thinking,
                                ),
                            )
                    elif event.delta.type == "text_delta":
                        response_text += event.delta.text

            # Get the final message for complete content blocks and usage
            final = await stream.get_final_message()

        # Collect content blocks — MUST preserve for tool loop continuation
        for block in final.content:
            if block.type == "thinking":
                content_blocks.append({
                    "type": "thinking",
                    "thinking": block.thinking,
                    "signature": block.signature,  # REAL signature from API
                })
            elif block.type == "redacted_thinking":
                content_blocks.append({
                    "type": "redacted_thinking",
                    "data": block.data,
                })
            elif block.type == "tool_use":
                tool_uses.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
                content_blocks.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
            elif block.type == "text":
                content_blocks.append({
                    "type": "text",
                    "text": block.text,
                })

        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "thinking": thinking_text,
            "text": response_text,
            "tool_uses": tool_uses,
            "content_blocks": content_blocks,  # For multi-turn continuation
            "usage": {
                "input_tokens": final.usage.input_tokens,
                "output_tokens": final.usage.output_tokens,
            },
            "duration_ms": duration_ms,
            "stop_reason": final.stop_reason,
        }

    async def run_tool_loop(
        self,
        initial_messages: list[dict],
        tools: list[dict],
        max_iterations: int = 5,
    ) -> dict:
        """Run a multi-turn tool loop until Claude stops calling tools.

        CRITICAL: Thinking block signatures are preserved from the stream,
        never fabricated. The API validates signatures and will reject
        fabricated ones.

        Returns dict with keys: thinking, text, tokens_used, duration_ms.
        """
        messages = list(initial_messages)
        all_thinking = ""
        final_text = ""
        total_tokens = 0
        total_duration = 0

        for _ in range(max_iterations):
            result = await self.call_claude(messages, tools)
            all_thinking += result["thinking"]
            total_tokens += result["usage"]["output_tokens"]
            total_duration += result["duration_ms"]

            if result["stop_reason"] == "end_turn" or not result["tool_uses"]:
                final_text = result["text"]
                break

            # Build assistant message using preserved content blocks
            # This includes thinking blocks with REAL signatures from the API
            messages.append({
                "role": "assistant",
                "content": result["content_blocks"],
            })

            # Execute tools and add results
            tool_results = []
            for tu in result["tool_uses"]:
                tool_result = await self.execute_tool(tu["name"], tu["input"])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu["id"],
                    "content": tool_result,
                })

            messages.append({"role": "user", "content": tool_results})

        return {
            "thinking": all_thinking,
            "text": final_text,
            "tokens_used": total_tokens,
            "duration_ms": total_duration,
        }

    async def execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """Execute a tool by name. Dispatches to tool_{name} methods."""
        handler = getattr(self, f"tool_{tool_name}", None)
        if handler:
            return await handler(tool_input)
        return f"Unknown tool: {tool_name}"

    async def emit_started(self) -> None:
        """Emit an AgentStarted event."""
        await self.bus.publish(
            self.session_id,
            AgentStarted(
                session_id=self.session_id,
                agent=self.name.value,
                effort=self.effort,
            ),
        )

    async def emit_completed(
        self,
        conclusion: str,
        confidence: float,
        tokens_used: int,
    ) -> None:
        """Emit an AgentCompleted event."""
        await self.bus.publish(
            self.session_id,
            AgentCompleted(
                session_id=self.session_id,
                agent=self.name.value,
                conclusion_preview=conclusion[:200],
                confidence=confidence,
                tokens_used=tokens_used,
            ),
        )
