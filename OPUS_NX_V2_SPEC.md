# Opus NX V2: The Swarm — Complete Implementation Cookbook

> **Role**: Principal System Design Architect + VP Product Development
> **Goal**: Build a hackathon-winning multi-agent swarm that proves Opus 4.6 is unmatched
> **Timeline**: 7 days | **API Tier**: 2 | **Model**: claude-opus-4-6
> **SDK**: `anthropic` v0.78.0+ (AsyncAnthropic) — NOT the Claude Agent SDK

---

## Context

Opus NX V1 has ~4,499 lines of working TypeScript across 6 core modules (ThinkingEngine, ThinkFork, Metacognition, PRM Verifier, ThinkGraph, Orchestrator) with 42 frontend components, 25 API routes, 6 Supabase migrations, and full test coverage.

**V1 already uses the correct Opus 4.6 API pattern** — `thinking: {type: "adaptive"}` + `output_config: {effort: ...}` (thinking-engine.ts, lines 179-184). The deprecated `budget_tokens` pattern exists only as a legacy fallback.

**What V1 lacks**: inter-agent communication, shared reasoning substrate, and agent autonomy. V2 adds a Python agent layer that runs N concurrent Opus 4.6 agents sharing a live in-memory graph, with real-time WebSocket streaming to the existing dashboard.

**API Tier 2 limits**: 1,000 req/min, 80K input tokens/min — supports 3 concurrent agents with staggered starts (2.5s apart), with Synthesizer and Metacognition running sequentially after primaries.

---

## Architecture

```
                    +----------------------------+
                    |  Next.js Dashboard (Web)    |
                    |  42 existing components      |
                    |  + SwarmView, AgentCard      |
                    +----------+-----------------+
                               | WebSocket (events)
                               | HTTP (REST)
                    +----------v-----------------+
                    |  FastAPI Server (Python)     |
                    |  /ws/{session_id}            |
                    |  /api/swarm                  |
                    |  /api/health                 |
                    +----------+-----------------+
                               |
                    +----------v-----------------+
                    |    Maestro Agent             |
                    |    (Task Decomposition)      |
                    +----------+-----------------+
                               | deploys (staggered 2.5s)
                +--------------+-------------+
                |              |             |
       +--------v---+  +------v----+  +-----v------+
       | Deep       |  |Contrarian |  | Verifier   |
       | Thinker    |  |(Devil's   |  | (PRM       |
       | (max)      |  |Advocate)  |  | Scoring)   |
       +-----+------+  +-----+----+  +-----+------+
             |              |              |
       +-----v--------------v--------------v------+
       |       SharedReasoningGraph                |
       |  NetworkX (hot) --sync--> Neo4j (warm)    |
       |  asyncio.Lock for concurrent access       |
       +-------------------+-----------------------+
                           |
                +----------v-----------+
                |      EventBus        |
                |  asyncio.Queue       |
                |  Events -> WebSocket |
                +----------+-----------+
                           |
          After primary agents complete:
                +----------v-----------+
                |  Synthesizer Agent   |
                |  Metacognition Agent |
                |  (Phase 2 agents)    |
                +----------------------+
```

---

## Project Structure

```
opus-nx/
├── agents/                              # NEW: Python agent backend
│   ├── pyproject.toml                  # uv project config
│   ├── uv.lock                        # Lockfile (committed)
│   ├── Dockerfile                      # Fly.io deployment
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py                     # Entry point: uvicorn
│   │   ├── server.py                   # FastAPI app + WebSocket
│   │   ├── config.py                   # pydantic-settings
│   │   ├── maestro.py                  # Maestro orchestrator
│   │   ├── swarm.py                    # SwarmManager
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                # BaseOpusAgent
│   │   │   ├── deep_thinker.py
│   │   │   ├── contrarian.py
│   │   │   ├── verifier.py
│   │   │   ├── synthesizer.py
│   │   │   └── metacognition.py
│   │   ├── graph/
│   │   │   ├── __init__.py
│   │   │   ├── reasoning_graph.py     # NetworkX shared graph
│   │   │   ├── neo4j_client.py        # Neo4j persistence
│   │   │   └── models.py             # Pydantic models
│   │   ├── events/
│   │   │   ├── __init__.py
│   │   │   ├── bus.py                 # Event bus
│   │   │   └── types.py              # Event schemas
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── graph_tools.py        # Read/write graph
│   │   │   └── verification.py       # PRM tools
│   │   └── persistence/
│   │       ├── __init__.py
│   │       └── supabase_sync.py      # Sync to Supabase
│   └── tests/
│       ├── conftest.py
│       ├── test_graph.py
│       ├── test_agents.py
│       └── test_swarm.py
├── apps/web/                            # EXISTING: Adapted
│   └── src/
│       ├── hooks/
│       │   └── use-swarm-socket.ts     # NEW
│       ├── components/
│       │   └── swarm/
│       │       ├── SwarmView.tsx       # NEW
│       │       ├── AgentCard.tsx       # NEW
│       │       └── SwarmControls.tsx   # NEW
│       ├── lib/
│       │   └── colors.ts              # MODIFY: add edge colors
│       └── app/api/
│           └── swarm/route.ts          # NEW: proxy
├── supabase/migrations/
│   └── 007_swarm_edges.sql             # NEW
├── infra/
│   ├── docker-compose.yml              # Local dev
│   └── fly.toml                        # Python deployment
└── shared/
    └── event-types.ts                   # Shared TS types
```

Estimated total new code: ~3,200 lines Python + ~600 lines TypeScript = ~3,800 lines.

---

## Component Specifications

### SPEC 1: Configuration (`agents/src/config.py`)

**WHY**: Single source of truth for all settings. Validates at startup — no silent failures from missing env vars.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Required
    anthropic_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    auth_secret: str

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    # Agent behavior
    agent_timeout_seconds: int = 120
    agent_stagger_seconds: float = 2.5
    max_concurrent_agents: int = 6

    # Neo4j (optional — system works without it)
    neo4j_uri: str | None = None
    neo4j_user: str | None = None
    neo4j_password: str | None = None
```

**Lines**: ~50 | **Effort**: 30 min

---

### SPEC 2: Pydantic Models (`agents/src/graph/models.py`)

```python
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import uuid4
from enum import Enum

class AgentName(str, Enum):
    MAESTRO = "maestro"
    DEEP_THINKER = "deep_thinker"
    CONTRARIAN = "contrarian"
    VERIFIER = "verifier"
    SYNTHESIZER = "synthesizer"
    METACOGNITION = "metacognition"

