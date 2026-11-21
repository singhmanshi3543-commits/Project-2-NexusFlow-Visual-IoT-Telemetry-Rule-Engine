import { describe, it, expect } from 'vitest';
import { validateGraph, GraphDefinition } from '../compiler/graphValidator.js';
import { resolveDependencyOrder } from '../compiler/dependencyResolver.js';
import { compileGraph } from '../compiler/graphCompiler.js';
import { webhookService } from '../webhooks/webhookService.js';
import { smsService } from '../alerts/smsService.js';

describe('Graph Validator', () => {
  it('should validate a correct linear pipeline', () => {
    const graph: GraphDefinition = {
      id: 'test-graph-1',
      nodes: [
        { id: 'src-1', type: 'temperatureSensor', data: { deviceId: 'TEMP-001', metric: 'temperature' } },
        { id: 'math-1', type: 'movingAverage', data: { windowSize: 3 } },
        { id: 'thresh-1', type: 'thresholdComparison', data: { operator: '>', threshold: 50 } },
        { id: 'act-1', type: 'smsAlert', data: { recipient: '+15550001', cooldownSeconds: 10 } },
      ],
      edges: [
        { source: 'src-1', target: 'math-1' },
        { source: 'math-1', target: 'thresh-1' },
        { source: 'thresh-1', target: 'act-1' },
      ],
    };

    const res = validateGraph(graph);
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.sourceNodeIds).toContain('src-1');
  });

  it('should reject a cyclic graph', () => {
    const cyclicGraph: GraphDefinition = {
      id: 'cycle-graph',
      nodes: [
        { id: 'src-1', type: 'temperatureSensor', data: { deviceId: 'TEMP-001', metric: 'temperature' } },
        { id: 'node-A', type: 'addition', data: { operand: 5 } },
        { id: 'node-B', type: 'subtraction', data: { operand: 2 } },
      ],
      edges: [
        { source: 'src-1', target: 'node-A' },
        { source: 'node-A', target: 'node-B' },
        { source: 'node-B', target: 'node-A' }, // Cycle!
      ],
    };

    const res = validateGraph(cyclicGraph);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('Cyclic loop detected'))).toBe(true);
  });

  it('should reject non-allowlisted node types', () => {
    const maliciousGraph: GraphDefinition = {
      id: 'eval-hack',
      nodes: [
        { id: 'src-1', type: 'arbitraryCodeExecNode', data: { code: 'process.exit(1)' } },
      ],
      edges: [],
    };

    const res = validateGraph(maliciousGraph);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('not in the allowlist'))).toBe(true);
  });
});

describe('Dependency Resolver (Topological Sort)', () => {
  it('should resolve dependencies in topological execution order', () => {
    const graph: GraphDefinition = {
      nodes: [
        { id: 'act-1', type: 'smsAlert', data: {} },
        { id: 'src-1', type: 'dataSource', data: { deviceId: 'TURBINE-001', metric: 'temperature' } },
        { id: 'math-1', type: 'addition', data: { operand: 10 } },
      ],
      edges: [
        { source: 'src-1', target: 'math-1' },
        { source: 'math-1', target: 'act-1' },
      ],
    };

    const { sortedNodeIds } = resolveDependencyOrder(graph);
    expect(sortedNodeIds.indexOf('src-1')).toBeLessThan(sortedNodeIds.indexOf('math-1'));
    expect(sortedNodeIds.indexOf('math-1')).toBeLessThan(sortedNodeIds.indexOf('act-1'));
  });
});

describe('RxJS Stream Compiler Execution', () => {
  it('should compile graph and compute moving average and trigger threshold', async () => {
    const graph: GraphDefinition = {
      id: 'stream-test',
      name: 'Turbine Thermal Safety Pipeline',
      nodes: [
        { id: 'source', type: 'turbineSensor', data: { deviceId: 'TURBINE-001', metric: 'temperature' } },
        { id: 'avg', type: 'movingAverage', data: { windowSize: 2 } },
        { id: 'eval', type: 'thresholdComparison', data: { operator: '>', threshold: 70 } },
      ],
      edges: [
        { source: 'source', target: 'avg' },
        { source: 'avg', target: 'eval' },
      ],
    };

    const compiled = compileGraph(graph);
    expect(compiled.status).toBe('active');

    // Feed 1st reading (60°C) -> avg = 60, does not meet > 70
    compiled.push({
      timestamp: new Date(),
      metadata: { deviceId: 'TURBINE-001', deviceType: 'industrial', location: 'Bay 1' },
      measurements: { temperature: 60, humidity: 50, energy: 40, aqi: 20 },
    });

    // Feed 2nd reading (90°C) -> avg = (60+90)/2 = 75°C, meets > 70!
    compiled.push({
      timestamp: new Date(),
      metadata: { deviceId: 'TURBINE-001', deviceType: 'industrial', location: 'Bay 1' },
      measurements: { temperature: 90, humidity: 50, energy: 40, aqi: 20 },
    });

    // Give microtask tick to process
    await new Promise(r => setTimeout(r, 50));

    expect(compiled.stats.processedCount).toBeGreaterThanOrEqual(1);
    expect(compiled.stats.matchedCount).toBeGreaterThanOrEqual(1);

    compiled.destroy();
  });
});

describe('SSRF Protection & Mock Integrations', () => {
  it('should block SSRF attempts to cloud metadata endpoints', async () => {
    const res = await webhookService.dispatch({
      url: 'http://169.254.169.254/latest/meta-data/',
      payload: { leak: true },
    });

    expect(res.status).toBe('REJECTED_SSRF');
  });

  it('should deliver mock SMS and record audit trace', async () => {
    const res = await smsService.sendAlertSms({
      deviceId: 'TURBINE-001',
      parameter: 'temperature',
      value: 95.5,
      threshold: 80,
    });

    expect(res.status).toBe('DELIVERED');
    expect(res.value).toBe(95.5);
    expect(smsService.getHistory().length).toBeGreaterThan(0);
  });
});
