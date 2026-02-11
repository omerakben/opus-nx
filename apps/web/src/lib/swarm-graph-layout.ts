/**
 * Incremental columnar layout for the swarm graph.
 *
 * Each agent gets its own column. Nodes stack vertically within their
 * agent's column. Positions are calculated incrementally so existing
 * nodes are never repositioned when a new node appears.
 */

export interface SwarmLayoutNode {
  id: string;
  agent: string;
  position?: { x: number; y: number };
}

const AGENT_COLUMNS: Record<string, number> = {
  maestro: 0,
  deep_thinker: 350,
  contrarian: 700,
  verifier: 1050,
  synthesizer: 1400,
  metacognition: 1750,
};

const ROW_HEIGHT = 180;

/** Fallback x for agents not in the predefined column map */
const FALLBACK_START_X = 2100;
const FALLBACK_COLUMN_WIDTH = 350;

/**
 * Calculate positions for swarm graph nodes using an incremental columnar layout.
 *
 * Nodes that already have a position are preserved. Only new nodes (those
 * without a position) get assigned coordinates. This ensures the layout is
 * stable as new nodes stream in.
 */
export function calculateSwarmLayout(
  nodes: SwarmLayoutNode[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Track how many nodes already exist per agent column so we can
  // assign the next y-offset for new nodes.
  const agentRowCount = new Map<string, number>();

  // Track dynamically assigned columns for unknown agents
  const dynamicColumns = new Map<string, number>();
  let nextDynamicX = FALLBACK_START_X;

  function getColumnX(agent: string): number {
    if (agent in AGENT_COLUMNS) {
      return AGENT_COLUMNS[agent];
    }
    if (dynamicColumns.has(agent)) {
      return dynamicColumns.get(agent)!;
    }
    const x = nextDynamicX;
    dynamicColumns.set(agent, x);
    nextDynamicX += FALLBACK_COLUMN_WIDTH;
    return x;
  }

  // First pass: register nodes that already have positions so we know
  // how many rows each agent column already occupies.
  for (const node of nodes) {
    if (node.position) {
      positions.set(node.id, node.position);
      const count = agentRowCount.get(node.agent) ?? 0;
      agentRowCount.set(node.agent, count + 1);
    }
  }

  // Second pass: assign positions to nodes that don't have one yet.
  for (const node of nodes) {
    if (positions.has(node.id)) continue;

    const x = getColumnX(node.agent);
    const row = agentRowCount.get(node.agent) ?? 0;
    const y = row * ROW_HEIGHT;

    positions.set(node.id, { x, y });
    agentRowCount.set(node.agent, row + 1);
  }

  return positions;
}
