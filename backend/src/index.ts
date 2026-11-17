import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/environment.js';
import { connectDatabase, closeDatabase } from './database/mongo.js';
import { wsHub } from './websockets/hub.js';
import { pipelineManager } from './compiler/pipelineManager.js';
import { simulator } from './simulator/deviceSimulator.js';

// Route imports
import telemetryRoutes from './routes/telemetryRoutes.js';
import graphRoutes from './routes/graphRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import simulatorRoutes from './routes/simulatorRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import smsRoutes from './routes/smsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import rulesRoutes from './routes/rulesRoutes.js';

export const app = express();

app.use(cors({
  origin: '*', // Allow local development clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check Endpoints
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'NexusFlow Reactive Rule Engine',
    version: '2.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: 'MongoDB Native Time-Series',
  });
});

// Mount API routes
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/graphs', graphRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rules', rulesRoutes);

// Mock Webhook Receiver endpoint
app.post('/api/mock-webhook-receiver', (req, res) => {
  console.log('[Mock Webhook Target] Successfully received payload:', req.body);
  res.json({ received: true, timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

const server = http.createServer(app);

// Initialize WebSocket Hub
wsHub.init(server);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    await pipelineManager.loadFromDatabase();

    // Start IoT Simulator automatically in background
    simulator.start();

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`===================================================================`);
      console.log(`⚡ NexusFlow Reactive Engine & Ingestion API running on port ${config.port}`);
      console.log(`📡 WebSocket Hub available on ws://127.0.0.1:${config.port}`);
      console.log(`🍃 Native MongoDB Time-Series collection active`);
      console.log(`🔀 RxJS Stream Compiler ready`);
      console.log(`===================================================================`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down NexusFlow engine gracefully...`);
  simulator.stop();
  pipelineManager.shutdown();
  await closeDatabase();
  server.close(() => {
    console.log('NexusFlow HTTP & WebSocket server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Only start when run directly (not in unit tests)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
