import { Router, Request, Response } from 'express';
import { getDatabase, GraphDefinitionDocument } from '../database/mongo.js';
import { pipelineManager } from '../compiler/pipelineManager.js';

const router = Router();

// GET /api/rules - Maps active graph pipelines to rule objects for UI compatibility
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const graphs = await db.collection<GraphDefinitionDocument>('graphDefinitions').find().toArray();

    const rules = graphs.map((g, idx) => ({
      id: idx + 1,
      name: g.name,
      description: g.description,
      device_id: null,
      parameter: 'temperature',
      operator: '>',
      threshold: 50,
      severity: 'critical',
      action_payload: 'visual_pipeline',
      is_active: g.isActive,
      cooldown_seconds: 30,
      last_triggered: null,
      created_at: g.createdAt?.toISOString ? g.createdAt.toISOString() : g.createdAt,
    }));

    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rules/logs - Returns execution logs
router.get('/logs', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const logs = await db.collection('executionLogs').find().sort({ timestamp: -1 }).limit(50).toArray();

    const formatted = logs.map((l, idx) => ({
      id: idx + 1,
      rule_id: 1,
      rule_name: l.graphId,
      device_id: l.deviceId || 'TURBINE-001',
      device_name: l.deviceId || 'Turbine Multi-Sensor',
      condition_met: l.status === 'success' || l.status === 'alert_triggered',
      observed_value: typeof l.observedValue === 'number' ? l.observedValue : 0,
      details: l.details || `Node ${l.nodeId} execution: ${l.status}`,
      evaluated_at: l.timestamp?.toISOString ? l.timestamp.toISOString() : l.timestamp,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