class EdgeRelation(str, Enum):
    LEADS_TO = "LEADS_TO"
    CHALLENGES = "CHALLENGES"
    VERIFIES = "VERIFIES"
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    MERGES = "MERGES"
    OBSERVES = "OBSERVES"

class ReasoningNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent: AgentName
    session_id: str
    content: str
    reasoning: str | None = None
    confidence: float = 0.0
    decision_points: list[dict] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReasoningEdge(BaseModel):
    source_id: str
    target_id: str
    relation: EdgeRelation
    weight: float = 1.0
    metadata: dict = {}

class AgentResult(BaseModel):
    agent: AgentName
    status: str  # "completed" | "timeout" | "error"
    reasoning: str
    conclusion: str
    confidence: float
    node_ids: list[str] = []
    tokens_used: int = 0
    duration_ms: int = 0

class SwarmResult(BaseModel):
    session_id: str
    query: str
    agents: list[AgentResult]
    synthesis: str | None = None
    metacognition_insights: list[dict] = []
    total_tokens: int = 0
    total_duration_ms: int = 0
```

**Lines**: ~120 | **Effort**: 1 hour

---

### SPEC 3: SharedReasoningGraph (`agents/src/graph/reasoning_graph.py`)

**WHY**: The shared substrate where agents collaborate. Without this, they're just parallel API calls.
**HOW**: NetworkX for fast reads/writes, `asyncio.Lock` for coroutine safety, background sync to Neo4j + Supabase.

```python
import asyncio
import networkx as nx
from uuid import uuid4
from datetime import datetime
from .models import ReasoningNode, ReasoningEdge, EdgeRelation, AgentName

class SharedReasoningGraph:
    """In-memory reasoning graph. All agent interactions flow through here."""

    def __init__(self):
        self._graph = nx.DiGraph()
        self._lock = asyncio.Lock()
        self._listeners: list[callable] = []

    async def add_node(self, node: ReasoningNode) -> str:
        """Add a reasoning node. Notifies listeners for real-time streaming."""
        async with self._lock:
            self._graph.add_node(node.id, **node.model_dump())
            await self._notify("node_added", node)
            return node.id

    async def add_edge(self, edge: ReasoningEdge) -> None:
        """Add a relationship edge between nodes."""
        async with self._lock:
            self._graph.add_edge(
                edge.source_id, edge.target_id,
                **edge.model_dump(exclude={"source_id", "target_id"})
            )
            await self._notify("edge_added", edge)

    async def get_nodes_by_agent(self, agent: AgentName) -> list[dict]:
        """Get all reasoning nodes from a specific agent."""
        return [
            {**data, "id": nid}
            for nid, data in self._graph.nodes(data=True)
            if data.get("agent") == agent.value
        ]

    async def get_session_nodes(self, session_id: str) -> list[dict]:
        """Get all nodes for a session, ordered by creation time."""
        nodes = [
            {**data, "id": nid}
            for nid, data in self._graph.nodes(data=True)
            if data.get("session_id") == session_id
        ]
        return sorted(nodes, key=lambda n: n.get("created_at", ""))

    async def get_challenges_for(self, node_id: str) -> list[dict]:
        """Get all CHALLENGES edges targeting a node."""
        challenges = []
        for src, _tgt, data in self._graph.in_edges(node_id, data=True):
            if data.get("relation") == EdgeRelation.CHALLENGES.value:
                src_data = self._graph.nodes.get(src, {})
                challenges.append({"source_node": {**src_data, "id": src}, "edge": data})
        return challenges

    async def get_verifications_for(self, node_id: str) -> list[dict]:
        """Get all VERIFIES edges targeting a node."""
        verifications = []
        for src, _tgt, data in self._graph.in_edges(node_id, data=True):
            if data.get("relation") == EdgeRelation.VERIFIES.value:
                src_data = self._graph.nodes.get(src, {})
                verifications.append({"source_node": {**src_data, "id": src}, "edge": data})
        return verifications

    def to_json(self) -> dict:
        """Export graph as JSON for API responses and dashboard."""
        return nx.node_link_data(self._graph)

    def on_change(self, callback: callable):
        """Register a listener for graph changes (feeds EventBus)."""
        self._listeners.append(callback)

    async def _notify(self, event_type: str, data):
        """Notify all listeners of graph changes."""
        for listener in self._listeners:
            try:
                await listener(event_type, data)
            except Exception:
                pass  # Don't let listener errors crash the graph
```

**SO WHAT**: Every agent reads/writes through this single graph. When Deep Thinker writes a node, Contrarian can immediately read it. When Contrarian creates a CHALLENGES edge, the dashboard sees it instantly via the listener callback.

**Lines**: ~250 | **Effort**: 3 hours

---

### SPEC 4: Event Bus (`agents/src/events/bus.py`)

**WHY**: Real-time bridge between agents and the dashboard. Per-session asyncio.Queue pub/sub.

```python
import asyncio
from .types import SwarmEvent

