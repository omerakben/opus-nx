import { ChatAnthropic } from "@langchain/anthropic";
import { createLogger } from "@opus-nx/shared";
import type { AgentConfig, AgentResult } from "@opus-nx/core";

const logger = createLogger("BaseAgent");

// ============================================================
// Base Agent Options
// ============================================================

export interface BaseAgentOptions {
  config: AgentConfig;
  systemPrompt: string;
}

// ============================================================
// Base Agent
// ============================================================

/**
 * BaseAgent provides the foundation for all specialized sub-agents.
 *
 * Each agent inherits from this class and implements its own workflow
 * using LangGraph for complex multi-step operations.
 */
export abstract class BaseAgent {
  protected llm: ChatAnthropic;
  protected config: AgentConfig;
  protected systemPrompt: string;

  constructor(options: BaseAgentOptions) {
    this.config = options.config;
    this.systemPrompt = options.systemPrompt;

    this.llm = new ChatAnthropic({
      model: options.config.model,
      maxTokens: options.config.maxTokens,
      temperature: options.config.temperature,
    });

    logger.debug("Agent initialized", {
      name: this.config.name,
      model: this.config.model,
    });
  }

  /**
   * Execute the agent's workflow
   *
   * This method should be implemented by each specialized agent.
   */
  abstract invoke(
    input: string,
    context?: string,
    taskId?: string
  ): Promise<AgentResult>;

  /**
   * Get the agent's configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Get the agent's name
   */
  getName(): string {
    return this.config.name;
  }
}
