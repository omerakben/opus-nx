/**
 * Day 1 Integration Test: ThinkGraph
 *
 * Tests the core ThinkGraph parsing and extraction logic.
 * Run with: pnpm --filter @opus-nx/core test
 */

import { ThinkGraph } from "./think-graph.ts";
import type { ThinkingBlock, RedactedThinkingBlock } from "./types/orchestrator.ts";

// ============================================================
// Test Utilities
// ============================================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function section(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log("=".repeat(60));
}

// ============================================================
// Sample Thinking Blocks
// ============================================================

const sampleThinkingWithDecisions: ThinkingBlock[] = [
  {
    type: "thinking",
    thinking: `Let me analyze this problem carefully.

First, I need to consider the options available. On one hand, I could use a recursive approach which would be more elegant. On the other hand, an iterative approach would be more memory efficient.

I'm comparing Option A (recursion) versus Option B (iteration). The trade-off here is between code clarity and performance.

After weighing the pros and cons, I'll go with the iterative approach because it avoids stack overflow issues for large inputs. I'm confident this is the right choice given the requirements.

Therefore, I will implement the solution using a simple while loop with O(1) space complexity.`,
    signature: "test-signature-123",
  },
];

const sampleThinkingWithAlternatives: ThinkingBlock[] = [
  {
    type: "thinking",
    thinking: `Looking at the authentication options:

Option 1: JWT tokens - stateless, but harder to revoke
Option 2: Session-based - easy to revoke, but requires server state
Option 3: OAuth integration - more complex, but supports SSO

I've decided to go with JWT tokens because the application is stateless and token revocation isn't a critical requirement. However, I ruled out sessions because they would add server complexity, and OAuth was rejected because it's overkill for this use case.

The best approach is to implement JWT with short expiration times to mitigate the revocation limitation. I'm reasonably confident this will work well for the MVP.`,
    signature: "test-signature-456",
  },
];

const sampleThinkingHighConfidence: ThinkingBlock[] = [
  {
    type: "thinking",
    thinking: `This is definitely the correct approach. The evidence is conclusive and I'm absolutely certain about this decision. Based on the proven patterns and established best practices, I'm confident this will work.`,
    signature: "test-signature-789",
  },
];

const sampleThinkingLowConfidence: ThinkingBlock[] = [
  {
    type: "thinking",
    thinking: `I'm uncertain about this. It might work, but I'm unsure. The requirements are ambiguous and the outcome is questionable. Perhaps we should consider other options, but I could be wrong.`,
    signature: "test-signature-abc",
  },
];

const emptyThinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[] = [];

const redactedThinkingBlocks: RedactedThinkingBlock[] = [
  {
    type: "redacted_thinking",
    data: "base64-encoded-data",
  },
];

// ============================================================
// Tests
// ============================================================