class EventBus:
    """In-process event bus. Each session gets its own set of subscriber queues."""

    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    async def publish(self, session_id: str, event: SwarmEvent) -> None:
        for queue in self._subscribers.get(session_id, []):
            try:
                queue.put_nowait(event.model_dump())
            except asyncio.QueueFull:
                pass  # Drop events if subscriber is too slow

    def subscribe(self, session_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subscribers.setdefault(session_id, []).append(queue)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        if session_id in self._subscribers:
            self._subscribers[session_id] = [
                q for q in self._subscribers[session_id] if q is not queue
            ]
```

**Lines**: ~60 | **Effort**: 30 min

---

### SPEC 5: Event Types (`agents/src/events/types.py`)

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class SwarmEvent(BaseModel):
    event: str
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SwarmStarted(SwarmEvent):
    event: Literal["swarm_started"] = "swarm_started"
    agents: list[str]
    query: str

class AgentStarted(SwarmEvent):
    event: Literal["agent_started"] = "agent_started"
    agent: str
    effort: str

class AgentThinking(SwarmEvent):
    event: Literal["agent_thinking"] = "agent_thinking"
    agent: str
    delta: str  # Streaming thinking text

class GraphNodeCreated(SwarmEvent):
    event: Literal["graph_node_created"] = "graph_node_created"
    node_id: str
    agent: str
    content_preview: str

class AgentChallenges(SwarmEvent):
    event: Literal["agent_challenges"] = "agent_challenges"
    challenger: str
    target_node_id: str
    argument_preview: str

class VerificationScore(SwarmEvent):
    event: Literal["verification_score"] = "verification_score"
    node_id: str
    score: float
    verdict: str  # correct | incorrect | uncertain

class AgentCompleted(SwarmEvent):
    event: Literal["agent_completed"] = "agent_completed"
    agent: str
    conclusion_preview: str
    confidence: float
    tokens_used: int

class SynthesisReady(SwarmEvent):
    event: Literal["synthesis_ready"] = "synthesis_ready"
    synthesis: str
    confidence: float

class MetacognitionInsight(SwarmEvent):
    event: Literal["metacognition_insight"] = "metacognition_insight"
    insight_type: str  # swarm_bias | groupthink | productive_tension
    description: str
    affected_agents: list[str]
```

**Lines**: ~80 | **Effort**: 1 hour

---

### SPEC 6: BaseOpusAgent (`agents/src/agents/base.py`)

**WHY**: Every agent shares the same Claude API calling pattern, tool interface, and event publishing.
**HOW**: Uses `AsyncAnthropic` with Opus 4.6 adaptive thinking. `call_claude()` streams thinking deltas to the EventBus. `run_tool_loop()` preserves thinking block signatures across turns.

**CRITICAL**: Uses `AsyncAnthropic` (async client), NOT `Anthropic` (sync) — everything in the swarm is async.

```python
import anthropic
import asyncio
import time
from abc import ABC, abstractmethod
from ..graph.reasoning_graph import SharedReasoningGraph
from ..events.bus import EventBus
from ..events.types import AgentStarted, AgentThinking, AgentCompleted
from ..graph.models import AgentName, AgentResult

class BaseOpusAgent(ABC):
    """Base class for all Opus NX swarm agents."""

    name: AgentName
    effort: str = "high"             # low | medium | high | max
    max_tokens: int = 16384
    system_prompt: str = ""

    def __init__(self, graph: SharedReasoningGraph, bus: EventBus, session_id: str):
        self.client = anthropic.AsyncAnthropic()  # async client
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
        """
        Call Claude Opus 4.6 with adaptive thinking + streaming.

        Returns dict with keys: thinking, text, tool_uses, content_blocks, usage
        """
        start = time.monotonic()

        params = {
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
        tool_uses = []
        # Preserve ALL content blocks for multi-turn tool loops
        content_blocks = []

        async with self.client.messages.stream(**params) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "thinking_delta":
                        thinking_text += event.delta.thinking
                        if stream_thinking:
                            await self.bus.publish(self.session_id, AgentThinking(
                                session_id=self.session_id,
                                agent=self.name.value,
                                delta=event.delta.thinking,
                            ))
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
        """
        Run a multi-turn tool loop until Claude stops calling tools.

        CRITICAL: Thinking block signatures are preserved from the stream,
        never fabricated. The API validates signatures and will reject
        fabricated ones.
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
        """Execute a tool by name. Override in subclasses for custom tools."""
        handler = getattr(self, f"tool_{tool_name}", None)
        if handler:
            return await handler(tool_input)
        return f"Unknown tool: {tool_name}"
```

**Key differences from the previous spec version**:
1. Uses `AsyncAnthropic()`, not `Anthropic()` — all operations are async
2. `thinking={"type": "adaptive"}` + `output_config={"effort": self.effort}` — NO `budget_tokens`
3. Thinking signatures are **preserved from the stream** via `block.signature`, never fabricated
4. `content_blocks` preserves ALL blocks (thinking + tool_use + text) for multi-turn continuation
5. Multi-turn `run_tool_loop` passes `content_blocks` directly as assistant message content

**Lines**: ~180 | **Effort**: 4 hours

---

### SPEC 7: Deep Thinker Agent (`agents/src/agents/deep_thinker.py`)

**WHY**: Maximum thinking depth for thorough analysis. Writes structured reasoning to the shared graph.
**Effort**: `max` — uses Opus 4.6's full adaptive thinking.

**System Prompt**:

```
You are Deep Thinker, an analytical reasoning specialist within the Opus NX swarm.
Your role is to provide the deepest, most thorough analysis of the user's question.

APPROACH:
- Break the problem into fundamental components
- Consider multiple perspectives and frameworks
- Identify key assumptions and their implications
- Trace cause-and-effect chains to their conclusions
- Quantify uncertainty where possible

OUTPUT:
Use the write_reasoning_node tool to persist your key reasoning steps to the shared graph.
Use the mark_decision_point tool when you identify a critical juncture where multiple paths exist.

Other agents in the swarm (Contrarian, Verifier) will read your reasoning and respond to it.
Write clearly so they can engage with your logic.
```

**Tools**:

```python
DEEP_THINKER_TOOLS = [
    {
        "name": "write_reasoning_node",
        "description": "Write a reasoning step to the shared graph. Other agents will read this.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The reasoning step or conclusion"},
                "confidence": {"type": "number", "description": "Confidence 0.0-1.0"},
                "reasoning_type": {
                    "type": "string",
                    "enum": ["analysis", "hypothesis", "conclusion", "assumption", "evidence"],
                }
            },
            "required": ["content", "confidence"]
        }
    },
    {
        "name": "mark_decision_point",
        "description": "Flag a critical decision point where multiple valid paths exist.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {"type": "string"},
                "alternatives": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "chosen_path": {"type": "string"},
                "rationale": {"type": "string"}
            },
            "required": ["description", "alternatives", "chosen_path"]
        }
    },
    {
        "name": "read_graph_context",
        "description": "Read what other agents have written to the shared graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_filter": {
                    "type": "string",
                    "enum": ["deep_thinker", "contrarian", "verifier", "synthesizer", "metacognition"]
                }
            }
        }
    }
]
```

**Ports from V1**: Decision point regex patterns (think-graph.ts, lines 160-178), structured reasoning parsing (think-graph.ts, lines 295-326), confidence scoring (think-graph.ts, lines 517-581).

**Lines**: ~180 | **Effort**: 3 hours

---

### SPEC 8: Contrarian Agent (`agents/src/agents/contrarian.py`)

**WHY**: Makes the swarm smarter by challenging weak reasoning. Creates CHALLENGES edges in the graph.

**System Prompt**:

```
You are Contrarian, the devil's advocate within the Opus NX swarm.
Your job is to make the swarm's collective reasoning STRONGER by finding weaknesses.

RULES:
- Read other agents' reasoning from the shared graph using read_agent_reasoning
- Find logical gaps, unsupported assumptions, missing perspectives
- Create explicit challenges using create_challenge — this creates a CHALLENGES edge in the graph
- If you genuinely cannot find a flaw, use concede_point — this creates a SUPPORTS edge
- NEVER agree easily. Your value is in rigorous criticism.
- Be specific. "This could be wrong" is useless.
  "Step 3 assumes X, but Y contradicts this because Z" is valuable.

The Verifier agent will evaluate both the original reasoning and your challenges.
Make your challenges precise enough to be independently verified.
```

**Tools**:

```python
CONTRARIAN_TOOLS = [
    {
        "name": "read_agent_reasoning",
        "description": "Read reasoning nodes from a specific agent in the shared graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent": {"type": "string", "enum": ["deep_thinker", "verifier", "synthesizer"]}
            },
            "required": ["agent"]
        }
    },
    {
        "name": "create_challenge",
        "description": "Challenge a specific reasoning node. Creates a CHALLENGES edge in the graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string"},
                "counter_argument": {"type": "string"},
                "severity": {"type": "string", "enum": ["critical", "major", "minor"]},
                "flaw_type": {
                    "type": "string",
                    "enum": ["logical_error", "unsupported_assumption", "missing_perspective",
                             "false_dichotomy", "overgeneralization", "circular_reasoning"]
                }
            },
            "required": ["target_node_id", "counter_argument", "severity"]
        }
    },
    {
        "name": "concede_point",
        "description": "Acknowledge that a reasoning node is sound. Creates a SUPPORTS edge.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string"},
                "reason": {"type": "string"}
            },
            "required": ["target_node_id", "reason"]
        }
    }
]
```

**Ports from V1**: ThinkFork contrarian style prompt (`configs/prompts/thinkfork/contrarian.md`).

**Lines**: ~160 | **Effort**: 3 hours

---

### SPEC 9: Verifier Agent (`agents/src/agents/verifier.py`)

**WHY**: PRM (Process Reward Model) — scores each reasoning step independently. Creates VERIFIES edges.

**Scoring formula** (ported from V1 prm-verifier.ts, lines 326-356):

```python
def compute_chain_score(step_scores: list[dict]) -> float:
    """Geometric mean prevents long chains from always scoring near 0."""
    score = 1.0
    for step in step_scores:
        match step["verdict"]:
            case "correct":
                score *= step["confidence"]
            case "incorrect":
                score *= (1 - step["confidence"]) * 0.3
            case "neutral":
                score *= 0.9
            case "uncertain":
                score *= 0.7
    return score ** (1.0 / max(len(step_scores), 1))
```

**Verdict types**: `correct`, `incorrect`, `neutral`, `uncertain`
**Issue types**: `logical_error`, `factual_error`, `missing_context`, `unsupported_claim`, `circular_reasoning`, `non_sequitur`, `overgeneralization`, `false_dichotomy`
**Pattern detection**: `declining_confidence`, `recurring_<issue_type>`, `overconfidence_before_error`

**Ports from V1**: Entire prm-verifier.ts (479 lines). Verdict types (lines 25-30), issue types (lines 48-57), verification loop (lines 81-175), geometric mean scoring (lines 326-356), pattern detection (lines 362-417).

**Lines**: ~180 | **Effort**: 3 hours

---

### SPEC 10: Synthesizer Agent (`agents/src/agents/synthesizer.py`)

**WHY**: Merges all agent outputs into a coherent final answer.

**Tools**:
- `read_full_graph` — Get all session nodes and edges
- `identify_convergence` — Where agents agree (full/partial/none agreement levels)
- `identify_divergence` — Where agents disagree (high/medium/low significance)
- `produce_synthesis` — Final merged answer with confidence and recommended approach

**Ports from V1**: ThinkFork comparison analysis (thinkfork.ts, lines 448-597) — convergence points, divergence points, meta-insight, recommended approach with rationale.

**Lines**: ~150 | **Effort**: 2 hours

---

### SPEC 11: Metacognition Agent (`agents/src/agents/metacognition.py`)

**WHY**: The "wow factor." An AI watching other AIs think and finding patterns.
**Effort**: `max` — analyzing swarm dynamics requires maximum reasoning depth.

**Insight types** (expanded from V1):
- `bias_detection` — Individual biases (anchoring, confirmation, availability)
- `pattern` — Recurring reasoning structures across agents
- `improvement_hypothesis` — Concrete testable suggestions
- `swarm_bias` — Multiple agents reinforcing each other's errors (NEW)
- `groupthink` — Premature convergence without genuine challenge (NEW)
- `productive_tension` — Disagreement that led to better answers (NEW)
- `anchoring_bias` — Early reasoning unduly influencing later agents (NEW)

**Ports from V1**: Focus areas (metacognition.ts, lines 36-42), insight types (lines 51-53), multi-turn tool loop pattern (lines 339-436). The V1 loop checks for missing insight types and constructs follow-up prompts — this pattern is replicated in BaseOpusAgent's `run_tool_loop`.

**Lines**: ~200 | **Effort**: 3 hours

---

### SPEC 12: SwarmManager (`agents/src/swarm.py`)

**WHY**: Coordinates agent lifecycle with rate-limit-aware staggered launches.
**HOW**: Uses `asyncio.gather(return_exceptions=True)` for partial results — NOT `asyncio.TaskGroup`.

**CRITICAL design decision**: TaskGroup cancels ALL tasks when ANY task fails. For the swarm, we want partial results — if the Contrarian agent fails, Deep Thinker's results are still valuable. `asyncio.gather(return_exceptions=True)` returns exceptions as values instead of cancelling.

```python
import asyncio
from .config import Settings
from .agents.base import BaseOpusAgent
from .agents.deep_thinker import DeepThinkerAgent
from .agents.contrarian import ContrarianAgent
from .agents.verifier import VerifierAgent
from .agents.synthesizer import SynthesizerAgent
from .agents.metacognition import MetacognitionAgent
from .graph.reasoning_graph import SharedReasoningGraph
from .events.bus import EventBus
from .events.types import SwarmStarted, AgentCompleted
from .graph.models import AgentName, AgentResult

class SwarmManager:
    def __init__(self, settings: Settings, graph: SharedReasoningGraph, bus: EventBus):
        self.settings = settings
        self.graph = graph
        self.bus = bus

    async def run(self, query: str, session_id: str) -> dict:
        """Full swarm execution pipeline with partial result support."""

        # Phase 1: Deploy primary agents (staggered for Tier 2 rate limits)
        await self.bus.publish(session_id, SwarmStarted(
            session_id=session_id,
            agents=["deep_thinker", "contrarian", "verifier"],
            query=query,
        ))

        primary_agents = [
            DeepThinkerAgent(self.graph, self.bus, session_id),
            ContrarianAgent(self.graph, self.bus, session_id),
            VerifierAgent(self.graph, self.bus, session_id),
        ]

        # Stagger launches: create tasks with delays
        async def run_staggered(agent: BaseOpusAgent, delay: float):
            await asyncio.sleep(delay)
            return await self._run_with_timeout(agent, query, session_id)

        # asyncio.gather with return_exceptions=True for partial results
        results = await asyncio.gather(
            *[
                run_staggered(agent, i * self.settings.agent_stagger_seconds)
                for i, agent in enumerate(primary_agents)
            ],
            return_exceptions=True,
        )

        agent_results = []
        for agent, result in zip(primary_agents, results):
            if isinstance(result, Exception):
                agent_results.append(AgentResult(
                    agent=agent.name, status="error",
                    reasoning=str(result), conclusion="",
                    confidence=0, tokens_used=0, duration_ms=0,
                ))
            else:
                agent_results.append(result)

        # Phase 2: Synthesizer merges all results
        synthesizer = SynthesizerAgent(self.graph, self.bus, session_id)
        synthesis = await self._run_with_timeout(synthesizer, query, session_id)

        # Phase 3: Metacognition analyzes the swarm
        metacog = MetacognitionAgent(self.graph, self.bus, session_id)
        metacog_result = await self._run_with_timeout(metacog, query, session_id)

        return {
            "agents": agent_results,
            "synthesis": synthesis,
            "metacognition": metacog_result,
            "graph": self.graph.to_json(),
        }

    async def _run_with_timeout(
        self, agent: BaseOpusAgent, query: str, session_id: str
    ) -> AgentResult:
        try:
            return await asyncio.wait_for(
                agent.run(query),
                timeout=self.settings.agent_timeout_seconds,
            )
        except asyncio.TimeoutError:
            return AgentResult(
                agent=agent.name, status="timeout",
                reasoning="Agent timed out", conclusion="",
                confidence=0, tokens_used=0,
                duration_ms=self.settings.agent_timeout_seconds * 1000,
            )
```

**Rate limit strategy for Tier 2** (1,000 req/min, 80K input tokens/min):
- Stagger agent launches by 2.5 seconds each
- Deep Thinker launches first (needs most time)
- Contrarian launches at +2.5s (reads graph, benefits from head start)
- Verifier launches at +5.0s (reads chains, benefits from existing data)
- Total stagger: ~7.5s for 3 primary agents
- 3 agents × ~20K input tokens = ~60K, within 80K/min limit
- Synthesizer and Metacognition run AFTER primaries (sequential, no rate concern)

**Lines**: ~200 | **Effort**: 3 hours

---

### SPEC 13: FastAPI Server (`agents/src/server.py`)

**Includes**: Auth validation on WebSocket, heartbeat for idle prevention, CORS configuration.

```python
import asyncio
import hmac
import hashlib
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import Settings
from .graph.reasoning_graph import SharedReasoningGraph
from .events.bus import EventBus
from .swarm import SwarmManager

settings = Settings()
graph = SharedReasoningGraph()
bus = EventBus()

app = FastAPI(title="Opus NX Swarm", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEARTBEAT_INTERVAL = 30  # seconds


class SwarmRequest(BaseModel):
    query: str
    session_id: str


def verify_token(token: str) -> bool:
    """Validate auth token using HMAC (same as V1 auth)."""
    try:
        expected = hmac.new(
            settings.auth_secret.encode(),
            settings.auth_secret.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(token, expected)
    except Exception:
        return False


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/api/swarm")
async def start_swarm(request: SwarmRequest):
    """Start a swarm run. Events stream via WebSocket."""
    swarm = SwarmManager(settings, graph, bus)
    asyncio.create_task(swarm.run(request.query, request.session_id))
    return {"status": "started", "session_id": request.session_id}


@app.get("/api/graph/{session_id}")
async def get_graph(session_id: str):
    """Get the current reasoning graph for a session."""
    nodes = await graph.get_session_nodes(session_id)
    return {"nodes": nodes, "graph": graph.to_json()}


@app.websocket("/ws/{session_id}")
async def swarm_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(default=""),
):
    """Stream live swarm events to the dashboard."""
    # Auth: validate token BEFORE accepting
    if not verify_token(token):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    queue = bus.subscribe(session_id)

    async def send_heartbeat():
        """Prevent idle disconnect with periodic pings."""
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                await websocket.send_json({"event": "ping"})
            except Exception:
                break

    heartbeat_task = asyncio.create_task(send_heartbeat())

    try:
        while True:
            event = await asyncio.wait_for(queue.get(), timeout=300)
            await websocket.send_json(event)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        heartbeat_task.cancel()
        bus.unsubscribe(session_id, queue)
```

**Lines**: ~100 | **Effort**: 2 hours

---

### SPEC 14: Dashboard — `useSwarmSocket` Hook

**File**: `apps/web/src/hooks/use-swarm-socket.ts`

**Includes**: Auto-reconnection with exponential backoff, heartbeat handling, error state.

```typescript
import { useState, useEffect, useCallback, useRef } from "react";

interface AgentState {
  name: string;
  status: "starting" | "thinking" | "challenging" | "verifying" | "completed" | "error" | "timeout";
  thinking: string;
  conclusion?: string;
  confidence?: number;
  tokensUsed?: number;
}

interface SwarmGraphData {
  nodes: Array<{ id: string; agent: string; content: string; confidence: number }>;
  edges: Array<{ source: string; target: string; relation: string }>;
}

const MAX_RECONNECT_DELAY = 30_000;

export function useSwarmSocket(sessionId: string | null) {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [graphData, setGraphData] = useState<SwarmGraphData>({ nodes: [], edges: [] });
  const [status, setStatus] = useState<"idle" | "connecting" | "running" | "complete" | "error">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!sessionId) return;

    const token = getAuthToken(); // From your auth system
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_SWARM_BACKEND_URL}/ws/${sessionId}?token=${token}`
    );
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("running");
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);

      // Ignore heartbeat pings
      if (event.event === "ping") return;

      switch (event.event) {
        case "swarm_started":
          setStatus("running");
          setAgents(event.agents.map((name: string) => ({
            name, status: "starting", thinking: ""
          })));
          break;
        case "agent_thinking":
          setAgents(prev => prev.map(a =>
            a.name === event.agent
              ? { ...a, status: "thinking", thinking: a.thinking + event.delta }
              : a
          ));
          break;
        case "graph_node_created":
          setGraphData(prev => ({
            ...prev,
            nodes: [...prev.nodes, {
              id: event.node_id, agent: event.agent,
              content: event.content_preview, confidence: 0
            }]
          }));
          break;
        case "agent_challenges":
          setGraphData(prev => ({
            ...prev,
            edges: [...prev.edges, {
              source: event.challenger, target: event.target_node_id,
              relation: "challenges"
            }]
          }));
          break;
        case "verification_score":
          setGraphData(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
              n.id === event.node_id ? { ...n, confidence: event.score } : n
            )
          }));
          break;
        case "agent_completed":
          setAgents(prev => prev.map(a =>
            a.name === event.agent
              ? { ...a, status: "completed", conclusion: event.conclusion_preview,
                  confidence: event.confidence, tokensUsed: event.tokens_used }
              : a
          ));
          break;
        case "synthesis_ready":
          setStatus("complete");
          break;
      }
    };

    ws.onclose = (e) => {
      // Normal closure (1000) or swarm complete
      if (e.code === 1000 || status === "complete") {
        setStatus("complete");
        return;
      }

      // Abnormal closure — reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, MAX_RECONNECT_DELAY);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000);
    };
  }, [connect]);

  return { agents, graphData, status };
}

