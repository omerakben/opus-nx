import { createLogger } from "@opus-nx/shared";
import { ThinkingEngine } from "./thinking-engine.js";
import type {
  StepVerification,
  ChainVerification,
  PRMConfig,
  StepVerdict,
  STEP_VERIFICATION_TOOL as StepVerificationToolType,
} from "./types/prm.js";
import { STEP_VERIFICATION_TOOL } from "./types/prm.js";
import type { OrchestratorConfig, ToolUseBlock } from "./types/orchestrator.js";
import type { ReasoningStep, StructuredReasoning } from "./types/thinking.js";

const logger = createLogger("PRMVerifier");

// ============================================================
// PRM Verifier Options
// ============================================================

export interface PRMVerifierOptions {
  config?: Partial<PRMConfig>;
  /** Callback when a step is verified */
  onStepVerified?: (step: StepVerification) => void;
  /** Callback for streaming thinking */
  onThinkingStream?: (thinking: string) => void;
}

// ============================================================
// Process Reward Model Verifier
// ============================================================

/**
 * PRMVerifier implements step-by-step verification of reasoning chains.
 *
 * Based on "Let's Verify Step by Step" (Lightman et al., 2023),
 * this verifier evaluates each reasoning step independently rather
 * than only judging the final outcome. This catches:
 *
 * - Logical errors in intermediate steps
 * - Factual mistakes hidden by a correct-seeming conclusion
 * - Unsupported leaps in reasoning
 * - Circular reasoning and non sequiturs
 *
 * The key insight from the paper: process supervision significantly
 * outperforms outcome supervision. A chain is only as strong as
 * its weakest step.
 */
export class PRMVerifier {
  private config: PRMConfig;
  private onStepVerified?: (step: StepVerification) => void;
  private onThinkingStream?: (thinking: string) => void;

  constructor(options: PRMVerifierOptions = {}) {
    this.config = {
      correctnessThreshold: options.config?.correctnessThreshold ?? 0.7,
      suggestCorrections: options.config?.suggestCorrections ?? true,
      detectPatterns: options.config?.detectPatterns ?? true,
      maxSteps: options.config?.maxSteps ?? 50,
      effort: options.config?.effort ?? "high",
      verificationMode: options.config?.verificationMode ?? "self",
    };
    this.onStepVerified = options.onStepVerified;
    this.onThinkingStream = options.onThinkingStream;

    logger.debug("PRMVerifier initialized", {
      threshold: this.config.correctnessThreshold,
      mode: this.config.verificationMode,
    });
  }

  /**
   * Verify a complete reasoning chain step by step.
   *
   * This is the main entry point. It:
   * 1. Splits reasoning into steps
   * 2. Verifies each step with the LLM
   * 3. Computes overall chain score
   * 4. Detects patterns across steps
   * 5. Returns comprehensive verification
   */
  async verifyChain(
    reasoning: StructuredReasoning,
    options?: { thinkingNodeId?: string; originalQuery?: string }
  ): Promise<ChainVerification> {
    const startTime = Date.now();
    const steps = reasoning.steps.slice(0, this.config.maxSteps);

    if (steps.length === 0) {
      return {
        thinkingNodeId: options?.thinkingNodeId,
        steps: [],
        overallScore: 0,
        isValid: false,
        firstErrorAt: -1,
        summary: "No reasoning steps to verify.",
        patterns: [],
        metadata: {
          verificationModel: "claude-opus-4-6",
          durationMs: Date.now() - startTime,
          verifiedAt: new Date(),
        },
      };
    }

    logger.info("Starting chain verification", {
      stepCount: steps.length,
      thinkingNodeId: options?.thinkingNodeId,
    });

    // Verify each step
    const verifications: StepVerification[] = [];
    let firstErrorAt = -1;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const previousSteps = steps.slice(0, i);
      const verification = await this.verifyStep(
        step,
        i,
        previousSteps,
        options?.originalQuery
      );

      verifications.push(verification);
      this.onStepVerified?.(verification);

      if (verification.verdict === "incorrect" && firstErrorAt === -1) {
        firstErrorAt = i;
      }

      logger.debug(`Step ${i} verified`, {
        verdict: verification.verdict,
        confidence: verification.confidence,
        issueCount: verification.issues.length,
      });
    }

    // Compute overall chain score
    const overallScore = this.computeChainScore(verifications);
    const isValid = overallScore >= this.config.correctnessThreshold;

    // Detect patterns across steps
    const patterns = this.config.detectPatterns
      ? this.detectPatterns(verifications)
      : [];

    // Build summary
    const summary = this.buildVerificationSummary(verifications, overallScore, isValid);

    const result: ChainVerification = {
      thinkingNodeId: options?.thinkingNodeId,
      steps: verifications,
      overallScore,
      isValid,
      firstErrorAt,
      summary,
      patterns,
      metadata: {
        verificationModel: "claude-opus-4-6",
        durationMs: Date.now() - startTime,
        verifiedAt: new Date(),
      },
    };

