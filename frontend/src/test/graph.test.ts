import { describe, it, expect } from 'vitest';
import {
  serializeGraph,
  serializeGraphToObject,
  deserializeGraph,
  tryDeserializeGraph,
  validateWorkflowGraph,
  cloneWorkflowGraph,
} from '../utils/graphSerializer';
import type { WorkflowGraph } from '../types/graph';

describe('Graph JSON Serialization & Validation Suite', () => {
  const sampleGraph: WorkflowGraph = {
    id: 'turbine-monitoring-pipeline',
    name: 'Turbine Thermal Anomaly Rule',
    description: 'Calculates moving average temperature and dispatches SMS alert on threshold violation',
    version: 1,
    isActive: true,
    nodes: [
      {
        id: 'node-sensor-1',
        type: 'temperatureSensor',
        position: { x: 100, y: 150 },
        data: { deviceId: 'TURBINE-001', metric: 'temperature', label: 'Turbine Temp Probe' },
      },
      {
        id: 'node-math-1',
        type: 'movingAverage',
        position: { x: 350, y: 150 },
        data: { windowSize: 5, label: '5-Sample Moving Average' },
      },
      {
        id: 'node-action-1',
        type: 'smsAlert',
        position: { x: 600, y: 150 },
        data: { recipient: '+15550192834', message: 'Thermal threshold exceeded' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-sensor-1',
        target: 'node-math-1',
        animated: true,
      },
      {
        id: 'edge-2',
        source: 'node-math-1',
        target: 'node-action-1',
        animated: true,
      },
    ],
  };

  it('should serialize a workflow graph to a valid JSON string', () => {
    const jsonStr = serializeGraph(sampleGraph);
    expect(typeof jsonStr).toBe('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.id).toBe('turbine-monitoring-pipeline');
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
  });

  it('should round-trip serialize and deserialize without loss of critical attributes', () => {
    const jsonStr = serializeGraph(sampleGraph);
    const restored = deserializeGraph(jsonStr);

    expect(restored.id).toBe(sampleGraph.id);
    expect(restored.name).toBe(sampleGraph.name);
    expect(restored.nodes).toHaveLength(sampleGraph.nodes.length);
    expect(restored.edges).toHaveLength(sampleGraph.edges.length);
    expect(restored.nodes[0].data.deviceId).toBe('TURBINE-001');
  });

  it('should accurately validate graph topology and pass valid pipeline graphs', () => {
    const validation = validateWorkflowGraph(sampleGraph);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should catch invalid node connections targeting non-existent nodes', () => {
    const invalidGraph = {
      ...sampleGraph,
      edges: [
        {
          id: 'invalid-edge',
          source: 'node-sensor-1',
          target: 'ghost-node-999',
        },
      ],
    };
    const validation = validateWorkflowGraph(invalidGraph);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'DANGLING_EDGE_TARGET')).toBe(true);
  });

  it('should safely clone a workflow graph into an independent object', () => {
    const cloned = cloneWorkflowGraph(sampleGraph);
    expect(cloned).not.toBe(sampleGraph);
    expect(cloned.id).toBe(sampleGraph.id);
    cloned.name = 'Modified Pipeline Name';
    expect(sampleGraph.name).toBe('Turbine Thermal Anomaly Rule');
  });
});