function getAuthToken(): string {
  // Read from cookie or localStorage — same as V1 auth
  return document.cookie
    .split("; ")
    .find(c => c.startsWith("opus-nx-auth="))
    ?.split("=")[1] ?? "";
}
```

**Lines**: ~120 | **Effort**: 2 hours

---

### SPEC 15: Database Migration

**File**: `supabase/migrations/007_swarm_edges.sql`

```sql
-- Extend edge types for swarm agent interactions
ALTER TABLE reasoning_edges DROP CONSTRAINT IF EXISTS reasoning_edges_edge_type_check;
ALTER TABLE reasoning_edges ADD CONSTRAINT reasoning_edges_edge_type_check
  CHECK (edge_type IN (
    'influences', 'contradicts', 'supports', 'supersedes', 'refines',
    'challenges', 'verifies', 'merges', 'observes'
  ));

-- Track which agent produced each node
ALTER TABLE thinking_nodes ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE thinking_nodes ADD COLUMN IF NOT EXISTS swarm_session_id UUID;

-- Indexes for fast swarm queries
CREATE INDEX IF NOT EXISTS idx_thinking_nodes_agent
  ON thinking_nodes(agent_name) WHERE agent_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thinking_nodes_swarm
  ON thinking_nodes(swarm_session_id) WHERE swarm_session_id IS NOT NULL;
