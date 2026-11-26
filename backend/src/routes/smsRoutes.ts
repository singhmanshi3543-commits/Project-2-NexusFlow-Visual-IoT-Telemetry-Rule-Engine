import { Router, Request, Response } from 'express';
import { smsService } from '../alerts/smsService.js';

const router = Router();

// GET /api/sms/history
router.get('/history', (_req: Request, res: Response) => {
  res.json(smsService.getHistory());
});

// POST /api/sms/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { recipient, deviceId, message, value, threshold } = req.body;
    const result = await smsService.sendAlertSms({
      recipient,
      deviceId: deviceId || 'TURBINE-001',
      parameter: 'Manual Test Trigger',
      value: Number(value || 99),
      threshold: Number(threshold || 80),
      message,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
