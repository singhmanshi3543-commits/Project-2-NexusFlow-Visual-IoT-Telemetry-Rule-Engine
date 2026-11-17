import { NODE_DEFINITIONS, getNodeDefinition } from './nodeRegistry.js';

export interface GraphNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface GraphDefinition {
  id?: string;
  name?: string;
  version?: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sourceNodeIds: string[];
  leafNodeIds: string[];
}

export function validateGraph(graph: GraphDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceNodeIds: string[] = [];
  const leafNodeIds: string[] = [];

  if (!graph.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return {
      isValid: false,
      errors: ['Graph definition must contain at least one node.'],
      warnings: [],
      sourceNodeIds: [],
      leafNodeIds: [],
    };
  }

  const nodeMap = new Map<string, GraphNode>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  // 1. Validate nodes
  for (const node of graph.nodes) {
    if (!node.id) {
      errors.push('All nodes must have a unique non-empty id.');
      continue;
    }
    if (nodeMap.has(node.id)) {
      errors.push(`Duplicate node id detected: ${node.id}`);
    }
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
    adj.set(node.id, []);

    const def = getNodeDefinition(node.type);
    if (!def) {
      errors.push(`Unsupported node type '${node.type}' on node '${node.id}'. Node is not in the allowlist.`);
      continue;
    }

    // Validate config payload with Zod
    const parsed = def.schema.safeParse(node.data || {});
    if (!parsed.success) {
      const issueMsgs = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      errors.push(`Configuration validation failed for node '${node.id}' (${def.displayName}): ${issueMsgs}`);
    }

    if (def.category === 'source') {
      sourceNodeIds.push(node.id);
    }
  }

  if (sourceNodeIds.length === 0) {
    errors.push('Graph must contain at least one Data Source node to ingest telemetry.');
  }

  // 2. Validate edges
  const edges = graph.edges || [];
  for (const edge of edges) {
    if (!edge.source || !edge.target) {
      errors.push(`Invalid edge: missing source or target (${JSON.stringify(edge)})`);
      continue;
    }
    if (!nodeMap.has(edge.source)) {
      errors.push(`Edge references non-existent source node: ${edge.source}`);
      continue;
    }
    if (!nodeMap.has(edge.target)) {
      errors.push(`Edge references non-existent target node: ${edge.target}`);
      continue;
    }
    if (edge.source === edge.target) {
      errors.push(`Self-referencing cycle detected on node: ${edge.source}`);
      continue;
    }

    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    adj.get(edge.source)!.push(edge.target);
  }

  // 3. Check connectivity & degrees
  for (const [id, node] of nodeMap.entries()) {
    const def = getNodeDefinition(node.type);
    if (!def) continue;

    if (def.category === 'source' && (inDegree.get(id) || 0) > 0) {
      warnings.push(`Data Source node '${id}' has incoming connections, which will be ignored.`);
    }

    if (def.category !== 'source' && (inDegree.get(id) || 0) === 0) {
      errors.push(`Node '${id}' (${def.displayName}) is disconnected with no incoming data inputs.`);
    }

    if (def.category === 'action' && (outDegree.get(id) || 0) === 0) {
      leafNodeIds.push(id);
    }
  }

  // 4. Cycle Detection (Tarjan's or Kahn's algorithm for DAG verification)
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycle = false;

  function detectCycle(current: string): boolean {
    visited.add(current);
    recStack.add(current);

    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (detectCycle(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(current);
    return false;
  }

  for (const id of nodeMap.keys()) {
    if (!visited.has(id)) {
      if (detectCycle(id)) {
        hasCycle = true;
        break;
      }
    }
  }

  if (hasCycle) {
    errors.push('Cyclic loop detected! NexusFlow execution graphs must be strictly acyclic (DAG).');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sourceNodeIds,
    leafNodeIds,
  };
}