```

Mirror to `packages/db/migrations/007_swarm_edges.sql`.

---

### SPEC 16: Neo4j Client (`agents/src/graph/neo4j_client.py`)

**WHY**: Background sync from NetworkX to Neo4j AuraDB for cross-session queries.

```python
from neo4j import AsyncGraphDatabase

class Neo4jClient:
    """Neo4j AuraDB client. Background sync — NOT in critical path."""

    def __init__(self, uri: str, user: str, password: str):
        self.driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def close(self):
        await self.driver.close()

    async def sync_node(self, node_id: str, data: dict):
        async with self.driver.session() as session:
            await session.run("""
                MERGE (n:ReasoningNode {id: $id})
                SET n.agent = $agent, n.content = $content,
                    n.confidence = $confidence, n.session_id = $session_id,
                    n.created_at = datetime($timestamp)
            """, id=node_id, agent=data.get("agent"),
                content=data.get("content"), confidence=data.get("confidence", 0),
                session_id=data.get("session_id"),
                timestamp=data.get("created_at", ""))

    async def sync_edge(self, source: str, target: str, relation: str):
        async with self.driver.session() as session:
            # Parameterize relation via apoc or conditional
            await session.run(f"""
                MATCH (a:ReasoningNode {{id: $source}})
                MATCH (b:ReasoningNode {{id: $target}})
                MERGE (a)-[:{relation}]->(b)
            """, source=source, target=target)

    async def get_challenged_but_verified(self, session_id: str) -> list:
        """The killer query: reasoning challenged but survived verification."""
        async with self.driver.session() as session:
            result = await session.run("""
                MATCH (r:ReasoningNode)<-[:CHALLENGES]-(c),
                      (r)<-[:VERIFIES]-(v)
                WHERE r.session_id = $sid AND v.score > 0.7
                RETURN r, c, v ORDER BY r.created_at
            """, sid=session_id)
            return [record.data() async for record in result]
