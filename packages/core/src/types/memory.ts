/**
 * @scope active - Hackathon demo
 */
import { z } from "zod";

// ============================================================
// [Future Scope] MemGPT-Inspired Hierarchical Memory Types
// ============================================================
// Based on: "MemGPT: Towards LLMs as Operating Systems"
// (Packer et al., 2023 — arXiv:2310.08560)
//
// MemGPT treats the LLM context as a "main memory" managed by
// an OS-like memory hierarchy:
//
// 1. Main Context (registers): Current working memory visible to LLM
// 2. Recall Storage (RAM): Recent conversational history
// 3. Archival Storage (disk): Long-term knowledge with semantic search
//
// The key innovation: the LLM manages its own memory through
// function calls (archival_memory_insert, archival_memory_search,
// conversation_search, etc.), enabling unbounded context.
//
// Our implementation adapts this for persistent reasoning:
// - Main Context = current thinking graph context window
// - Recall Storage = recent session reasoning nodes
// - Archival Storage = knowledge entries with embeddings
// ============================================================

// ============================================================
// Memory Tiers
// ============================================================

/** The three memory tiers from MemGPT */
export const MemoryTierSchema = z.enum([
  "main_context",     // Currently in LLM context window
  "recall_storage",   // Recent history, fast retrieval
  "archival_storage", // Long-term, semantic search
]);

export type MemoryTier = z.infer<typeof MemoryTierSchema>;

// ============================================================
// Memory Entry
// ============================================================

/** A single entry in the memory system */
export const MemoryEntrySchema = z.object({
  id: z.string().uuid(),
  /** Which tier this entry currently lives in */
  tier: MemoryTierSchema,
  /** The content of this memory */
  content: z.string(),
  /** Summary for when promoted to main context */
  summary: z.string().optional(),
  /** Importance score (determines eviction priority) */
  importance: z.number().min(0).max(1).default(0.5),
  /** How recently this memory was accessed */
  lastAccessedAt: z.date(),
  /** How many times this memory has been accessed */
  accessCount: z.number().int().default(0),
  /** Source of this memory */
  source: z.enum([
    "user_input",       // From user query
    "thinking_node",    // From a reasoning node
    "decision_point",   // From a decision point
    "metacognitive",    // From metacognitive insight
    "knowledge_base",   // From stored knowledge
    "compaction",       // From context compaction
  ]),
  /** ID of the source entity */
  sourceId: z.string().optional(),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Embedding vector (if in archival storage) */
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ============================================================
// Main Context Window
// ============================================================

/** State of the main context (what the LLM currently "sees") */
export const MainContextSchema = z.object({
  /** System prompt / persona */
  systemPrompt: z.string(),
  /** Core memory: facts about the user and agent */
  coreMemory: z.object({
    /** Facts about the human user */
    humanFacts: z.array(z.string()).default([]),
    /** Facts about the agent's current state */
    agentFacts: z.array(z.string()).default([]),
  }).default({}),
  /** Working memory: current task/reasoning context */
  workingMemory: z.array(z.object({
    id: z.string(),
    content: z.string(),
    importance: z.number(),
  })).default([]),
  /** Token count of the current context */
  tokenCount: z.number().int().default(0),
  /** Maximum token capacity before eviction needed */
  maxTokens: z.number().int().default(100000),
});

export type MainContext = z.infer<typeof MainContextSchema>;

// ============================================================
// Memory Operations (MemGPT function calls)
// ============================================================

/** Operations the LLM can perform on its own memory */
export const MemoryOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("archival_insert"),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
  }),
  z.object({
    operation: z.literal("archival_search"),
    query: z.string(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    operation: z.literal("recall_search"),
    query: z.string(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    operation: z.literal("core_memory_append"),
    section: z.enum(["human", "agent"]),
    content: z.string(),
  }),
  z.object({
    operation: z.literal("core_memory_replace"),
    section: z.enum(["human", "agent"]),
    oldContent: z.string(),
    newContent: z.string(),
  }),
  z.object({
    operation: z.literal("evict_to_archival"),
    /** IDs of working memory entries to evict */
    entryIds: z.array(z.string()),
  }),
  z.object({
    operation: z.literal("promote_to_working"),
    /** IDs of archival entries to promote */
    entryIds: z.array(z.string()),
  }),
]);

export type MemoryOperation = z.infer<typeof MemoryOperationSchema>;

// ============================================================
// Memory Statistics
// ============================================================

/** Statistics about the memory system */
export const MemoryStatsSchema = z.object({
  /** Number of entries per tier */
  mainContextEntries: z.number().int(),
  recallStorageEntries: z.number().int(),
  archivalStorageEntries: z.number().int(),
  /** Token usage */
  mainContextTokens: z.number().int(),
  mainContextCapacity: z.number().int(),
  mainContextUtilization: z.number().min(0).max(1),
  /** Operation counts */
  totalInserts: z.number().int().default(0),
  totalSearches: z.number().int().default(0),
  totalEvictions: z.number().int().default(0),
  totalPromotions: z.number().int().default(0),
});

export type MemoryStats = z.infer<typeof MemoryStatsSchema>;

// ============================================================
// Memory Configuration
// ============================================================

/** Configuration for the hierarchical memory system */
export const MemoryHierarchyConfigSchema = z.object({
  /** Max tokens for main context before eviction triggers */
  maxMainContextTokens: z.number().int().default(100000),
  /** Number of recent entries to keep in recall storage */
  recallWindowSize: z.number().int().default(100),
  /** Importance threshold below which entries get evicted */
  evictionThreshold: z.number().min(0).max(1).default(0.3),
  /** Whether the LLM can self-manage its memory */
  selfManaged: z.boolean().default(true),
  /** Whether to auto-summarize entries when evicting */
  summarizeOnEviction: z.boolean().default(true),
  /** Similarity threshold for archival search results */
  searchThreshold: z.number().min(0).max(1).default(0.7),
});

export type MemoryHierarchyConfig = z.infer<typeof MemoryHierarchyConfigSchema>;

// ============================================================
// Memory Tools (for LLM self-management)
// ============================================================

/** Tool definitions for LLM memory self-management */
export const MEMORY_TOOLS = [
  {
    name: "archival_memory_insert",
    description: "Store important information in long-term archival memory for future retrieval. Use this for facts, insights, and decisions worth remembering.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The information to store (be specific and self-contained)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization and retrieval",
        },
        importance: {
          type: "number",
          description: "Importance level (0.0-1.0, higher = more important)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "archival_memory_search",
    description: "Search long-term archival memory for relevant information. Use this when you need context from previous sessions or stored knowledge.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language query to search for",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "conversation_search",
    description: "Search recent conversation and reasoning history. Use this to recall recent discussions or reasoning steps.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What to search for in recent history",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "core_memory_append",
    description: "Add a fact to core memory (always visible). Use sparingly — only for critical persistent facts.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: ["human", "agent"],
          description: "Which section to append to",
        },
        content: {
          type: "string",
          description: "The fact to remember",
        },
      },
      required: ["section", "content"],
    },
  },
];
