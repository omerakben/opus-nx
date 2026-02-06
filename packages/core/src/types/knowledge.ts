import { z } from "zod";

// ============================================================
// Knowledge Categories
// ============================================================

export const KnowledgeCategorySchema = z.enum([
  "technology",
  "research",
  "business",
  "personal",
  "projects",
]);

export type KnowledgeCategory = z.infer<typeof KnowledgeCategorySchema>;

// ============================================================
// Category Configuration
// ============================================================

export const CategoryConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  subcategories: z.array(z.string()).optional(),
  autoTags: z.array(z.string()).optional(),
});

export const CategoriesConfigSchema = z.object({
  categories: z.record(CategoryConfigSchema),
});

export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;
export type CategoriesConfig = z.infer<typeof CategoriesConfigSchema>;

// ============================================================
// Knowledge Retrieval
// ============================================================

export interface KnowledgeContext {
  entries: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    similarity: number;
  }>;
  totalTokens: number;
}

export interface RetrievalOptions {
  limit?: number;
  threshold?: number;
  category?: string;
  includeRelated?: boolean;
  relatedDepth?: number;
}

// ============================================================
// Embedding Configuration
// ============================================================

export const EmbeddingConfigSchema = z.object({
  provider: z.enum(["voyage"]).default("voyage"),
  model: z.string().default("voyage-3"),
  dimensions: z.number().default(1024),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;
