import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase, AlertDocument } from '../database/mongo.js';
import { wsHub } from '../websockets/hub.js';

const router = Router();

// GET /api/alerts/stats - Aggregated active alert counts
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const activeTotal = await db.collection('alerts').countDocuments({ status: 'active' });
    const critical = await db.collection('alerts').countDocuments({ status: 'active', severity: 'critical' });
    const warning = await db.collection('alerts').countDocuments({ status: 'active', severity: 'warning' });
    const info = await db.collection('alerts').countDocuments({ status: 'active', severity: 'info' });

    res.json({
      active_total: activeTotal,
      critical,
      warning,
      info,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts - Query alerts with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const query: any = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.severity) query.severity = req.query.severity;
    if (req.query.deviceId || req.query.device_id) {
      query.deviceId = req.query.deviceId || req.query.device_id;
    }

    const limit = parseInt(req.query.limit as string || '100', 10);
    const alerts = await db
      .collection<AlertDocument>('alerts')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const formatted = alerts.map(a => ({
      id: a._id?.toString() || a.id || String(Math.random()),
      rule_id: a.graphId ? 1 : null,
      graphId: a.graphId,
      nodeId: a.nodeId,
      device_id: a.deviceId,
      deviceId: a.deviceId,
      device_name: a.deviceName || a.deviceId,
      parameter: a.parameter,
      observed_value: a.observedValue,
      threshold_value: a.thresholdValue,
      severity: a.severity,
      status: a.status,
      message: a.message,
      acknowledged_at: a.acknowledgedAt?.toISOString() || null,
      resolved_at: a.resolvedAt?.toISOString() || null,
      created_at: a.createdAt?.toISOString ? a.createdAt.toISOString() : a.createdAt,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const id = req.params.id;
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

    await db.collection('alerts').updateOne(filter, {
      $set: { status: 'acknowledged', acknowledgedAt: new Date() },
    });

    wsHub.broadcast('alert:updated', { id, status: 'acknowledged' });
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const id = req.params.id;
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

    await db.collection('alerts').updateOne(filter, {
      $set: { status: 'resolved', resolvedAt: new Date() },
    });

    wsHub.broadcast('alert:updated', { id, status: 'resolved' });
    res.json({ success: true, message: 'Alert marked as resolved' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/alerts/acknowledge-all
router.post('/acknowledge-all', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = await db.collection('alerts').updateMany(
      { status: 'active' },
      { $set: { status: 'acknowledged', acknowledgedAt: new Date() } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/resolve-all
router.post('/resolve-all', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = await db.collection('alerts').updateMany(
      { status: { $in: ['active', 'acknowledged'] } },
      { $set: { status: 'resolved', resolvedAt: new Date() } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
