import { Router, Request, Response } from 'express';
import { webhookService } from '../webhooks/webhookService.js';

const router = Router();

// GET /api/webhooks/history
router.get('/history', (_req: Request, res: Response) => {
  res.json(webhookService.getHistory());
});

// POST /api/webhooks/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { url, payload, headers, retries, timeoutMs } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const result = await webhookService.dispatch({
      url,
      payload: payload || { test: true, timestamp: new Date().toISOString() },
      headers,
      retries,
      timeoutMs,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Local safe endpoint for mock webhook receiver
router.post('/receiver', (req: Request, res: Response) => {
  console.log('[Mock Webhook Receiver] Received payload:', req.body);
  res.json({ status: 'ACKNOWLEDGED', receivedAt: new Date().toISOString(), body: req.body });
});

export default router;
