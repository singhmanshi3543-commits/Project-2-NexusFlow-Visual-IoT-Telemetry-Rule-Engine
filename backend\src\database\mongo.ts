import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config/environment.js';
import bcrypt from 'bcryptjs';

let client: MongoClient | null = null;
let db: Db | null = null;

export interface TelemetryDocument {
  timestamp: Date;
  metadata: {
    deviceId: string;
    deviceType: string;
    location: string;
  };
  measurements: {
    temperature: number;
    humidity: number;
    energy: number;
    aqi: number;
  };
}

export interface DeviceDocument {
  deviceId: string;
  name: string;
  type: 'temperature' | 'humidity' | 'energy' | 'air_quality' | 'industrial' | 'multisensor';
  location: string;
  description: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen: Date | null;
  createdAt: Date;
}

export interface GraphDefinitionDocument {
  id: string; // client/custom id or uuid
  name: string;
  description: string;
  version: number;
  nodes: any[];
  edges: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertDocument {
  id?: string;
  graphId: string | null;
  nodeId: string | null;
  deviceId: string;
  deviceName?: string;
  parameter: string;
  observedValue: number;
  thresholdValue: number;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt: Date;
}

export interface WebhookConfigDocument {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  isActive: boolean;
  retryCount: number;
  createdAt: Date;
}

export interface ExecutionLogDocument {
  graphId: string;
  nodeId: string;
  deviceId?: string;
  status: 'success' | 'filtered' | 'alert_triggered' | 'error';
  observedValue?: any;
  details?: string;
  latencyMs: number;
  timestamp: Date;
}

export async function connectDatabase(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.mongoUri);
  await client.connect();
  console.log(`[MongoDB] Connected successfully to ${config.mongoUri}`);
  db = client.db(config.dbName);

  await initializeCollections(db);
  return db;
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed.');
  }
}

async function initializeCollections(database: Db): Promise<void> {
  const collections = await database.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  // 1. Native MongoDB Time-Series Collection: telemetry
  if (!collectionNames.includes('telemetry')) {
    console.log('[MongoDB] Creating native Time-Series collection: telemetry');
    await database.createCollection('telemetry', {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds',
      },
    });
  }

  // Indexing for high-speed queries
  const telemetryCol = database.collection<TelemetryDocument>('telemetry');
  await telemetryCol.createIndex({ 'metadata.deviceId': 1, timestamp: -1 });

  // 2. Collection: devices
  if (!collectionNames.includes('devices')) {
    await database.createCollection('devices');
  }
  const devicesCol = database.collection<DeviceDocument>('devices');
  await devicesCol.createIndex({ deviceId: 1 }, { unique: true });

  // 3. Collection: graphDefinitions
  if (!collectionNames.includes('graphDefinitions')) {
    await database.createCollection('graphDefinitions');
  }
  const graphsCol = database.collection<GraphDefinitionDocument>('graphDefinitions');
  await graphsCol.createIndex({ id: 1 }, { unique: true });

  // 4. Collection: alerts
  if (!collectionNames.includes('alerts')) {
    await database.createCollection('alerts');
  }
  const alertsCol = database.collection<AlertDocument>('alerts');
  await alertsCol.createIndex({ status: 1, createdAt: -1 });
  await alertsCol.createIndex({ deviceId: 1 });

  // 5. Collection: webhookConfigurations
  if (!collectionNames.includes('webhookConfigurations')) {
    await database.createCollection('webhookConfigurations');
  }

  // 6. Collection: executionLogs
  if (!collectionNames.includes('executionLogs')) {
    await database.createCollection('executionLogs');
  }
  const logsCol = database.collection<ExecutionLogDocument>('executionLogs');
  await logsCol.createIndex({ timestamp: -1 });
  await logsCol.createIndex({ graphId: 1, nodeId: 1 });

  // 7. Collection: users
  if (!collectionNames.includes('users')) {
    await database.createCollection('users');
  }
  const usersCol = database.collection('users');
  await usersCol.createIndex({ email: 1 }, { unique: true });

  // Seed default data
  await seedInitialData(database);
}

async function seedInitialData(database: Db): Promise<void> {
  const devicesCol = database.collection<DeviceDocument>('devices');
  const count = await devicesCol.countDocuments();
  if (count === 0) {
    console.log('[MongoDB] Seeding initial industrial IoT devices...');
    const initialDevices: DeviceDocument[] = [
      {
        deviceId: 'TURBINE-001',
        name: 'Main Wind Turbine Alpha',
        type: 'industrial',
        location: 'Bay 4, Offshore Sector 1',
        description: 'Multi-parameter industrial generation turbine telemetry unit',
        status: 'online',
        lastSeen: new Date(),
        createdAt: new Date(),
      },
      {
        deviceId: 'TEMP-001',
        name: 'Reactor Core Thermocouple',
        type: 'temperature',
        location: 'Containment Unit 2',
        description: 'High-precision PT100 thermal sensor probe',
        status: 'online',
        lastSeen: new Date(),
        createdAt: new Date(),
      },
      {
        deviceId: 'HUM-002',
        name: 'Cleanroom Humidity Monitor',
        type: 'humidity',
        location: 'Fab Lab Cleanroom A',
        description: 'Capacitive relative humidity transmitter',
        status: 'online',
        lastSeen: new Date(),
        createdAt: new Date(),
      },
      {
        deviceId: 'ENG-003',
        name: 'Facility Main Feeder Meter',
        type: 'energy',
        location: 'Main Substation Grid Room',
        description: 'Modbus 3-Phase power & energy analyzer',
        status: 'online',
        lastSeen: new Date(),
        createdAt: new Date(),
      },
      {
        deviceId: 'AQI-004',
        name: 'Exhaust Stack Environmental Sensor',
        type: 'air_quality',
        location: 'North Emission Stack',
        description: 'Laser particulate & VOC air quality monitoring system',
        status: 'online',
        lastSeen: new Date(),
        createdAt: new Date(),
      },
    ];
    await devicesCol.insertMany(initialDevices);
  }

  // Seed Demo User
  const usersCol = database.collection('users');
  const userCount = await usersCol.countDocuments({ email: 'demo@nexusflow.io' });
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash('Demo@12345', 10);
    await usersCol.insertOne({
      email: 'demo@nexusflow.io',
      passwordHash,
      fullName: 'NexusFlow Demo Operator',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    });
    console.log('[MongoDB] Seeded default operator user: demo@nexusflow.io');
  }
}
