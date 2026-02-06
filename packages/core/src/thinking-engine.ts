import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@opus-nx/shared";
import type {
  ThinkingBlock,
  RedactedThinkingBlock,
  TextBlock,
  ToolUseBlock,
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
}

// ============================================================
// Thinking Engine
// ============================================================

/**
 * ThinkingEngine wraps Claude Opus 4.6 with extended thinking capabilities.
 *
 * This is the "brain" of Opus Nx - it uses adaptive thinking to reason
 * through complex problems before acting.
 */
export class ThinkingEngine {
  private client: Anthropic;
  private config: OrchestratorConfig;
  private onThinkingStream?: (thinking: string) => void;
  private onTextStream?: (text: string) => void;

  constructor(options: ThinkingEngineOptions) {
    this.client = new Anthropic();
    this.config = options.config;
    this.onThinkingStream = options.onThinkingStream;
    this.onTextStream = options.onTextStream;
  }

  /**
   * Execute a thinking request with Claude Opus 4.6
   *
   * Uses extended thinking with configurable budget levels to reason
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
    // Build request with extended thinking
    const requestParams: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt,
      messages,
      stream: true,
    };

    // Configure thinking based on type (adaptive is recommended for Opus 4.6)
    if (this.config.thinking.type === "adaptive") {
      // New adaptive thinking mode - Claude decides when/how much to think
      requestParams.thinking = { type: "adaptive" };
      // Effort is now set via output_config (GA in Claude 4.6)
      requestParams.output_config = { effort: this.config.thinking.effort };
    } else {
      // Legacy enabled mode with budget_tokens (deprecated on Opus 4.6)
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: this.getThinkingBudget(),
      };
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools;
    }

    const stream = this.client.messages.stream(
      requestParams as unknown as Anthropic.MessageCreateParamsStreaming
    );

    const thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[] = [];
    const textBlocks: TextBlock[] = [];
    const toolUseBlocks: ToolUseBlock[] = [];

    // Process streaming events
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as unknown as Record<string, unknown>;
        if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
          this.onThinkingStream?.(delta.thinking);
        } else if (delta.type === "text_delta" && typeof delta.text === "string") {
          this.onTextStream?.(delta.text);
        }
      }
    }

    const response = await stream.finalMessage();
    return this.parseResponse(response, thinkingBlocks, textBlocks, toolUseBlocks);
  }

  /**
   * Non-streaming thinking request
   */
  private async nonStreamingThink(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[] | undefined
  ): Promise<ThinkingResult> {
    // Build request with extended thinking
    const requestParams: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt,
      messages,
    };

    // Configure thinking based on type (adaptive is recommended for Opus 4.6)
    if (this.config.thinking.type === "adaptive") {
      // New adaptive thinking mode - Claude decides when/how much to think
      requestParams.thinking = { type: "adaptive" };
      // Effort is now set via output_config (GA in Claude 4.6)
      requestParams.output_config = { effort: this.config.thinking.effort };
    } else {
      // Legacy enabled mode with budget_tokens (deprecated on Opus 4.6)
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: this.getThinkingBudget(),
      };
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools;
    }

    const response = await this.client.messages.create(
      requestParams as unknown as Anthropic.MessageCreateParams
    ) as Anthropic.Message;

    return this.parseResponse(response, [], [], []);
  }

  /**
   * Parse the Claude response into structured blocks
   */
  private parseResponse(
    response: Anthropic.Message,
    thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[],
    textBlocks: TextBlock[],
    toolUseBlocks: ToolUseBlock[]
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

    // Check for extended usage fields (cache tokens)
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
      usage,
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
  }): void {
    this.onThinkingStream = callbacks.onThinkingStream;
    this.onTextStream = callbacks.onTextStream;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
