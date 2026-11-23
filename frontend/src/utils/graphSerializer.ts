import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  SerializedWorkflowGraph,
  SerializedWorkflowNode,
  SerializedWorkflowEdge,
  SerializationOptions,
  GraphValidationError,
  GraphValidationResult,
  DeserializationResult,
  WorkflowGraphMetadata,
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
 * Custom error thrown when workflow graph serialization or deserialization fails
 */
export class GraphSerializationError extends Error {
  public readonly errors: GraphValidationError[];

  constructor(message: string, errors: GraphValidationError[] = []) {
    super(message);
    this.name = 'GraphSerializationError';
    this.errors = errors;
    Object.setPrototypeOf(this, GraphSerializationError.prototype);
  }
}

/**
 * Validates a workflow graph structure for data integrity, valid connections, and absence of cycles.
 */
export function validateWorkflowGraph(raw: unknown): GraphValidationResult {
  const errors: GraphValidationError[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: [{ code: 'EMPTY_GRAPH', message: 'Graph definition must be a valid non-null object.' }],
      warnings: [],
    };
  }

  const g = raw as Record<string, any>;

  // 1. Validate ID
  if (!g.id || typeof g.id !== 'string' || g.id.trim() === '') {
    errors.push({ code: 'INVALID_ID', message: 'Graph must have a non-empty string "id".', field: 'id' });
  }

  // 2. Validate Name
  if (!g.name || typeof g.name !== 'string' || g.name.trim() === '') {
    errors.push({ code: 'INVALID_NAME', message: 'Graph must have a non-empty string "name".', field: 'name' });
  }

  // 3. Validate Nodes Array
  if (!Array.isArray(g.nodes)) {
    errors.push({ code: 'INVALID_NODES', message: 'Graph "nodes" must be an array.', field: 'nodes' });
    return { isValid: false, errors, warnings };
  }

  if (g.nodes.length === 0) {
    errors.push({ code: 'NO_NODES', message: 'Graph must contain at least one node.', field: 'nodes' });
  }

  const nodeMap = new Map<string, any>();
  const seenNodeIds = new Set<string>();

  for (let i = 0; i < g.nodes.length; i++) {
    const node = g.nodes[i];
    if (!node || typeof node !== 'object') {
      errors.push({
        code: 'INVALID_NODE_OBJECT',
        message: `Node at index ${i} is not a valid object.`,
        field: `nodes[${i}]`,
      });
      continue;
    }

    if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: `Node at index ${i} is missing a valid "id".`,
        field: `nodes[${i}].id`,
      });
      continue;
    }

    if (seenNodeIds.has(node.id)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID detected: "${node.id}". Node IDs must be unique across the graph.`,
        nodeId: node.id,
        field: 'nodes',
      });
    } else {
      seenNodeIds.add(node.id);
      nodeMap.set(node.id, node);
    }

    if (!node.type || typeof node.type !== 'string') {
      errors.push({
        code: 'INVALID_NODE_TYPE',
        message: `Node "${node.id}" has an invalid or missing "type".`,
        nodeId: node.id,
        field: `nodes[${i}].type`,
      });
    } else if (!KNOWN_NODE_TYPES.includes(node.type as any)) {
      warnings.push(`Node "${node.id}" has custom or non-standard type "${node.type}".`);
    }

    if (
      !node.position ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number' ||
      isNaN(node.position.x) ||
      isNaN(node.position.y)
    ) {
      warnings.push(`Node "${node.id}" has invalid or missing position coordinates; defaulting to { x: 0, y: 0 }.`);
    }

    if (node.data && typeof node.data !== 'object') {
      errors.push({
        code: 'INVALID_NODE_DATA',
        message: `Node "${node.id}" has invalid "data" property (must be an object).`,
        nodeId: node.id,
        field: `nodes[${i}].data`,
      });
    }
  }

  // 4. Validate Edges Array
  if (!Array.isArray(g.edges)) {
    errors.push({ code: 'INVALID_EDGES', message: 'Graph "edges" must be an array.', field: 'edges' });
    return { isValid: errors.length === 0, errors, warnings };
  }

  const seenEdgeIds = new Set<string>();
  const seenConnections = new Set<string>();
  const adjacencyList = new Map<string, string[]>();

  for (const nodeId of seenNodeIds) {
    adjacencyList.set(nodeId, []);
  }

  for (let i = 0; i < g.edges.length; i++) {
    const edge = g.edges[i];
    if (!edge || typeof edge !== 'object') {
      errors.push({
        code: 'INVALID_EDGE_OBJECT',
        message: `Edge at index ${i} is not a valid object.`,
        field: `edges[${i}]`,
      });
      continue;
    }

    const edgeId = edge.id ? String(edge.id) : `edge-idx-${i}`;

    if (edge.id) {
      if (seenEdgeIds.has(edgeId)) {
        warnings.push(`Duplicate edge ID detected: "${edgeId}".`);
      } else {
        seenEdgeIds.add(edgeId);
      }
    }

    if (!edge.source || typeof edge.source !== 'string') {
      errors.push({
        code: 'MISSING_EDGE_SOURCE',
        message: `Edge "${edgeId}" is missing a valid "source" node ID.`,
        edgeId,
        field: `edges[${i}].source`,
      });
      continue;
    }

    if (!edge.target || typeof edge.target !== 'string') {
      errors.push({
        code: 'MISSING_EDGE_TARGET',
        message: `Edge "${edgeId}" is missing a valid "target" node ID.`,
        edgeId,
        field: `edges[${i}].target`,
      });
      continue;
    }

    // Referential integrity check
    if (!seenNodeIds.has(edge.source)) {
      errors.push({
        code: 'DANGLING_EDGE_SOURCE',
        message: `Edge "${edgeId}" references non-existent source node "${edge.source}".`,
        edgeId,
        nodeId: edge.source,
        field: `edges[${i}].source`,
      });
    }

    if (!seenNodeIds.has(edge.target)) {
      errors.push({
        code: 'DANGLING_EDGE_TARGET',
        message: `Edge "${edgeId}" references non-existent target node "${edge.target}".`,
        edgeId,
        nodeId: edge.target,
        field: `edges[${i}].target`,
      });
    }

    // Self-loop check
    if (edge.source === edge.target) {
      errors.push({
        code: 'SELF_REFERENCING_EDGE',
        message: `Edge "${edgeId}" creates a self-loop on node "${edge.source}". Self-referencing connections are not permitted.`,
        edgeId,
        nodeId: edge.source,
        field: `edges[${i}]`,
      });
    }

    // Duplicate connection check
    const connectionKey = `${edge.source}->${edge.target}`;
    if (seenConnections.has(connectionKey)) {
      warnings.push(`Duplicate edge connection detected from "${edge.source}" to "${edge.target}".`);
    } else {
      seenConnections.add(connectionKey);
    }

    if (seenNodeIds.has(edge.source) && seenNodeIds.has(edge.target)) {
      adjacencyList.get(edge.source)?.push(edge.target);
    }
  }

  // 5. Cycle Detection in DAG via Depth-First Search
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
        // Cycle found
        const cycleStartIndex = cycleStack.indexOf(neighbor);
        const cyclePath = cycleStack.slice(cycleStartIndex).concat(neighbor);
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Cyclic loop detected in graph DAG: ${cyclePath.join(' -> ')}. Reactive pipelines must be acyclic.`,
          field: 'edges',
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
        break; // Stop after first cycle report to avoid duplicate spam
      }
    }
  }

  // 6. Graph Connectivity Warnings
  if (g.nodes.length > 1) {
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();

    for (const nodeId of seenNodeIds) {
      inDegrees.set(nodeId, 0);
      outDegrees.set(nodeId, 0);
    }

    for (const edge of g.edges) {
      if (seenNodeIds.has(edge.source) && seenNodeIds.has(edge.target)) {
        outDegrees.set(edge.source, (outDegrees.get(edge.source) || 0) + 1);
        inDegrees.set(edge.target, (inDegrees.get(edge.target) || 0) + 1);
      }
    }

    let rootCount = 0;
    for (const nodeId of seenNodeIds) {
      const inDeg = inDegrees.get(nodeId) || 0;
      const outDeg = outDegrees.get(nodeId) || 0;

      if (inDeg === 0) {
        rootCount++;
      }

      if (inDeg === 0 && outDeg === 0) {
        warnings.push(`Node "${nodeId}" is disconnected (has no input or output edges).`);
      }
    }

    if (rootCount === 0 && !cycleDetected) {
      warnings.push('Graph has no designated root nodes (nodes with 0 incoming edges).');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Converts a live WorkflowGraph into a clean, normalized SerializedWorkflowGraph object.
 * Preserves all node IDs, custom node data, positions, edge IDs, and edge connections.
 */
export function serializeGraphToObject(
  graph: WorkflowGraph,
  options: SerializationOptions = {}
): SerializedWorkflowGraph {
  if (!graph || typeof graph !== 'object') {
    throw new GraphSerializationError('Cannot serialize null or invalid graph object.');
  }

  const stripRuntimeState = options.stripRuntimeState !== false;
  const includeMetadata = options.includeMetadata !== false;
  const schemaVersion = options.schemaVersion || '2.0.0';

  // 1. Serialize and preserve nodes
  const serializedNodes: SerializedWorkflowNode[] = (graph.nodes || []).map((node) => {
    const rawData = node.data || {};
    let cleanData: WorkflowNodeData;

    if (stripRuntimeState) {
      // Omit volatile websocket glow / execution timestamps
      const { lastExecution: _, ...rest } = rawData as any;
      cleanData = JSON.parse(JSON.stringify(rest));
    } else {
      cleanData = JSON.parse(JSON.stringify(rawData));
    }

    return {
      id: String(node.id),
      type: String(node.type || 'dataSource'),
      position: {
        x: typeof node.position?.x === 'number' && !isNaN(node.position.x) ? node.position.x : 0,
        y: typeof node.position?.y === 'number' && !isNaN(node.position.y) ? node.position.y : 0,
      },
      data: cleanData,
    };
  });

  // 2. Serialize and preserve edges
  const serializedEdges: SerializedWorkflowEdge[] = (graph.edges || []).map((edge, index) => ({
    id: edge.id || `e_${edge.source}_${edge.target}_${index}`,
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    animated: edge.animated !== false,
    className: edge.className || 'animated-flow-edge',
    style: edge.style ? JSON.parse(JSON.stringify(edge.style)) : undefined,
    label: edge.label,
  }));

  // 3. Metadata preservation & enrichment
  const metadata: WorkflowGraphMetadata | undefined = includeMetadata
    ? {
        author: graph.metadata?.author,
        description: graph.description || graph.metadata?.description || '',
        tags: Array.isArray(graph.metadata?.tags) ? [...graph.metadata.tags] : [],
        category: graph.metadata?.category || 'iot-telemetry-pipeline',
        targetDevices: Array.isArray(graph.metadata?.targetDevices) ? [...graph.metadata.targetDevices] : [],
        createdAt: graph.createdAt || graph.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: typeof graph.version === 'number' ? graph.version : (graph.metadata?.version || 1),
        executionStats: graph.metadata?.executionStats ? { ...graph.metadata.executionStats } : undefined,
        customProperties: graph.metadata?.customProperties ? { ...graph.metadata.customProperties } : undefined,
      }
    : undefined;

  return {
    format: 'nexusflow-workflow',
    schemaVersion,
    id: String(graph.id || `graph-${Date.now()}`),
    name: String(graph.name || 'Untitled Visual Pipeline'),
    description: String(graph.description || ''),
    version: typeof graph.version === 'number' ? graph.version : 1,
    isActive: Boolean(graph.isActive),
    nodes: serializedNodes,
    edges: serializedEdges,
    metadata,
    viewport: graph.viewport ? { ...graph.viewport } : undefined,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Serializes a workflow graph into a formatted JSON string.
 */
export function serializeGraph(
  graph: WorkflowGraph,
  options: SerializationOptions = {}
): string {
  const serializedObject = serializeGraphToObject(graph, options);
  const pretty = options.pretty !== false;
  const indent = options.indent ?? 2;
  return JSON.stringify(serializedObject, null, pretty ? indent : undefined);
}

/**
 * Reconstructs a full WorkflowGraph from a JSON string or raw parsed object.
 * Validates integrity, handles backward-compatibility with plain VisualGraphDefinition,
 * and preserves all IDs, node configurations, coordinates, and edge wires.
 *
 * @throws {GraphSerializationError} if the input is corrupt or fails validation.
 */
export function deserializeGraph(
  input: string | unknown,
  options: { sanitize?: boolean } = { sanitize: true }
): WorkflowGraph {
  let rawObj: any;

  // Step 1: Parse JSON if string
  if (typeof input === 'string') {
    try {
      rawObj = JSON.parse(input);
    } catch (parseErr: any) {
      throw new GraphSerializationError(`Failed to parse graph JSON: ${parseErr.message}`, [
        { code: 'JSON_PARSE_ERROR', message: parseErr.message },
      ]);
    }
  } else if (input && typeof input === 'object') {
    rawObj = JSON.parse(JSON.stringify(input));
  } else {
    throw new GraphSerializationError('Invalid graph input: Expected a JSON string or an object.');
  }

  // Step 2: Validate the graph structure
  const validation = validateWorkflowGraph(rawObj);
  if (!validation.isValid && !options.sanitize) {
    throw new GraphSerializationError(
      `Graph validation failed: ${validation.errors.map((e) => e.message).join(' | ')}`,
      validation.errors
    );
  }

  // If there are critical errors that cannot be sanitized (dangling edges, cycles, duplicate node IDs)
  const fatalErrors = validation.errors.filter(
    (e) =>
      e.code === 'DANGLING_EDGE_SOURCE' ||
      e.code === 'DANGLING_EDGE_TARGET' ||
      e.code === 'CYCLE_DETECTED' ||
      e.code === 'DUPLICATE_NODE_ID' ||
      e.code === 'NO_NODES' ||
      e.code === 'INVALID_NODES'
  );

  if (fatalErrors.length > 0) {
    throw new GraphSerializationError(
      `Graph contains critical structural errors: ${fatalErrors.map((e) => e.message).join(' | ')}`,
      fatalErrors
    );
  }

  // Step 3: Reconstruct Nodes with full data and position preservation
  const rawNodes: any[] = Array.isArray(rawObj.nodes) ? rawObj.nodes : [];
  const reconstructedNodes: WorkflowNode[] = rawNodes.map((n: any, idx: number) => {
    const nodeId = n.id ? String(n.id) : `node-${Date.now()}-${idx}`;
    const nodeType = n.type ? String(n.type) : 'dataSource';
    const posX = typeof n.position?.x === 'number' && !isNaN(n.position.x) ? n.position.x : 0;
    const posY = typeof n.position?.y === 'number' && !isNaN(n.position.y) ? n.position.y : 0;
    const nodeData: WorkflowNodeData = n.data && typeof n.data === 'object' ? { ...n.data } : {};

    return {
      id: nodeId,
      type: nodeType,
      position: { x: posX, y: posY },
      data: nodeData,
      selected: Boolean(n.selected),
      dragging: Boolean(n.dragging),
    };
  });

  // Step 4: Reconstruct Edges with connection preservation
  const rawEdges: any[] = Array.isArray(rawObj.edges) ? rawObj.edges : [];
  const reconstructedEdges: WorkflowEdge[] = rawEdges.map((e: any, idx: number) => {
    const edgeId = e.id ? String(e.id) : `e_${e.source}_${e.target}_${idx}`;
    return {
      id: edgeId,
      source: String(e.source),
      target: String(e.target),
      sourceHandle: e.sourceHandle !== undefined ? e.sourceHandle : null,
      targetHandle: e.targetHandle !== undefined ? e.targetHandle : null,
      animated: e.animated !== undefined ? Boolean(e.animated) : true,
      className: e.className || 'animated-flow-edge',
      style: e.style && typeof e.style === 'object' ? { ...e.style } : undefined,
      label: e.label ? String(e.label) : undefined,
    };
  });

  // Step 5: Reconstruct Graph Metadata
  const metadata: WorkflowGraphMetadata = {
    author: rawObj.metadata?.author,
    description: rawObj.metadata?.description || rawObj.description || '',
    tags: Array.isArray(rawObj.metadata?.tags) ? [...rawObj.metadata.tags] : [],
    category: rawObj.metadata?.category || 'iot-telemetry-pipeline',
    targetDevices: Array.isArray(rawObj.metadata?.targetDevices) ? [...rawObj.metadata.targetDevices] : [],
    createdAt: rawObj.createdAt || rawObj.metadata?.createdAt || new Date().toISOString(),
    updatedAt: rawObj.updatedAt || new Date().toISOString(),
    version: typeof rawObj.version === 'number' ? rawObj.version : (rawObj.metadata?.version || 1),
    executionStats: rawObj.metadata?.executionStats ? { ...rawObj.metadata.executionStats } : undefined,
    customProperties: rawObj.metadata?.customProperties ? { ...rawObj.metadata.customProperties } : undefined,
  };

  const graph: WorkflowGraph = {
    id: String(rawObj.id || `graph-${Date.now()}`),
    name: String(rawObj.name || 'Untitled Visual Pipeline'),
    description: String(rawObj.description || metadata.description || ''),
    version: typeof rawObj.version === 'number' ? rawObj.version : 1,
    isActive: typeof rawObj.isActive === 'boolean' ? rawObj.isActive : false,
    nodes: reconstructedNodes,
    edges: reconstructedEdges,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    metadata,
    viewport: rawObj.viewport
      ? {
          x: Number(rawObj.viewport.x) || 0,
          y: Number(rawObj.viewport.y) || 0,
          zoom: Number(rawObj.viewport.zoom) || 1,
        }
      : undefined,
  };

  return graph;
}

/**
 * Non-throwing safe deserializer that returns an outcome result with errors and warnings.
 */
export function tryDeserializeGraph(
  input: string | unknown,
  options: { sanitize?: boolean } = { sanitize: true }
): DeserializationResult {
  try {
    const graph = deserializeGraph(input, options);
    const validation = validateWorkflowGraph(graph);
    return {
      success: true,
      graph,
      warnings: validation.warnings,
    };
  } catch (err: any) {
    if (err instanceof GraphSerializationError) {
      return {
        success: false,
        errors: err.errors.length > 0 ? err.errors : [{ code: 'DESERIALIZATION_FAILED', message: err.message }],
      };
    }
    return {
      success: false,
      errors: [{ code: 'DESERIALIZATION_FAILED', message: err?.message || 'Unknown deserialization error' }],
    };
  }
}

/**
 * Creates an exact, deep-cloned copy of a workflow graph.
 */
export function cloneWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  const serialized = serializeGraphToObject(graph, { stripRuntimeState: false });
  return deserializeGraph(serialized);
}

/**
 * Downloads a workflow graph definition as a JSON file in browser environments.
 */
export function exportGraphToJsonFile(
  graph: WorkflowGraph,
  filename?: string,
  options?: SerializationOptions
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const jsonString = serializeGraph(graph, options);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename || `${graph.id || 'workflow-graph'}.nexusflow.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Reads a JSON file uploaded by the user and deserializes it into a WorkflowGraph.
 */
export function importGraphFromJsonFile(file: File): Promise<WorkflowGraph> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader API is not supported in this runtime environment.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const graph = deserializeGraph(text);
        resolve(graph);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(
        new Error(`Failed to read file "${file.name}": ${reader.error?.message || 'Unknown read failure'}`)
      );
    };
    reader.readAsText(file);
  });
}