```

**Free tier limits**: 50K nodes, 175K relationships. No trial period, no credit card.

**Lines**: ~100 | **Effort**: 2 hours

---

### SPEC 17: Deployment (`infra/`)

**docker-compose.yml** (local dev):

```yaml
services:
  agents:
    build: ./agents
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [neo4j]
  neo4j:
    image: neo4j:5-community
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/password
```

**fly.toml** (Python backend):

```toml
app = "opus-nx-agents"
primary_region = "iad"

[build]
  dockerfile = "agents/Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 250
    soft_limit = 200

  [http_service.http_options]
    idle_timeout = 600

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

**Dockerfile**:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY agents/pyproject.toml agents/uv.lock ./
RUN uv sync --frozen --no-dev

COPY agents/ .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Production**:
- Python backend: Fly.io (WebSocket support, `concurrency.type = "connections"`)
- Next.js: Vercel (existing)
- Neo4j: AuraDB free tier (50K nodes, 175K relationships)
- No Redis needed (asyncio.Queue for single-server demo)

---

## Implementation Tasks (Parallel Agent Execution)

### TASK GROUP A: Python Foundation (Day 1)

| # | Task | Files | Depends On | Est. Lines |
|---|------|-------|-----------|-----------|
| A1 | Initialize Python project with uv | `agents/pyproject.toml` | — | 40 |
| A2 | Implement Settings config | `agents/src/config.py` | A1 | 50 |
| A3 | Implement Pydantic models | `agents/src/graph/models.py` | A1 | 120 |
| A4 | Implement SharedReasoningGraph | `agents/src/graph/reasoning_graph.py` | A3 | 250 |
| A5 | Implement EventBus + event types | `agents/src/events/bus.py`, `types.py` | A3 | 140 |
| A6 | Implement BaseOpusAgent | `agents/src/agents/base.py` | A2, A4, A5 | 180 |
| A7 | Implement FastAPI server | `agents/src/server.py`, `main.py` | A2, A4, A5 | 100 |