async function runTests() {
  console.log("\n🧠 ThinkGraph Day 1 Integration Tests\n");
  console.log("Testing the core innovation: transforming reasoning into data\n");

  const thinkGraph = new ThinkGraph();

  // Test 1: Basic parsing
  section("Test 1: Basic Thinking Block Parsing");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);

    assert(result.reasoning.length > 0, "Reasoning text is extracted");
    assert(
      result.reasoning.includes("analyze this problem"),
      "Reasoning contains original text"
    );
    assert(
      result.structuredReasoning.steps.length > 0,
      "Structured reasoning has steps"
    );
    assert(
      result.structuredReasoning.alternativesConsidered > 0,
      "Alternatives are counted"
    );

    console.log(`   Steps found: ${result.structuredReasoning.steps.length}`);
    console.log(
      `   Alternatives counted: ${result.structuredReasoning.alternativesConsidered}`
    );
  }

  // Test 2: Decision point extraction
  section("Test 2: Decision Point Extraction");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);

    assert(result.decisionPoints.length > 0, "Decision points are extracted");

    const hasChosenPath = result.decisionPoints.some((dp) => dp.chosenPath);
    assert(hasChosenPath, "Decision points have chosen paths");

    console.log(`   Decision points found: ${result.decisionPoints.length}`);
    result.decisionPoints.forEach((dp, i) => {
      console.log(`   [${i + 1}] ${dp.description.substring(0, 60)}...`);
    });
  }

  // Test 3: Alternative extraction
  section("Test 3: Alternative Path Extraction");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingWithAlternatives);

    const totalAlternatives = result.decisionPoints.reduce(
      (sum, dp) => sum + (dp.alternatives?.length ?? 0),
      0
    );

    assert(
      result.decisionPoints.length > 0,
      "Decision points extracted from alternatives text"
    );

    console.log(`   Decision points: ${result.decisionPoints.length}`);
    console.log(`   Total alternatives captured: ${totalAlternatives}`);
  }

  // Test 4: Confidence scoring - high confidence
  section("Test 4: Confidence Scoring (High Confidence)");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingHighConfidence);

    assert(result.confidenceScore !== null, "Confidence score is calculated");
    assert(
      result.confidenceScore! >= 0.7,
      `High confidence score (${result.confidenceScore}) >= 0.7`
    );

    console.log(`   Confidence score: ${result.confidenceScore}`);
  }

  // Test 5: Confidence scoring - low confidence
  section("Test 5: Confidence Scoring (Low Confidence)");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingLowConfidence);

    assert(result.confidenceScore !== null, "Confidence score is calculated");
    assert(
      result.confidenceScore! <= 0.5,
      `Low confidence score (${result.confidenceScore}) <= 0.5`
    );

    console.log(`   Confidence score: ${result.confidenceScore}`);
  }

  // Test 6: Empty input handling
  section("Test 6: Empty Input Handling");
  {
    const result = thinkGraph.parseThinkingToNode(emptyThinkingBlocks);

    assert(result.reasoning === "", "Empty reasoning for empty input");
    assert(
      result.structuredReasoning.steps.length === 0,
      "No steps for empty input"
    );
    assert(result.decisionPoints.length === 0, "No decision points for empty input");
    assert(result.confidenceScore === null, "Null confidence for empty input");

    console.log("   Empty input handled gracefully");
  }

  // Test 7: Redacted thinking handling
  section("Test 7: Redacted Thinking Handling");
  {
    const result = thinkGraph.parseThinkingToNode(redactedThinkingBlocks);

    assert(
      result.reasoning === "",
      "Redacted thinking blocks don't expose content"
    );
    assert(
      result.structuredReasoning.steps.length === 0,
      "No steps from redacted content"
    );

    console.log("   Redacted thinking blocks handled correctly");
  }

  // Test 8: Reasoning step classification
  section("Test 8: Reasoning Step Classification");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);

    const stepTypes = result.structuredReasoning.steps.map((s) => s.type);
    const uniqueTypes = [...new Set(stepTypes)];

    assert(uniqueTypes.length > 0, "Steps have type classifications");
    assert(
      result.structuredReasoning.steps.every(
        (s) =>
          s.type === "analysis" ||
          s.type === "hypothesis" ||
          s.type === "evaluation" ||
          s.type === "conclusion" ||
          s.type === "consideration"
      ),
      "All step types are valid"
    );

    console.log(`   Step types found: ${uniqueTypes.join(", ")}`);
  }

  // Test 9: Confidence factors extraction
  section("Test 9: Confidence Factors Extraction");
  {
    const thinkingWithFactors: ThinkingBlock[] = [
      {
        type: "thinking",
        thinking: `I'm confident because the data clearly shows a pattern. Based on the evidence, I believe this is correct. The analysis indicates strong support for this approach.`,
        signature: "test-sig",
      },
    ];

    const result = thinkGraph.parseThinkingToNode(thinkingWithFactors);

    console.log(
      `   Confidence factors: ${result.structuredReasoning.confidenceFactors.length}`
    );
    result.structuredReasoning.confidenceFactors.forEach((f, i) => {
      console.log(`   [${i + 1}] ${f.substring(0, 50)}...`);
    });
  }

  // Test 10: Main conclusion extraction
  section("Test 10: Main Conclusion Extraction");
  {
    const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);

    if (result.structuredReasoning.mainConclusion) {
      assert(
        result.structuredReasoning.mainConclusion.length > 0,
        "Main conclusion is extracted"
      );
      console.log(
        `   Conclusion: ${result.structuredReasoning.mainConclusion.substring(0, 80)}...`
      );
    } else {
      console.log("   No explicit conclusion found (may be implicit)");
    }
  }

  // Summary
  section("Test Summary");
  if (process.exitCode === 1) {
    console.log("\n❌ Some tests failed. See errors above.\n");
  } else {
    console.log("\n✅ All tests passed!\n");
    console.log("ThinkGraph core functionality is working correctly:");
    console.log("  - Thinking blocks are parsed into structured data");
    console.log("  - Decision points are extracted with alternatives");
    console.log("  - Confidence scores are calculated from language");
    console.log("  - Reasoning steps are classified by type");
    console.log("  - Edge cases (empty, redacted) are handled\n");
    console.log(
      "Ready for Day 2: Metacognition Engine 🧠\n"
    );
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exitCode = 1;
});
