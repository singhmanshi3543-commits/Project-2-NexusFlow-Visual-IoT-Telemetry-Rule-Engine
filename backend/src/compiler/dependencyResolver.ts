import { GraphDefinition, GraphNode } from './graphValidator.js';

export interface ExecutionOrderResult {
  sortedNodeIds: string[];
  nodeInputMap: Map<string, string[]>; // targetNodeId -> sourceNodeIds[]
  nodeOutputMap: Map<string, string[]>; // sourceNodeId -> targetNodeIds[]
}

/**
 * Resolves node topological execution order using Kahn's algorithm
 */
export function resolveDependencyOrder(graph: GraphDefinition): ExecutionOrderResult {
  const inDegree = new Map<string, number>();
  const nodeInputMap = new Map<string, string[]>();
  const nodeOutputMap = new Map<string, string[]>();
  const allNodeIds = new Set<string>();

  for (const node of graph.nodes) {
    allNodeIds.add(node.id);
    inDegree.set(node.id, 0);
    nodeInputMap.set(node.id, []);
    nodeOutputMap.set(node.id, []);
  }

  for (const edge of graph.edges || []) {
    if (!allNodeIds.has(edge.source) || !allNodeIds.has(edge.target)) continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    nodeInputMap.get(edge.target)!.push(edge.source);
    nodeOutputMap.get(edge.source)!.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sortedNodeIds: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedNodeIds.push(current);

    const neighbors = nodeOutputMap.get(current) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  return {
    sortedNodeIds,
    nodeInputMap,
    nodeOutputMap,
  };
}
