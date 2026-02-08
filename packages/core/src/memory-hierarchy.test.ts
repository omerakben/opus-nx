import { describe, it, expect, beforeEach } from "vitest";
import { MemoryHierarchy } from "./memory-hierarchy.js";
import type { MemoryStats, MemoryEntry } from "./types/memory.js";

describe("MemoryHierarchy", () => {
  let memory: MemoryHierarchy;

  beforeEach(() => {
    memory = new MemoryHierarchy();
  });

  describe("constructor", () => {
    it("creates an instance with default config", () => {
      expect(memory).toBeInstanceOf(MemoryHierarchy);
    });

    it("creates an instance with custom config", () => {
      const customMemory = new MemoryHierarchy({
        config: {
          maxMainContextTokens: 50000,
          recallWindowSize: 50,
          evictionThreshold: 0.5,
          selfManaged: false,
          summarizeOnEviction: false,
          searchThreshold: 0.8,
        },
      });
      expect(customMemory).toBeInstanceOf(MemoryHierarchy);
    });
  });

  describe("getStats()", () => {
    it("returns initial stats with zero entries", () => {
      const stats = memory.getStats();
      expect(stats.mainContextEntries).toBe(0);
      expect(stats.recallStorageEntries).toBe(0);
      expect(stats.archivalStorageEntries).toBe(0);
      expect(stats.mainContextUtilization).toBe(0);
      expect(stats.totalInserts).toBe(0);
      expect(stats.totalSearches).toBe(0);
      expect(stats.totalEvictions).toBe(0);
      expect(stats.totalPromotions).toBe(0);
    });
  });

  describe("addToWorkingMemory()", () => {
    it("adds entry to working memory", () => {
      memory.addToWorkingMemory("Test fact", 0.8, "user_input");
      const stats = memory.getStats();
      expect(stats.mainContextEntries).toBe(1);
      expect(stats.mainContextTokens).toBeGreaterThan(0);
    });

    it("adds entry to recall storage simultaneously", () => {
      memory.addToWorkingMemory("Test fact", 0.8, "user_input");
      const stats = memory.getStats();
      expect(stats.recallStorageEntries).toBe(1);
    });

    it("returns the created memory entry", () => {
      const entry = memory.addToWorkingMemory("Important insight", 0.9, "thinking_node", "node-123");
      expect(entry.id).toBeTruthy();
      expect(entry.content).toBe("Important insight");
      expect(entry.importance).toBe(0.9);
      expect(entry.tier).toBe("main_context");
      expect(entry.source).toBe("thinking_node");
    });

    it("clamps importance to valid range", () => {
      const entry1 = memory.addToWorkingMemory("Over", 1.5, "user_input");
      const entry2 = memory.addToWorkingMemory("Under", -0.5, "user_input");
      expect(entry1.importance).toBe(1);
      expect(entry2.importance).toBe(0);
    });
  });

  describe("setSystemPrompt()", () => {
    it("sets the system prompt and updates token count", () => {
      memory.setSystemPrompt("You are a helpful assistant.");
      const context = memory.getMainContext();
      expect(context.systemPrompt).toBe("You are a helpful assistant.");
      expect(context.tokenCount).toBeGreaterThan(0);
    });
  });

  describe("getMainContextString()", () => {
    it("returns empty string when no context", () => {
      expect(memory.getMainContextString()).toBe("");
    });

    it("includes working memory entries", () => {
      memory.addToWorkingMemory("The capital of France is Paris", 0.8, "knowledge_base");
      const contextStr = memory.getMainContextString();
      expect(contextStr).toContain("Working Memory");
      expect(contextStr).toContain("The capital of France is Paris");
    });

    it("includes core memory after append", async () => {
      await memory.executeOperation({
        operation: "core_memory_append",
        section: "human",
        content: "User prefers concise answers",
      });
      const contextStr = memory.getMainContextString();
      expect(contextStr).toContain("Core Memory: Human");
      expect(contextStr).toContain("User prefers concise answers");
    });
  });

  describe("executeOperation()", () => {
    describe("archival_insert", () => {
      it("inserts content into archival storage", async () => {
        const result = await memory.executeOperation({
          operation: "archival_insert",
          content: "Important long-term knowledge",
          tags: ["science", "physics"],
          importance: 0.9,
        });

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.message).toContain("Stored in archival");

        const stats = memory.getStats();
        expect(stats.archivalStorageEntries).toBe(1);
        expect(stats.totalInserts).toBe(1);
      });
    });

    describe("archival_search", () => {
      it("finds matching entries", async () => {
        await memory.executeOperation({
          operation: "archival_insert",
          content: "Quantum mechanics describes subatomic particles",
          tags: ["physics"],
        });
        await memory.executeOperation({
          operation: "archival_insert",
          content: "Shakespeare wrote Hamlet in 1600",
          tags: ["literature"],
        });

        const result = await memory.executeOperation({
          operation: "archival_search",
          query: "quantum physics particles",
        });

        expect(result.success).toBe(true);
        expect(result.results).toBeDefined();
        expect(result.results!.length).toBeGreaterThan(0);
        expect(result.results![0].content).toContain("Quantum");
      });

      it("returns empty for non-matching queries", async () => {
        // Use a fresh memory instance to avoid cross-test contamination
        const freshMemory = new MemoryHierarchy();
        await freshMemory.executeOperation({
          operation: "archival_insert",
          content: "Dogs loyal pets",
          tags: ["animals"],
        });

        const result = await freshMemory.executeOperation({
          operation: "archival_search",
          query: "zqxjkw vbnmrt",
        });

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(0);
      });
    });

    describe("recall_search", () => {
      it("finds recent entries", async () => {
        memory.addToWorkingMemory("Discussed project architecture", 0.7, "user_input");
        memory.addToWorkingMemory("Reviewed database schema", 0.6, "thinking_node");

        const result = await memory.executeOperation({
          operation: "recall_search",
          query: "architecture",
        });

        expect(result.success).toBe(true);
        expect(result.results!.length).toBeGreaterThan(0);
      });
    });

    describe("core_memory_append", () => {
      it("appends to human section", async () => {
        const result = await memory.executeOperation({
          operation: "core_memory_append",
          section: "human",
          content: "User is a software engineer",
        });

        expect(result.success).toBe(true);
        const context = memory.getMainContext();
        expect(context.coreMemory.humanFacts).toContain("User is a software engineer");
      });

      it("appends to agent section", async () => {
        const result = await memory.executeOperation({
          operation: "core_memory_append",
          section: "agent",
          content: "I specialize in reasoning tasks",
        });

        expect(result.success).toBe(true);
        const context = memory.getMainContext();
        expect(context.coreMemory.agentFacts).toContain("I specialize in reasoning tasks");
      });
    });

    describe("core_memory_replace", () => {
      it("replaces existing content", async () => {
        await memory.executeOperation({
          operation: "core_memory_append",
          section: "human",
          content: "User likes Python",
        });

        const result = await memory.executeOperation({
          operation: "core_memory_replace",
          section: "human",
          oldContent: "User likes Python",
          newContent: "User prefers TypeScript",
        });

        expect(result.success).toBe(true);
        const context = memory.getMainContext();
        expect(context.coreMemory.humanFacts).not.toContain("User likes Python");
        expect(context.coreMemory.humanFacts).toContain("User prefers TypeScript");
      });

      it("fails for non-existent content", async () => {
        const result = await memory.executeOperation({
          operation: "core_memory_replace",
          section: "human",
          oldContent: "nonexistent fact",
          newContent: "new fact",
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain("Could not find");
      });
    });

    describe("evict_to_archival", () => {
      it("moves entries from working to archival", async () => {
        const entry = memory.addToWorkingMemory("Temporary info", 0.3, "user_input");

        const result = await memory.executeOperation({
          operation: "evict_to_archival",
          entryIds: [entry.id],
        });

        expect(result.success).toBe(true);
        const stats = memory.getStats();
        expect(stats.mainContextEntries).toBe(0);
        expect(stats.archivalStorageEntries).toBe(1);
        expect(stats.totalEvictions).toBe(1);
      });
    });

    describe("promote_to_working", () => {
      it("moves entries from archival to working", async () => {
        const insertResult = await memory.executeOperation({
          operation: "archival_insert",
          content: "Critical knowledge to recall",
          importance: 0.9,
        });

        const entryId = insertResult.results![0].id;
        const result = await memory.executeOperation({
          operation: "promote_to_working",
          entryIds: [entryId],
        });

        expect(result.success).toBe(true);
        const stats = memory.getStats();
        expect(stats.mainContextEntries).toBe(1);
        expect(stats.archivalStorageEntries).toBe(0);
        expect(stats.totalPromotions).toBe(1);
      });
    });
  });

  describe("auto-eviction", () => {
    it("evicts least important entries when context exceeds capacity", () => {
      // Create memory with very small capacity to trigger eviction
      const smallMemory = new MemoryHierarchy({
        config: { maxMainContextTokens: 100 },
      });

      // Add entries that exceed capacity
      for (let i = 0; i < 20; i++) {
        smallMemory.addToWorkingMemory(
          `This is a fairly long piece of content number ${i} that will use tokens`,
          i / 20, // Increasing importance
          "user_input"
        );
      }

      const stats = smallMemory.getStats();
      // After eviction, working memory should be smaller
      expect(stats.mainContextEntries).toBeLessThan(20);
      // Evicted entries should be in archival
      expect(stats.archivalStorageEntries).toBeGreaterThan(0);
      expect(stats.totalEvictions).toBeGreaterThan(0);
    });
  });

  describe("recall window enforcement", () => {
    it("enforces recall window size", () => {
      const smallRecall = new MemoryHierarchy({
        config: { recallWindowSize: 5 },
      });

      // Add more entries than recall window
      for (let i = 0; i < 10; i++) {
        smallRecall.addToWorkingMemory(`Entry ${i}`, 0.5, "user_input");
      }

      const stats = smallRecall.getStats();
      expect(stats.recallStorageEntries).toBeLessThanOrEqual(5);
    });
  });

  describe("clear()", () => {
    it("clears all memory tiers", async () => {
      memory.addToWorkingMemory("Working mem", 0.8, "user_input");
      await memory.executeOperation({
        operation: "archival_insert",
        content: "Archival mem",
      });
      await memory.executeOperation({
        operation: "core_memory_append",
        section: "human",
        content: "Core fact",
      });

      memory.clear();

      const stats = memory.getStats();
      expect(stats.mainContextEntries).toBe(0);
      expect(stats.recallStorageEntries).toBe(0);
      expect(stats.archivalStorageEntries).toBe(0);

      const context = memory.getMainContext();
      expect(context.coreMemory.humanFacts).toHaveLength(0);
      expect(context.coreMemory.agentFacts).toHaveLength(0);
    });
  });

  describe("callbacks", () => {
    it("fires onStatsUpdate callback", () => {
      const statsUpdates: MemoryStats[] = [];
      const trackedMemory = new MemoryHierarchy({
        onStatsUpdate: (stats) => statsUpdates.push({ ...stats }),
      });

      trackedMemory.addToWorkingMemory("Test", 0.5, "user_input");
      expect(statsUpdates.length).toBeGreaterThan(0);
      expect(statsUpdates[statsUpdates.length - 1].mainContextEntries).toBe(1);
    });

    it("fires onEviction callback", () => {
      const evictedEntries: MemoryEntry[] = [];
      const smallMemory = new MemoryHierarchy({
        config: { maxMainContextTokens: 50 },
        onEviction: (entry) => evictedEntries.push(entry),
      });

      for (let i = 0; i < 10; i++) {
        smallMemory.addToWorkingMemory(
          `Long content that uses many tokens: entry ${i} with extra padding`,
          0.1,
          "user_input"
        );
      }

      expect(evictedEntries.length).toBeGreaterThan(0);
    });
  });
});
