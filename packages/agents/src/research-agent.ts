import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AgentResult } from "@opus-nx/core";
import { createLogger } from "@opus-nx/shared";
import { BaseAgent } from "./base-agent.js";

const logger = createLogger("ResearchAgent");

export class ResearchAgent extends BaseAgent {
  async invoke(
    input: string,
    context?: string,
    taskId?: string,
  ): Promise<AgentResult> {
    const start = Date.now();
    const resolvedTaskId = taskId ?? crypto.randomUUID();

    try {
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(
          context ? `Context:\n${context}\n\nTask:\n${input}` : input,
        ),
      ];

      const response = await this.llm.invoke(messages);
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      const usage = response.usage_metadata ?? {
        input_tokens: 0,
        output_tokens: 0,
      };

      logger.debug("Invocation complete", { taskId: resolvedTaskId });

      return {
        agentName: this.config.name,
        taskId: resolvedTaskId,
        success: true,
        result: content,
        tokensUsed: {
          input: usage.input_tokens,
          output: usage.output_tokens,
        },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      logger.error("Invocation failed", { taskId: resolvedTaskId, error: err });

      return {
        agentName: this.config.name,
        taskId: resolvedTaskId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        tokensUsed: { input: 0, output: 0 },
        durationMs: Date.now() - start,
      };
    }
  }
}
