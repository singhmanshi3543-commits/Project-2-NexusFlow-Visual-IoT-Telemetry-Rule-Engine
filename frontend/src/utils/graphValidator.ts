import type {
  GraphValidationError,
  GraphValidationWarning,
  GraphValidationResult,
} from '../types/graph';

/**
 * Standard allowlisted node types in NexusFlow
 */
export const KNOWN_NODE_TYPES = [
  'dataSource',
  'turbineSensor',
  'temperatureSensor',
  'humiditySensor',
  'energySensor',
  'airQualitySensor',
  'addition',
  'subtraction',
  'multiplication',
  'division',
  'movingAverage',
  'minimum',
  'maximum',
  'thresholdComparison',
  'smsAlert',
  'webhook',
  'dashboardAlert',
  'logEvent',
] as const;

/**
 * Validates a workflow graph structure for structural integrity, valid node/edge schemas,
 * referential integrity, absence of self-loops, absence of duplicate connections,
 * acyclic dependency invariants (DAG), and node connectivity.
 *
 * @param raw - The raw graph object or unknown payload to validate
 * @returns GraphValidationResult containing validity boolean, structured errors, and warnings
 */
export function validateWorkflowGraph(raw: unknown): GraphValidationResult {
  const errors: GraphValidationError[] = [];
  const warnings: string[] = [];
  const warningDetails: GraphValidationWarning[] = [];

  const addWarning = (warning: GraphValidationWarning) => {
    warnings.push(warning.message);
    warningDetails.push(warning);
  };

  // 1. Validate root object
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({
      code: 'EMPTY_GRAPH',
      message: 'Graph definition must be a valid non-null object.',
      severity: 'error',
    });
    return {
      isValid: false,
      errors,
      warnings,
      warningDetails,
      structuredWarnings: warningDetails,
    };
  }

  const g = raw as Record<string, any>;

  // 2. Validate Graph ID
  if (!g.id || typeof g.id !== 'string' || g.id.trim() === '') {
    errors.push({
      code: 'INVALID_ID',
      message: 'Graph must have a non-empty string "id".',
      field: 'id',
      severity: 'error',
    });
  }

  // 3. Validate Graph Name
  if (!g.name || typeof g.name !== 'string' || g.name.trim() === '') {
    errors.push({
      code: 'INVALID_NAME',
      message: 'Graph must have a non-empty string "name".',
      field: 'name',
      severity: 'error',
    });
  }

  // 4. Validate Nodes Array
  if (!Array.isArray(g.nodes)) {
    errors.push({
      code: 'INVALID_NODES',
      message: 'Graph "nodes" must be an array.',
      field: 'nodes',
      severity: 'error',
    });
    if (!Array.isArray(g.edges)) {
      errors.push({
        code: 'INVALID_EDGES',
        message: 'Graph "edges" must be an array.',
        field: 'edges',
        severity: 'error',
      });
    }
    return {
      isValid: false,
      errors,
      warnings,
      warningDetails,
      structuredWarnings: warningDetails,
    };
  }

  if (g.nodes.length === 0) {
    errors.push({
      code: 'NO_NODES',
      message: 'Graph must contain at least one node.',
      field: 'nodes',
      severity: 'error',
    });
  }

  // 5. Validate Individual Nodes & Unique IDs
  const seenNodeIds = new Set<string>();
  const nodeMap = new Map<string, any>();

  for (let i = 0; i < g.nodes.length; i++) {
    const node = g.nodes[i];
    const nodeField = `nodes[${i}]`;

    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push({
        code: 'INVALID_NODE_OBJECT',
        message: `Node at index ${i} is not a valid object.`,
        field: nodeField,
        severity: 'error',
      });
      continue;
    }

    // Node ID
    if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: `Node at index ${i} is missing a valid "id".`,
        field: `${nodeField}.id`,
        severity: 'error',
      });
      continue;
    }

    const nodeId = String(node.id).trim();

    // Unique ID check
    if (seenNodeIds.has(nodeId)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID detected: "${nodeId}". Node IDs must be unique across the graph.`,
        nodeId,
        field: 'nodes',
        severity: 'error',
      });
    } else {
      seenNodeIds.add(nodeId);
      nodeMap.set(nodeId, node);
    }

    // Node Type
    if (!node.type || typeof node.type !== 'string' || node.type.trim() === '') {
      errors.push({
        code: 'INVALID_NODE_TYPE',
        message: `Node "${nodeId}" has an invalid or missing "type".`,
        nodeId,
        field: `${nodeField}.type`,
        severity: 'error',
      });
    } else if (!KNOWN_NODE_TYPES.includes(node.type as any)) {
      addWarning({
        code: 'NON_STANDARD_NODE_TYPE',
        message: `Node "${nodeId}" has custom or non-standard type "${node.type}".`,
        nodeId,
        field: `${nodeField}.type`,
        severity: 'warning',
      });
    }

    // Node Position
    if (
      !node.position ||
      typeof node.position !== 'object' ||
      Array.isArray(node.position) ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number' ||
      isNaN(node.position.x) ||
      isNaN(node.position.y)
    ) {
      errors.push({
        code: 'INVALID_NODE_POSITION',
        message: `Node "${nodeId}" has invalid or missing position coordinates (expected { x: number, y: number }).`,
        nodeId,
        field: `${nodeField}.position`,
        severity: 'error',
      });
    }

    // Node Data Object
    if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) {
      errors.push({
        code: 'INVALID_NODE_DATA',
        message: `Node "${nodeId}" has invalid "data" property (must be a valid object).`,
        nodeId,
        field: `${nodeField}.data`,
        severity: 'error',
      });
    }
  }

  // 6. Validate Edges Array
  if (g.edges === undefined || !Array.isArray(g.edges)) {
    errors.push({
      code: 'INVALID_EDGES',
      message: 'Graph "edges" must be an array.',
      field: 'edges',
      severity: 'error',
    });
    return {
      isValid: false,
      errors,
      warnings,
      warningDetails,
      structuredWarnings: warningDetails,
    };
  }

  const seenEdgeIds = new Set<string>();
  const seenConnections = new Set<string>();
  const adjacencyList = new Map<string, string[]>();

  for (const nodeId of seenNodeIds) {
    adjacencyList.set(nodeId, []);
  }

  // 7. Validate Individual Edges
  for (let i = 0; i < g.edges.length; i++) {
    const edge = g.edges[i];
    const edgeField = `edges[${i}]`;

    if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
      errors.push({
        code: 'INVALID_EDGE_OBJECT',
        message: `Edge at index ${i} is not a valid object.`,
        field: edgeField,
        severity: 'error',
      });
      continue;
    }

    // Edge ID validation
    if (!edge.id || typeof edge.id !== 'string' || edge.id.trim() === '') {
      errors.push({
        code: 'MISSING_EDGE_ID',
        message: `Edge at index ${i} is missing a valid "id".`,
        field: `${edgeField}.id`,
        severity: 'error',
      });
    } else {
      const edgeId = edge.id.trim();
      if (seenEdgeIds.has(edgeId)) {
        errors.push({
          code: 'DUPLICATE_EDGE_ID',
          message: `Duplicate edge ID detected: "${edgeId}". Edge IDs must be unique across the graph.`,
          edgeId,
          field: `${edgeField}.id`,
          severity: 'error',
        });
      } else {
        seenEdgeIds.add(edgeId);
      }
    }

    const currentEdgeId = edge.id ? String(edge.id) : `edges[${i}]`;

    // Edge Source validation
    if (!edge.source || typeof edge.source !== 'string' || edge.source.trim() === '') {
      errors.push({
        code: 'MISSING_EDGE_SOURCE',
        message: `Edge "${currentEdgeId}" is missing a valid "source" node ID.`,
        edgeId: currentEdgeId,
        field: `${edgeField}.source`,
        severity: 'error',
      });
    }

    // Edge Target validation
    if (!edge.target || typeof edge.target !== 'string' || edge.target.trim() === '') {
      errors.push({
        code: 'MISSING_EDGE_TARGET',
        message: `Edge "${currentEdgeId}" is missing a valid "target" node ID.`,
        edgeId: currentEdgeId,
        field: `${edgeField}.target`,
        severity: 'error',
      });
    }

    // Skip referential & connectivity checks if source or target is missing/invalid string
    if (
      !edge.source ||
      typeof edge.source !== 'string' ||
      edge.source.trim() === '' ||
      !edge.target ||
      typeof edge.target !== 'string' ||
      edge.target.trim() === ''
    ) {
      continue;
    }

    const sourceId = edge.source.trim();
    const targetId = edge.target.trim();

    // Referential integrity check (source node exists)
    if (!seenNodeIds.has(sourceId)) {
      errors.push({
        code: 'DANGLING_EDGE_SOURCE',
        message: `Edge "${currentEdgeId}" references non-existent source node "${sourceId}".`,
        edgeId: currentEdgeId,
        nodeId: sourceId,
        field: `${edgeField}.source`,
        severity: 'error',
      });
    }

    // Referential integrity check (target node exists)
    if (!seenNodeIds.has(targetId)) {
      errors.push({
        code: 'DANGLING_EDGE_TARGET',
        message: `Edge "${currentEdgeId}" references non-existent target node "${targetId}".`,
        edgeId: currentEdgeId,
        nodeId: targetId,
        field: `${edgeField}.target`,
        severity: 'error',
      });
    }

    // Self-connection check
    if (sourceId === targetId) {
      errors.push({
        code: 'SELF_REFERENCING_EDGE',
        message: `Edge "${currentEdgeId}" creates a self-loop on node "${sourceId}". Self-connections are not permitted.`,
        edgeId: currentEdgeId,
        nodeId: sourceId,
        field: edgeField,
        severity: 'error',
      });
    }

    // Duplicate connection check
    const connectionKey = `${sourceId}->${targetId}`;
    if (seenConnections.has(connectionKey)) {
      errors.push({
        code: 'DUPLICATE_CONNECTION',
        message: `Duplicate edge connection detected from "${sourceId}" to "${targetId}".`,
        edgeId: currentEdgeId,
        field: edgeField,
        severity: 'error',
      });
      addWarning({
        code: 'DUPLICATE_CONNECTION',
        message: `Duplicate edge connection detected from "${sourceId}" to "${targetId}".`,
        edgeId: currentEdgeId,
        field: edgeField,
        severity: 'warning',
      });
    } else {
      seenConnections.add(connectionKey);
    }

    // Only populate adjacency graph for cycle detection if both endpoints are valid and distinct
    if (seenNodeIds.has(sourceId) && seenNodeIds.has(targetId) && sourceId !== targetId) {
      adjacencyList.get(sourceId)?.push(targetId);
    }
  }

  // 8. Cycle Detection in DAG via Depth-First Search (3-Color State)
  const visitedState = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  for (const nodeId of seenNodeIds) {
    visitedState.set(nodeId, 0);
  }

  const cycleStack: string[] = [];
  let cycleDetected = false;

  const dfsDetectCycle = (nodeId: string): boolean => {
    visitedState.set(nodeId, 1);
    cycleStack.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const state = visitedState.get(neighbor);
      if (state === 1) {
        // Cycle detected
        const cycleStartIndex = cycleStack.indexOf(neighbor);
        const cyclePath = cycleStack.slice(cycleStartIndex).concat(neighbor);
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Cyclic loop detected in graph DAG: ${cyclePath.join(' -> ')}. Reactive pipelines must be acyclic.`,
          field: 'edges',
          severity: 'error',
        });
        cycleDetected = true;
        return true;
      }
      if (state === 0) {
        if (dfsDetectCycle(neighbor)) return true;
      }
    }

    cycleStack.pop();
    visitedState.set(nodeId, 2);
    return false;
  };

  for (const nodeId of seenNodeIds) {
    if (visitedState.get(nodeId) === 0) {
      if (dfsDetectCycle(nodeId)) {
        break; // Stop after first cycle report to avoid duplicate cycle reports
      }
    }
  }

  // 9. Graph Connectivity & Disconnected Nodes (Warnings)
  if (g.nodes.length > 0) {
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();

    for (const nodeId of seenNodeIds) {
      inDegrees.set(nodeId, 0);
      outDegrees.set(nodeId, 0);
    }

    for (const edge of g.edges) {
      if (edge && typeof edge === 'object' && edge.source && edge.target) {
        const s = String(edge.source).trim();
        const t = String(edge.target).trim();
        if (seenNodeIds.has(s) && seenNodeIds.has(t)) {
          outDegrees.set(s, (outDegrees.get(s) || 0) + 1);
          inDegrees.set(t, (inDegrees.get(t) || 0) + 1);
        }
      }
    }

    let rootCount = 0;
    for (const nodeId of seenNodeIds) {
      const inDeg = inDegrees.get(nodeId) || 0;
      const outDeg = outDegrees.get(nodeId) || 0;

      if (inDeg === 0) {
        rootCount++;
      }

      // If graph has multiple nodes and node has neither inputs nor outputs
      if (inDeg === 0 && outDeg === 0 && (g.nodes.length > 1 || g.edges.length > 0)) {
        addWarning({
          code: 'DISCONNECTED_NODE',
          message: `Node "${nodeId}" is disconnected (has no input or output edges).`,
          nodeId,
          field: 'nodes',
          severity: 'warning',
        });
      }
    }

    if (g.nodes.length > 1 && rootCount === 0 && !cycleDetected) {
      addWarning({
        code: 'NO_ROOT_NODES',
        message: 'Graph has no designated root nodes (nodes with 0 incoming edges).',
        severity: 'warning',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    warningDetails,
    structuredWarnings: warningDetails,
  };
}

/**
 * Checks whether a workflow graph passes all structural validation rules.
 *
 * @param raw - The raw graph object or unknown payload
 * @returns true if the graph has zero validation errors, false otherwise
 */
export function isWorkflowGraphValid(raw: unknown): boolean {
  return validateWorkflowGraph(raw).isValid;
}

/**
 * Returns the list of validation errors for a given workflow graph.
 *
 * @param raw - The raw graph object or unknown payload
 * @returns Array of GraphValidationError objects
 */
export function getGraphValidationErrors(raw: unknown): GraphValidationError[] {
  return validateWorkflowGraph(raw).errors;
}

/**
 * Returns the list of validation warning messages for a given workflow graph.
 *
 * @param raw - The raw graph object or unknown payload
 * @returns Array of warning strings
 */
export function getGraphValidationWarnings(raw: unknown): string[] {
  return validateWorkflowGraph(raw).warnings;
}
