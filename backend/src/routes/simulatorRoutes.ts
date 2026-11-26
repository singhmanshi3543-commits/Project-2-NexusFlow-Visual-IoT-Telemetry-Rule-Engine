import { Router, Request, Response } from 'express';
import { simulator } from '../simulator/deviceSimulator.js';

const router = Router();

// GET /api/simulator/status
router.get('/status', (_req: Request, res: Response) => {
  res.json(simulator.getStatus());
});

// POST /api/simulator/start
router.post('/start', (_req: Request, res: Response) => {
  simulator.start();
  res.json({ success: true, message: 'Simulator started', status: simulator.getStatus() });
});

// POST /api/simulator/stop
router.post('/stop', (_req: Request, res: Response) => {
  simulator.stop();
  res.json({ success: true, message: 'Simulator stopped', status: simulator.getStatus() });
});

// POST /api/simulator/pause
router.post('/pause', (_req: Request, res: Response) => {
  simulator.pause();
  res.json({ success: true, message: 'Simulator paused', status: simulator.getStatus() });
});

// POST /api/simulator/resume
router.post('/resume', (_req: Request, res: Response) => {
  simulator.resume();
  res.json({ success: true, message: 'Simulator resumed', status: simulator.getStatus() });
});

// POST /api/simulator/config
router.post('/config', (req: Request, res: Response) => {
  const { interval_seconds, intervalMs, active_device_ids, activeDeviceIds } = req.body;
  if (interval_seconds !== undefined) {
    simulator.setInterval(Number(interval_seconds) * 1000);
  } else if (intervalMs !== undefined) {
    simulator.setInterval(Number(intervalMs));
  }

  const devs = active_device_ids || activeDeviceIds;
  if (Array.isArray(devs)) {
    simulator.setActiveDevices(devs);
  }

  res.json({ success: true, status: simulator.getStatus() });
});

// POST /api/simulator/inject - Anomaly injection
router.post('/inject', async (req: Request, res: Response) => {
  try {
    const { scenario, scenario_id, device_id, deviceId } = req.body;
    const scen = scenario || scenario_id || 'heat_spike';
    const targetDev = device_id || deviceId || 'TURBINE-001';

    const result = await simulator.injectAnomaly(scen, targetDev);
    res.json({ success: true, scenario: scen, deviceId: targetDev, reading: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/simulator/batch
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.body.count || '50', 10);
    const deviceId = req.body.deviceId || req.body.device_id || 'TURBINE-001';
    const inserted = await simulator.generateBatch(count, deviceId);
    res.json({ success: true, insertedCount: inserted });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