    logger.info("Chain verification complete", {
      overallScore,
      isValid,
      firstErrorAt,
      correctSteps: verifications.filter((v) => v.verdict === "correct").length,
      incorrectSteps: verifications.filter((v) => v.verdict === "incorrect").length,
      durationMs: result.metadata.durationMs,
    });

    return result;
  }

  /**
   * Verify a single reasoning step.
   *
   * Uses Claude to critically evaluate the step considering:
   * - The step's content
   * - All preceding steps (context)
   * - The original query (if available)
   */
  private async verifyStep(
    step: ReasoningStep,
    index: number,
    previousSteps: ReasoningStep[],
    originalQuery?: string
  ): Promise<StepVerification> {
    const engine = this.createEngine();

    const previousContext = previousSteps.length > 0
      ? previousSteps
          .map((s, i) => `Step ${i + 1} (${s.type ?? "reasoning"}): ${s.content}`)
          .join("\n\n")
      : "(No previous steps)";

    const prompt = `You are a rigorous reasoning verifier. Evaluate Step ${index + 1} in this reasoning chain.

${originalQuery ? `## Original Question\n${originalQuery}\n\n` : ""}## Previous Steps
${previousContext}

## Step ${index + 1} to Verify (type: ${step.type ?? "reasoning"})
${step.content}

## Verification Instructions
Evaluate this step for:
1. **Logical correctness**: Does the reasoning follow from previous steps?
2. **Factual accuracy**: Are any claims factually wrong?
3. **Completeness**: Is important context missing?
4. **Argumentation**: Are claims properly supported?

Be precise. A step is "correct" if its reasoning is sound even if you'd approach it differently.
A step is "incorrect" only if it contains a demonstrable error.

Use the verify_step tool to record your evaluation.`;

    try {
      const result = await engine.think(
        "You are a process reward model that verifies reasoning steps. Be rigorous but fair. Only mark steps as incorrect when there is a clear error.",
        [{ role: "user", content: prompt }],
        [STEP_VERIFICATION_TOOL]
      );

      const toolUse = result.toolUseBlocks.find((b) => b.name === "verify_step");
      if (toolUse) {
        return this.parseStepVerification(toolUse, index, step.content);
      }

      // Fallback: extract from text
      return this.createDefaultVerification(index, step.content, "uncertain");
    } catch (error) {
      logger.warn(`Step ${index} verification failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createDefaultVerification(index, step.content, "uncertain");
    }
  }

  /**
   * Parse the verify_step tool output into a StepVerification.
   */
  private parseStepVerification(
    toolUse: ToolUseBlock,
    stepIndex: number,
    stepContent: string
  ): StepVerification {
    const input = toolUse.input as Record<string, unknown>;

    const validVerdicts: StepVerdict[] = ["correct", "incorrect", "neutral", "uncertain"];
    const rawVerdict = String(input.verdict ?? "uncertain");
    const verdict: StepVerdict = validVerdicts.includes(rawVerdict as StepVerdict)
      ? (rawVerdict as StepVerdict)
      : "uncertain";

    const rawConfidence = Number(input.confidence);
    const confidence = Number.isNaN(rawConfidence)
      ? 0.5
      : Math.min(1, Math.max(0, rawConfidence));

    const issues: StepVerification["issues"] = [];
    if (Array.isArray(input.issues)) {
      for (const issue of input.issues) {
        const issueData = issue as Record<string, unknown>;
        const validTypes = [
          "logical_error", "factual_error", "missing_context",
          "unsupported_claim", "circular_reasoning", "non_sequitur",
          "overgeneralization", "false_dichotomy",
        ] as const;
        const validSeverities = ["critical", "major", "minor"] as const;

        const rawType = String(issueData.type ?? "logical_error");
        const rawSeverity = String(issueData.severity ?? "minor");

        issues.push({
          type: validTypes.includes(rawType as typeof validTypes[number])
            ? (rawType as typeof validTypes[number])
            : "logical_error",
          description: String(issueData.description ?? ""),
          severity: validSeverities.includes(rawSeverity as typeof validSeverities[number])
            ? (rawSeverity as typeof validSeverities[number])
            : "minor",
        });
      }
    }

    return {
      stepIndex,
      stepContent,
      verdict,
      confidence,
      explanation: String(input.explanation ?? ""),
      issues,
      suggestedCorrection: input.suggested_correction
        ? String(input.suggested_correction)
        : undefined,
    };
  }

  /**
   * Create a default verification when LLM verification fails.
   */
  private createDefaultVerification(
    stepIndex: number,
    stepContent: string,
    verdict: StepVerdict
  ): StepVerification {
    return {
      stepIndex,
      stepContent,
      verdict,
      confidence: 0.5,
      explanation: "Verification could not be performed.",
      issues: [],
    };
  }

  /**
   * Compute overall chain score using the PRM approach.
   *
   * The chain score is the product of individual step confidence scores
   * for correct steps, penalized by incorrect steps. This means one
   * bad step can significantly lower the entire chain's score.
   */
  private computeChainScore(verifications: StepVerification[]): number {
    if (verifications.length === 0) return 0;

    let score = 1.0;

    for (const v of verifications) {
      switch (v.verdict) {
        case "correct":
          // Multiply by confidence — high confidence correct steps maintain score
          score *= v.confidence;
          break;
        case "incorrect":
          // Incorrect steps severely penalize the chain
          score *= (1 - v.confidence) * 0.3;
          break;
        case "neutral":
          // Neutral steps slightly reduce score
          score *= 0.9;
          break;
        case "uncertain":
          // Uncertain steps moderately reduce score
          score *= 0.7;
          break;
      }
    }

    // Normalize to prevent very long chains from always scoring near 0
    // Use geometric mean instead of raw product
    const geoMean = Math.pow(score, 1 / verifications.length);
    return Math.round(geoMean * 100) / 100;
  }

  /**
   * Detect patterns across verified steps.
   * Looks for recurring issues or structural patterns.
   */
  private detectPatterns(
    verifications: StepVerification[]
  ): ChainVerification["patterns"] {
    const patterns: ChainVerification["patterns"] = [];

    // Pattern: Declining confidence
    const confidences = verifications.map((v) => v.confidence);
    if (confidences.length >= 3) {
      const isDecreasing = confidences.every((c, i) =>
        i === 0 || c <= confidences[i - 1]
      );
      if (isDecreasing && confidences[0] - confidences[confidences.length - 1] > 0.2) {
        patterns.push({
          name: "declining_confidence",
          description: "Confidence decreases through the chain, suggesting reasoning becomes less certain over time.",
          affectedSteps: confidences.map((_, i) => i),
        });
      }
    }

    // Pattern: Repeated issue types
    const issueTypeCounts = new Map<string, number[]>();
    for (const v of verifications) {
      for (const issue of v.issues) {
        const steps = issueTypeCounts.get(issue.type) ?? [];
        steps.push(v.stepIndex);
        issueTypeCounts.set(issue.type, steps);
      }
    }
    for (const [issueType, steps] of issueTypeCounts) {
      if (steps.length >= 2) {
        patterns.push({
          name: `recurring_${issueType}`,
          description: `The issue "${issueType}" appears in ${steps.length} steps, suggesting a systematic problem.`,
          affectedSteps: steps,
        });
      }
    }

    // Pattern: Error after high confidence
    for (let i = 1; i < verifications.length; i++) {
      if (
        verifications[i - 1].verdict === "correct" &&
        verifications[i - 1].confidence > 0.8 &&
        verifications[i].verdict === "incorrect"
      ) {
        patterns.push({
          name: "overconfidence_before_error",
          description: "A high-confidence correct step is immediately followed by an error, suggesting overconfidence may have led to less careful reasoning.",
          affectedSteps: [i - 1, i],
        });
      }
    }

    return patterns;
  }

  /**
   * Build a human-readable verification summary.
   */
  private buildVerificationSummary(
    verifications: StepVerification[],
    overallScore: number,
    isValid: boolean
  ): string {
    const correct = verifications.filter((v) => v.verdict === "correct").length;
    const incorrect = verifications.filter((v) => v.verdict === "incorrect").length;
    const uncertain = verifications.filter((v) => v.verdict === "uncertain" || v.verdict === "neutral").length;

    const criticalIssues = verifications
      .flatMap((v) => v.issues)
      .filter((i) => i.severity === "critical");

    let summary = `**Chain Score**: ${(overallScore * 100).toFixed(0)}% (${isValid ? "VALID" : "INVALID"})\n`;
    summary += `**Steps**: ${correct} correct, ${incorrect} incorrect, ${uncertain} uncertain\n`;

    if (criticalIssues.length > 0) {
      summary += `\n**Critical Issues**:\n`;
      for (const issue of criticalIssues) {
        summary += `- ${issue.type}: ${issue.description}\n`;
      }
    }

    if (incorrect > 0) {
      const firstError = verifications.find((v) => v.verdict === "incorrect");
      if (firstError) {
        summary += `\n**First Error** at Step ${firstError.stepIndex + 1}: ${firstError.explanation}`;
      }
    }

    return summary;
  }

  /**
   * Create a ThinkingEngine configured for verification.
   */
  private createEngine(): ThinkingEngine {
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6",
      thinking: { type: "adaptive", effort: this.config.effort },
      streaming: false,
      maxTokens: 4096,
    };
    return new ThinkingEngine({
      config,
      onThinkingStream: this.onThinkingStream,
    });
  }
}

// ============================================================
// Factory
// ============================================================

export function createPRMVerifier(options?: PRMVerifierOptions): PRMVerifier {
  return new PRMVerifier(options);
}
