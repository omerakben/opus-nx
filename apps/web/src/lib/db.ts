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
  archiveSession,
  restoreSession,
  deleteSession,
  // Thinking nodes
  createThinkingNode,
  getThinkingNode,
  getSessionThinkingNodes,
  getLatestThinkingNode,
  getFirstNodePerSessions,
  // Reasoning edges
  createReasoningEdge,
  getEdgesFromNode,
  getEdgesForNodes,
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
  // Fork analyses
  createForkAnalysis,
  getSessionForkAnalyses as getSessionForkAnalysesDb,
  getForkAnalysis,
  appendSteeringResult,
  // Types
  type ForkAnalysis,
  type Session,
  type ThinkingNode,
  type ReasoningEdge,
  type DecisionPoint,
  type MetacognitiveInsight,
  type InsightType,
} from "@opus-nx/db";