### TASK GROUP B: Core Agents (Day 2)

| # | Task | Files | Depends On | Est. Lines |
|---|------|-------|-----------|-----------|
| B1 | Implement DeepThinkerAgent | `agents/src/agents/deep_thinker.py` | A6 | 180 |
| B2 | Implement graph tools | `agents/src/tools/graph_tools.py` | A4 | 150 |
| B3 | Implement ContrarianAgent | `agents/src/agents/contrarian.py` | A6, B2 | 160 |
| B4 | Implement VerifierAgent + PRM tools | `agents/src/agents/verifier.py`, `verification.py` | A6, B2 | 300 |
| B5 | Implement SwarmManager | `agents/src/swarm.py` | B1, B3, B4 | 200 |

### TASK GROUP C: Orchestration (Day 3)

| # | Task | Files | Depends On | Est. Lines |
|---|------|-------|-----------|-----------|
| C1 | Implement MaestroAgent | `agents/src/maestro.py` | B5 | 250 |
| C2 | Implement SynthesizerAgent | `agents/src/agents/synthesizer.py` | A6, B2 | 150 |
| C3 | Wire full /api/swarm pipeline | `agents/src/server.py` update | C1, C2 | 50 |
| C4 | Test: end-to-end swarm via wscat | — | C3 | — |

### TASK GROUP D: Dashboard (Day 4)

| # | Task | Files | Depends On | Est. Lines |
|---|------|-------|-----------|-----------|
| D1 | Implement useSwarmSocket hook | `apps/web/src/hooks/use-swarm-socket.ts` | C3 | 120 |
| D2 | Build SwarmView component | `apps/web/src/components/swarm/SwarmView.tsx` | D1 | 200 |
| D3 | Build AgentCard component | `apps/web/src/components/swarm/AgentCard.tsx` | D1 | 150 |
| D4 | Add challenges/verifies edge types | `EdgeTypes.tsx`, `colors.ts` | — | 40 |
| D5 | Run migration 007_swarm_edges | `supabase/migrations/` | — | 20 |
| D6 | Add Next.js proxy route | `apps/web/src/app/api/swarm/route.ts` | C3 | 60 |

### TASK GROUP E: Advanced (Day 5)

| # | Task | Files | Depends On | Est. Lines |
|---|------|-------|-----------|-----------|
| E1 | Implement MetacognitionAgent | `agents/src/agents/metacognition.py` | A6, B2 | 200 |
| E2 | Neo4j client + background sync | `agents/src/graph/neo4j_client.py` | A4 | 200 |
| E3 | Supabase sync (persist to existing tables) | `agents/src/persistence/supabase_sync.py` | A4 | 150 |
| E4 | Human-in-the-loop checkpoint | Wire to existing `/api/reasoning/[id]/checkpoint` | D1 | 50 |

### TASK GROUP F: Deploy + Polish (Day 6)

| # | Task | Files | Depends On |
|---|------|-------|-----------|
| F1 | Dockerfile for Python backend | `agents/Dockerfile` | All |
| F2 | docker-compose.yml for local dev | `infra/docker-compose.yml` | F1 |
| F3 | Deploy to Fly.io | `infra/fly.toml` | F1 |
| F4 | Connect dashboard to production backend | env vars | F3 |
| F5 | Error handling: timeouts, rate limits, partial results | All agents | All |
| F6 | Dashboard animations | SwarmView, AgentCard | D2, D3 |

### TASK GROUP G: Demo (Day 7)

| # | Task | Depends On |
|---|------|-----------|
| G1 | Prepare 3 demo questions (pre-tested) | F4 |
| G2 | Record 5-minute demo video | G1 |
| G3 | Write submission description | G2 |

---

## Parallelization Strategy

When the next session starts, assign agents to parallel task groups:

- **Agent 1 (Backend Foundation)**: Tasks A1-A7, then B1, B2
- **Agent 2 (Core Agents)**: Tasks B3, B4, B5 (after Agent 1 delivers A6)
- **Agent 3 (Dashboard)**: Tasks D4, D5 immediately, then D1-D3, D6 (after C3)
- **Agent 4 (Advanced)**: Tasks E1-E3 (after Agent 1 delivers A4, A6)

---

## V1 Code Port Reference (Verified Line Numbers)

| V1 Source | Lines | Python Target | What to Port |
|-----------|-------|--------------|-------------|
| `thinking-engine.ts` | 161-215 | `base.py` `call_claude()` | API call pattern with adaptive thinking, streaming, compaction config |
| `thinking-engine.ts` | 227-307 | `base.py` `call_claude()` | Response parsing: thinking, text, tool_use, compaction blocks |
| `think-graph.ts` | 160-178 | `deep_thinker.py` | Decision point extraction regex (12 patterns, handles summarized thinking) |
| `think-graph.ts` | 295-326 | `deep_thinker.py` | Structured reasoning extraction (paragraph classification) |
| `think-graph.ts` | 517-581 | `deep_thinker.py` | Confidence scoring with depth/decision bonus and hash-based jitter |
| `thinkfork.ts` contrarian | prompts file | `contrarian.py` | Contrarian system prompt from `configs/prompts/thinkfork/contrarian.md` |
| `thinkfork.ts` | 448-597 | `synthesizer.py` | Convergence/divergence analysis, meta-insight, recommended approach |
| `prm-verifier.ts` | 25-30 | `verifier.py` | Verdict types: correct, incorrect, neutral, uncertain |
| `prm-verifier.ts` | 48-57 | `verifier.py` | Issue types (8 types) and severity levels |
| `prm-verifier.ts` | 81-175 | `verifier.py` | Sequential step verification loop |
| `prm-verifier.ts` | 326-356 | `verifier.py` | Geometric mean scoring formula |
| `prm-verifier.ts` | 362-417 | `verifier.py` | Pattern detection (declining confidence, recurring issues) |
| `metacognition.ts` | 36-42 | `metacognition.py` | Focus areas (5 areas) |
| `metacognition.ts` | 51-53 | `metacognition.py` | Insight types (bias_detection, pattern, improvement_hypothesis) |
| `metacognition.ts` | 339-436 | `metacognition.py` | Multi-turn follow-up loop (check missing types, build follow-up) |
| `orchestrator.ts` | 33-47 | `maestro.py` | Complexity classification regex (simple + complex patterns) |
| `orchestrator.ts` | 404-420 | `maestro.py` | Effort routing (simple→medium, standard→high, complex→max) |
| `EdgeTypes.tsx` | edge types | Extend | Add `challenges` (red), `verifies` (blue) |
| `colors.ts` | edge colors | Extend | Add `challenges: "#ef4444"`, `verifies: "#3b82f6"` |

