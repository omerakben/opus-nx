/**
 * Server-side database client.
 * Re-exports from @opus-nx/db for use in API routes and server components.
 */

export {
  // Sessions
  createSession,
  getSession,
  getActiveSessions,
  updateSessionPlan,
  updateSessionContext,
  completeSession,
  // Thinking nodes
  createThinkingNode,
  getThinkingNode,
  getSessionThinkingNodes,
  getLatestThinkingNode,
  // Reasoning edges
  createReasoningEdge,
  getEdgesFromNode,
  getEdgesToNode,
  // Decision points
  createDecisionPoint,
  getDecisionPoints,
  createDecisionPoints,
  // Graph traversal
  traverseReasoningGraph,
  getSessionReasoningContext,
  searchReasoningNodes,
  getReasoningChain,
  // Metacognition
  createMetacognitiveInsight,
  createMetacognitiveInsights,
  getMetacognitiveInsight,
  getSessionInsights,
  getInsightsByType,
  getRecentInsights,
  searchInsights,
  getInsightsForNode,
  getInsightCountsByType,
  // Types
  type Session,
  type ThinkingNode,
  type ReasoningEdge,
  type DecisionPoint,
  type MetacognitiveInsight,
  type InsightType,
} from "@opus-nx/db";
