import { Router, Request, Response } from 'express';
import { telemetryService } from '../ingestion/telemetryService.js';

const router = Router();

// POST /api/telemetry/ingest - Accept single telemetry reading
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const doc = await telemetryService.ingestSingle(req.body);
    res.status(201).json({
      success: true,
      message: 'Telemetry reading accepted and dispatched to active pipelines',
      reading: doc,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Alias for backwards compatibility: POST /api/telemetry
router.post('/', async (req: Request, res: Response) => {
  try {
    const doc = await telemetryService.ingestSingle(req.body);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

// POST /api/telemetry/batch - Accept high-velocity batch
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.readings || req.body.items;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Expected an array of telemetry items' });
    }
    const result = await telemetryService.ingestBatch(items);
    res.status(201).json({
      success: true,
      insertedCount: result.insertedCount,
      message: `Successfully ingested batch of ${result.insertedCount} readings`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/telemetry/latest - Most recent reading per device or specific device
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined || req.query.device_id as string | undefined;
    const latest = await telemetryService.getLatest(deviceId);
    res.json(latest);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/telemetry/history - Historical queries with filters
router.get('/history', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined || req.query.device_id as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);
    const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;

    const history = await telemetryService.getHistory(deviceId, limit, startTime, endTime);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Backwards-compatible alias: GET /api/telemetry
router.get('/', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined || req.query.device_id as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);
    const history = await telemetryService.getHistory(deviceId, limit);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/telemetry/stats - Aggregate statistical distributions
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await telemetryService.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
