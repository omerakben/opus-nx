import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@opus-nx/shared";
import type {
  ThinkingBlock,
  RedactedThinkingBlock,
  TextBlock,
  ToolUseBlock,
  CompactionBlock,
  ContentBlock,
  OrchestratorConfig,
  ThinkingResult,
  TokenUsage,
} from "./types/index.js";

const logger = createLogger("ThinkingEngine");

// ============================================================
// Thinking Engine Options
// ============================================================

export interface ThinkingEngineOptions {
  config: OrchestratorConfig;
  onThinkingStream?: (thinking: string) => void;
  onTextStream?: (text: string) => void;
  onCompactionStream?: (summary: string) => void;
}

// ============================================================
// Thinking Engine
// ============================================================

/**
 * ThinkingEngine wraps Claude Opus 4.6 with extended thinking capabilities.
 *
 * This is the "brain" of Opus Nx - it uses adaptive thinking to reason
 * through complex problems before acting.
 *
 * Opus 4.6 Features:
 * - Adaptive thinking: Claude decides when/how much to think
 * - Effort parameter: low/medium/high/max control
 * - Context compaction: Infinite sessions via automatic summarization
 * - Data residency: US-only inference option
 * - 128K output tokens, 1M context window
 * - Interleaved thinking between tool calls
 */
export class ThinkingEngine {
  private client: Anthropic;
  private config: OrchestratorConfig;
  private onThinkingStream?: (thinking: string) => void;
  private onTextStream?: (text: string) => void;
  private onCompactionStream?: (summary: string) => void;

  constructor(options: ThinkingEngineOptions) {
    this.client = new Anthropic();
    this.config = options.config;
    this.onThinkingStream = options.onThinkingStream;
    this.onTextStream = options.onTextStream;
    this.onCompactionStream = options.onCompactionStream;
  }

  /**
   * Execute a thinking request with Claude Opus 4.6
   *
   * Uses adaptive thinking with configurable effort levels to reason
   * through the problem before generating a response.
   */
  async think(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools?: Anthropic.Tool[]
  ): Promise<ThinkingResult> {
    const startTime = Date.now();
    logger.debug("Starting thinking request", {
      model: this.config.model,
      thinkingType: this.config.thinking.type,
      effort: this.config.thinking.effort,
      compactionEnabled: !!this.config.compaction?.enabled,
      inferenceGeo: this.config.inferenceGeo,
    });

    try {
      if (this.config.streaming) {
        return await this.streamingThink(systemPrompt, messages, tools);
      } else {
        return await this.nonStreamingThink(systemPrompt, messages, tools);
      }
    } finally {
      const duration = Date.now() - startTime;
      logger.info("Thinking request completed", { durationMs: duration });
    }
  }