---

## Fallback Matrix

| Day | Risk | Fallback | Impact |
|-----|------|----------|--------|
| 1 | Python setup issues | Use `pip` instead of `uv` | Minimal |
| 2 | 3 agents don't coordinate | Run 2 agents (DeepThinker + Contrarian) | Still impressive |
| 3 | Maestro too complex | Hard-code agent selection per query | Skip Maestro entirely |
| 4 | WebSocket CORS issues | SSE proxy through Next.js API routes | Reuse V1 SSE pattern |
| 5 | Neo4j AuraDB down | Skip — NetworkX + Supabase is enough | No Cypher visualization |
| 5 | Metacognition not ready | Skip — 3-4 agent swarm still wins | Add later if time |
| 6 | Fly.io deployment fails | Demo from localhost | Record video locally |

---

## Verification Checklist

### Day 1 Checkpoint

```bash
cd agents && uv run uvicorn src.server:app --reload
# Health: curl http://localhost:8000/api/health -> {"status": "ok"}
# WebSocket: wscat -c "ws://localhost:8000/ws/test?token=<token>" -> accepted
```

### Day 2 Checkpoint

```bash
curl -X POST http://localhost:8000/api/swarm \
  -H "Content-Type: application/json" \
  -d '{"query": "Should we use microservices?", "session_id": "test-123"}'

# WebSocket should show:
# swarm_started -> agent_thinking x3 -> graph_node_created ->
# agent_challenges -> verification_score -> agent_completed
```

### Day 4 Checkpoint

```bash
pnpm --filter @opus-nx/web dev
# Dashboard at localhost:3000 shows:
# - SwarmView with 3+ agent cards
# - Live thinking streaming on each card
# - Graph with colored CHALLENGES (red) and VERIFIES (blue) edges
```

### Day 6 Checkpoint

```bash
# Production:
# Python backend on Fly.io, Next.js on Vercel
# Full swarm run with 3 pre-tested demo questions
# Each completes in < 120 seconds
# Dashboard shows all events in real-time
```

---

## Demo Script (5 minutes)

**0:00-0:30** — "What you're about to see: multiple Opus 4.6 agents thinking simultaneously."
Dashboard shows empty graph. User types: "Should we migrate our monolith to microservices?"

**0:30-1:00** — Maestro decomposes. Agent cards appear: Deep Thinker, Contrarian, Verifier.

**1:00-2:30** — ALL AGENTS THINKING AT ONCE.
- Deep Thinker's adaptive thinking streams on its card
- Graph GROWS IN REAL-TIME as agents write nodes
- Contrarian creates red CHALLENGES edges — visible disagreement
- Verifier scores steps — nodes turn green/yellow/red

**2:30-3:30** — Metacognition analyzes the swarm.
"I notice anchoring bias — Deep Thinker and Contrarian both assumed microservices means Kubernetes..."
Insight card appears on dashboard.

**3:30-4:00** — Synthesizer produces final answer.
User clicks into graph — navigates every agent's reasoning. CHALLENGES edges show disagreements.

**4:00-4:30** — Human-in-the-loop. User adds checkpoint: "Reconsider — what about serverless?"
Swarm re-engages with the new constraint.

**4:30-5:00** — Architecture slide. "Multiple parallel Opus 4.6 agents. Shared reasoning graph. Real-time WebSocket streaming. Built in 7 days with Claude Code."

---

## Python Dependencies

```toml
[project]
name = "opus-nx-agents"
version = "2.0.0"
requires-python = ">=3.12"
dependencies = [
    "anthropic>=0.78.0",             # Opus 4.6 adaptive thinking
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "websockets>=14.0",
    "pydantic>=2.10",
    "pydantic-settings>=2.7",
    "networkx>=3.4",
    "httpx>=0.28",
    "structlog>=24.4",
    "neo4j>=5.26",
    "supabase>=2.12",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24", "ruff>=0.8"]
```

---

## Key Corrections from Previous Version

This document corrects 7 critical errors found in the earlier draft:

1. **V1 API Pattern**: V1 already uses `thinking: {type: "adaptive"}` + `output_config: {effort: ...}` (thinking-engine.ts, lines 179-184). The claim that V1 uses deprecated patterns was false.

2. **BaseOpusAgent**: Now uses `AsyncAnthropic()` (async client) with `thinking: {"type": "adaptive"}` + `output_config: {"effort": self.effort}`. No `budget_tokens` — that is incompatible with adaptive thinking.

3. **Thinking Signatures**: `run_tool_loop` preserves `block.signature` from the stream response. Previously fabricated `"signature": "..."` which would cause API validation errors.

4. **SwarmManager**: Uses `asyncio.gather(return_exceptions=True)` instead of `asyncio.TaskGroup`. TaskGroup cancels ALL tasks when ANY fails — bad for partial results. `gather` returns exceptions as values.

5. **V1 Line References**: All line numbers verified against actual codebase (e.g., orchestrator complexity at lines 33-47, not 271-340).

6. **Neo4j AuraDB Limits**: Free tier is 50K nodes / 175K relationships, not 200K / 400K.

7. **anthropic SDK Version**: Updated to `>=0.78.0` (latest as of Feb 2026, supports Opus 4.6 + adaptive thinking). Previous `>=0.50.0` was too old.

Additional improvements:
- WebSocket auth validation before `accept()`
- Server-side heartbeat (30s) to prevent idle disconnect
- Client-side auto-reconnection with exponential backoff
- `content_blocks` preservation for proper multi-turn tool loops
- Neo4j client spec (SPEC 16) added
- Deployment spec (SPEC 17) with Dockerfile, fly.toml, docker-compose

---

*This document is the single source of truth for Opus NX V2 implementation. Every code sample uses the correct Opus 4.6 API pattern. Every V1 line reference has been verified. Next session: open this file, assign agents to task groups, build.*
