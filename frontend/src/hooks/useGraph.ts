import { useState, useCallback } from 'react';
import { 
  Node, 
  Edge, 
  Connection, 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges, 
  NodeChange, 
  EdgeChange 
} from '@xyflow/react';
import { VisualGraphDefinition } from '../types';

export interface UseGraphOptions {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  graphId?: string;
  graphName?: string;
}

export function useGraph(options: UseGraphOptions = {}) {
  const [nodes, setNodes] = useState<Node[]>(options.initialNodes || []);
  const [edges, setEdges] = useState<Edge[]>(options.initialEdges || []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        animated: true,
        style: { stroke: '#06B6D4', strokeWidth: 2 },
      }, eds));
    },
    []
  );

  // Serialize current React Flow canvas state into backend-ready JSON definition
  const serializeGraph = useCallback((meta?: { id?: string; name?: string; description?: string; isActive?: boolean }): VisualGraphDefinition => {
    return {
      id: meta?.id || options.graphId || 'graph-default',
      name: meta?.name || options.graphName || 'NexusFlow Reactive Pipeline',
      description: meta?.description || 'Visual IoT dynamic telemetry rule stream',
      version: 1,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        animated: edge.animated || false,
      })),
      isActive: meta?.isActive ?? true,
      updatedAt: new Date().toISOString(),
    };
  }, [nodes, edges, options.graphId, options.graphName]);

  // Deserialize backend JSON definition into active React Flow canvas state
  const deserializeGraph = useCallback((graphDef: VisualGraphDefinition) => {
    if (graphDef.nodes) {
      setNodes(graphDef.nodes);
    }
    if (graphDef.edges) {
      setEdges(graphDef.edges);
    }
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    serializeGraph,
    deserializeGraph,
  };
}