  /**
   * Streaming thinking request
   */
  private async streamingThink(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[] | undefined
  ): Promise<ThinkingResult> {
    const requestParams = this.buildRequestParams(systemPrompt, messages, tools, true);

    const stream = this.client.messages.stream(
      requestParams as unknown as Anthropic.MessageCreateParamsStreaming
    );

    const thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[] = [];
    const textBlocks: TextBlock[] = [];
    const toolUseBlocks: ToolUseBlock[] = [];
    const compactionBlocks: CompactionBlock[] = [];

    // Process streaming events
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = (event as unknown as { content_block: { type: string } }).content_block;
        if (block.type === "compaction") {
          logger.info("Compaction triggered during stream");
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta as unknown as Record<string, unknown>;
        if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
          this.onThinkingStream?.(delta.thinking);
        } else if (delta.type === "text_delta" && typeof delta.text === "string") {
          this.onTextStream?.(delta.text);
        } else if (delta.type === "compaction_delta" && typeof delta.content === "string") {
          this.onCompactionStream?.(delta.content);
        }
      }
    }

    const response = await stream.finalMessage();
    return this.parseResponse(response, thinkingBlocks, textBlocks, toolUseBlocks, compactionBlocks);
  }

  /**
   * Non-streaming thinking request
   */
  private async nonStreamingThink(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[] | undefined
  ): Promise<ThinkingResult> {
    const requestParams = this.buildRequestParams(systemPrompt, messages, tools, false);

    const response = await this.client.messages.create(
      requestParams as unknown as Anthropic.MessageCreateParams
    ) as Anthropic.Message;

    return this.parseResponse(response, [], [], [], []);
  }

  /**
   * Build request parameters for the Anthropic API.
   * Configures adaptive thinking, effort, compaction, and data residency.
   */
  private buildRequestParams(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[] | undefined,
    streaming: boolean
  ): Record<string, unknown> {
    const requestParams: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt,
      messages,
    };

    if (streaming) {
      requestParams.stream = true;
    }

    // Configure thinking based on type (adaptive is recommended for Opus 4.6)
    if (this.config.thinking.type === "adaptive") {
      // Adaptive thinking - Claude decides when/how much to think
      // Enables interleaved thinking between tool calls automatically
      requestParams.thinking = { type: "adaptive" };
      // Effort controls thinking depth via output_config (GA in Opus 4.6)
      requestParams.output_config = { effort: this.config.thinking.effort };
    } else {
      // Legacy enabled mode with budget_tokens (deprecated on Opus 4.6)
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: this.getThinkingBudget(),
      };
    }

    // Data residency (Opus 4.6+)
    if (this.config.inferenceGeo && this.config.inferenceGeo !== "global") {
      requestParams.inference_geo = this.config.inferenceGeo;
    }

    // Context compaction (Opus 4.6 beta)
    if (this.config.compaction?.enabled) {
      requestParams.context_management = {
        edits: [
          {
            type: "compact_20260112",
            trigger: {
              type: "input_tokens",
              value: this.config.compaction.triggerTokens ?? 150000,
            },
            pause_after_compaction: this.config.compaction.pauseAfterCompaction ?? false,
            ...(this.config.compaction.instructions
              ? { instructions: this.config.compaction.instructions }
              : {}),
          },
        ],
      };
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools;
    }

    return requestParams;
  }

  /**
   * Parse the Claude response into structured blocks
   */
  private parseResponse(
    response: Anthropic.Message,
    thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[],
    textBlocks: TextBlock[],
    toolUseBlocks: ToolUseBlock[],
    compactionBlocks: CompactionBlock[]
  ): ThinkingResult {
    const content: ContentBlock[] = [];

    for (const block of response.content) {
      const blockData = block as unknown as Record<string, unknown>;

      if (blockData.type === "thinking") {
        const thinkingBlock: ThinkingBlock = {
          type: "thinking",
          thinking: blockData.thinking as string,
          signature: blockData.signature as string,
        };
        thinkingBlocks.push(thinkingBlock);
        content.push(thinkingBlock);
      } else if (blockData.type === "redacted_thinking") {
        const redactedBlock: RedactedThinkingBlock = {
          type: "redacted_thinking",
          data: blockData.data as string,
        };
        thinkingBlocks.push(redactedBlock);
        content.push(redactedBlock);
      } else if (blockData.type === "compaction") {
        const compactionBlock: CompactionBlock = {
          type: "compaction",
          content: blockData.content as string,
        };
        compactionBlocks.push(compactionBlock);
        content.push(compactionBlock);
        logger.info("Compaction block received", {
          summaryLength: compactionBlock.content.length,
        });
      } else if (block.type === "text") {
        const textBlock: TextBlock = {
          type: "text",
          text: block.text,
        };
        textBlocks.push(textBlock);
        content.push(textBlock);
      } else if (block.type === "tool_use") {
        const toolBlock: ToolUseBlock = {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
        toolUseBlocks.push(toolBlock);
        content.push(toolBlock);
      }
    }

    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    // Check for extended usage fields (cache tokens, thinking tokens)
    const extendedUsage = response.usage as unknown as Record<string, unknown>;
    if (typeof extendedUsage.cache_creation_input_tokens === "number") {
      usage.cacheCreationInputTokens = extendedUsage.cache_creation_input_tokens;
    }
    if (typeof extendedUsage.cache_read_input_tokens === "number") {
      usage.cacheReadInputTokens = extendedUsage.cache_read_input_tokens;
    }

    return {
      content,
      thinkingBlocks,
      textBlocks,
      toolUseBlocks,
      compactionBlocks,
      usage,
      compacted: compactionBlocks.length > 0,
      stopReason: response.stop_reason ?? undefined,
    };
  }

  /**
   * Get the thinking budget based on effort level.
   * Only used for legacy "enabled" mode - deprecated on Opus 4.6.
   * Use adaptive thinking with effort parameter instead.
   */
  private getThinkingBudget(): number {
    if (this.config.thinking.budgetTokens) {
      return this.config.thinking.budgetTokens;
    }

    switch (this.config.thinking.effort) {
      case "low":
        return 5000;
      case "medium":
        return 10000;
      case "high":
        return 20000;
      case "max":
        return 50000;
      default:
        return 10000;
    }
  }

  /**
   * Update streaming callbacks
   */
  setCallbacks(callbacks: {
    onThinkingStream?: (thinking: string) => void;
    onTextStream?: (text: string) => void;
    onCompactionStream?: (summary: string) => void;
  }): void {
    this.onThinkingStream = callbacks.onThinkingStream;
    this.onTextStream = callbacks.onTextStream;
    this.onCompactionStream = callbacks.onCompactionStream;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
