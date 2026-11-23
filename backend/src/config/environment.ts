import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  dbName: process.env.DB_NAME || 'nexusflow',
  jwtSecret: process.env.JWT_SECRET || 'nexusflow-super-secret-key-production-ready-2026-infotact',
  jwtExpiresIn: '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  simulatorIntervalMs: parseInt(process.env.SIMULATOR_INTERVAL_MS || '2000', 10),
};
