import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/mongo.js';
import { pipelineManager } from '../compiler/pipelineManager.js';
import { telemetryService } from '../ingestion/telemetryService.js';

const router = Router();

// GET /api/analytics/dashboard-stats
router.get('/dashboard-stats', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const [
      totalDevices,
      onlineDevices,
      activeAlerts,
      criticalAlerts,
      totalTelemetry,
      totalGraphs,
      latestTelemetry,
      recentAlerts,
    ] = await Promise.all([
      db.collection('devices').countDocuments(),
      db.collection('devices').countDocuments({ status: 'online' }),
      db.collection('alerts').countDocuments({ status: 'active' }),
      db.collection('alerts').countDocuments({ status: 'active', severity: 'critical' }),
      db.collection('telemetry').countDocuments(),
      db.collection('graphDefinitions').countDocuments(),
      telemetryService.getLatest(),
      db.collection('alerts').find().sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    const activePipelines = pipelineManager.getAllPipelines();
    const activePipelinesCount = activePipelines.filter(p => p.status === 'active').length;

    res.json({
      total_devices: totalDevices,
      online_devices: onlineDevices,
      offline_devices: Math.max(0, totalDevices - onlineDevices),
      active_alerts: activeAlerts,
      critical_alerts: criticalAlerts,
      total_telemetry_readings: totalTelemetry,
      total_rules: totalGraphs,
      active_rules: activePipelinesCount,
      triggered_rules_24h: activeAlerts,
      latest_telemetry: latestTelemetry,
      recent_alerts: recentAlerts.map(a => ({
        id: a._id?.toString() || a.id,
        rule_id: 1,
        device_id: a.deviceId,
        parameter: a.parameter,
        observed_value: a.observedValue,
        threshold_value: a.thresholdValue,
        severity: a.severity,
        status: a.status,
        message: a.message,
        created_at: a.createdAt?.toISOString ? a.createdAt.toISOString() : a.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/export/csv
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const type = req.query.type || 'telemetry';
    const db = getDatabase();

    if (type === 'alerts') {
      const alerts = await db.collection('alerts').find().sort({ createdAt: -1 }).limit(1000).toArray();
      let csv = 'AlertId,DeviceId,Parameter,ObservedValue,ThresholdValue,Severity,Status,Message,CreatedAt\n';
      for (const a of alerts) {
        csv += `"${a._id}","${a.deviceId}","${a.parameter}",${a.observedValue},${a.thresholdValue},"${a.severity}","${a.status}","${(a.message || '').replace(/"/g, '""')}","${a.createdAt?.toISOString ? a.createdAt.toISOString() : a.createdAt}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="nexusflow_alerts.csv"');
      return res.send(csv);
    } else {
      const telemetry = await db.collection('telemetry').find().sort({ timestamp: -1 }).limit(1000).toArray();
      let csv = 'Timestamp,DeviceId,DeviceType,Location,Temperature,Humidity,Energy,AQI\n';
      for (const t of telemetry) {
        csv += `"${t.timestamp?.toISOString ? t.timestamp.toISOString() : t.timestamp}","${t.metadata?.deviceId}","${t.metadata?.deviceType}","${t.metadata?.location}",${t.measurements?.temperature},${t.measurements?.humidity},${t.measurements?.energy},${t.measurements?.aqi}\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="nexusflow_telemetry.csv"');
      return res.send(csv);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
