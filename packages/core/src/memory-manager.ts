/**
 * @module Memory Manager
 * @scope active
 * @description Voyage AI embeddings and semantic search
 */
import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@opus-nx/shared";
import {
  createKnowledgeEntry,
  searchKnowledge,
  getRelatedKnowledge,
  type KnowledgeEntry,
  type KnowledgeSearchResult,
  type CreateKnowledgeInput,
} from "@opus-nx/db";
import type { KnowledgeContext, RetrievalOptions, EmbeddingConfig } from "./types/index.js";

const logger = createLogger("MemoryManager");

// ============================================================
// Memory Manager Options
// ============================================================

export interface MemoryManagerOptions {
  embeddingConfig?: Partial<EmbeddingConfig>;
  anthropicClient?: Anthropic;
}

// ============================================================
// Memory Manager
// ============================================================

/**
 * MemoryManager handles knowledge storage and retrieval using Voyage AI embeddings.
 *
 * This is the "memory" of Opus Nx - it stores knowledge entries with semantic
 * embeddings and retrieves relevant context for orchestration.
 */
export class MemoryManager {
  private embeddingConfig: EmbeddingConfig;
  private anthropicClient: Anthropic;

  constructor(options: MemoryManagerOptions = {}) {
    this.embeddingConfig = {
      provider: "voyage",
      model: options.embeddingConfig?.model ?? "voyage-3",
      dimensions: options.embeddingConfig?.dimensions ?? 1024,
    };
    this.anthropicClient = options.anthropicClient ?? new Anthropic();
  }

  /**
   * Generate embedding for text using Voyage AI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    if (!voyageApiKey) {
      throw new Error("VOYAGE_API_KEY environment variable is required");
    }

    logger.debug("Generating embedding", {
      model: this.embeddingConfig.model,
      textLength: text.length,
    });

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${voyageApiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingConfig.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI embedding failed: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Store a new knowledge entry
   */
  async store(
    input: CreateKnowledgeInput,
    options: { autoEmbed?: boolean } = {}
  ): Promise<KnowledgeEntry> {
    const { autoEmbed = true } = options;

    logger.info("Storing knowledge entry", {
      title: input.title,
      category: input.category,
    });

    let embedding: number[] = [];

    if (autoEmbed) {
      const textToEmbed = `${input.title}\n\n${input.content}`;
      embedding = await this.generateEmbedding(textToEmbed);
    }

    return createKnowledgeEntry(input, embedding);
  }

  /**
   * Search for relevant knowledge entries
   */
  async search(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const { limit = 10, threshold = 0.7, category } = options;

    logger.debug("Searching knowledge", { query, limit, threshold, category });

    const queryEmbedding = await this.generateEmbedding(query);

    return searchKnowledge(queryEmbedding, {
      limit,
      threshold,
      category,
    });
  }

  /**
   * Get knowledge context for a query
   *
   * This builds a formatted context string that can be injected into prompts,
   * optionally including related knowledge entries.
   */
  async getContext(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<KnowledgeContext> {
    const {
      limit = 5,
      includeRelated = true,
      relatedDepth = 1,
      ...searchOptions
    } = options;

    const results = await this.search(query, { limit, ...searchOptions });

    if (results.length === 0) {
      return { entries: [], totalTokens: 0 };
    }

    const entries: KnowledgeContext["entries"] = [];
    let contextText = "";

    // Pre-fetch all related knowledge in parallel to avoid N+1 queries
    const relatedMap = new Map<string, Awaited<ReturnType<typeof getRelatedKnowledge>>>();
    if (includeRelated) {
      const relatedResults = await Promise.all(
        results.map((r) => getRelatedKnowledge(r.id, relatedDepth))
      );
      results.forEach((r, i) => {
        relatedMap.set(r.id, relatedResults[i]);
      });
    }

    for (const result of results) {
      entries.push({
        id: result.id,
        title: result.title,
        content: result.content,
        category: result.category,
        similarity: result.similarity,
      });

      contextText += `### ${result.title} (${(result.similarity * 100).toFixed(1)}% match)\n`;
      contextText += `Category: ${result.category}\n`;
      contextText += `${result.content}\n\n`;

      const related = relatedMap.get(result.id);
      if (related && related.length > 0) {
        contextText += `Related: ${related.map((r) => r.title).join(", ")}\n\n`;
      }
    }

    // Rough token estimate (4 chars per token)
    const totalTokens = Math.ceil(contextText.length / 4);

    return { entries, totalTokens };
  }

  /**
   * Build a formatted context string for injection into prompts
   */
  async buildContextString(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<string> {
    const context = await this.getContext(query, options);

    if (context.entries.length === 0) {
      return "";
    }

    let contextString = "## Retrieved Knowledge\n\n";

    for (const entry of context.entries) {
      contextString += `### ${entry.title} (${(entry.similarity * 100).toFixed(1)}% match)\n`;
      contextString += `Category: ${entry.category}\n`;
      contextString += `${entry.content}\n\n`;
    }

    return contextString;
  }

  /**
   * Auto-categorize content using Claude Haiku
   */
  async categorize(
    content: string,
    availableCategories: string[]
  ): Promise<{ category: string; subcategory?: string; confidence: number }> {
    logger.debug("Auto-categorizing content", {
      contentLength: content.length,
      categories: availableCategories,
    });

    const response = await this.anthropicClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Categorize this content into one of these categories: ${availableCategories.join(", ")}

Content: ${content.slice(0, 1000)}

Respond with JSON only: { "category": "...", "subcategory": "..." (optional), "confidence": 0.0-1.0 }`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        logger.warn("Failed to parse categorization response");
      }
    }

    return { category: availableCategories[0], confidence: 0.5 };
  }
}
