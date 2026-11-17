import { z } from 'zod';

export type NodeCategory = 'source' | 'math' | 'action';

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  displayName: string;
  description: string;
  defaultConfig: Record<string, any>;
  schema: z.ZodTypeAny;
}

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  // --- Data Source Nodes ---
  dataSource: {
    type: 'dataSource',
    category: 'source',
    displayName: 'Generic IoT Data Source',
    description: 'Streams telemetry for a specific device and metric',
    defaultConfig: { deviceId: 'TURBINE-001', metric: 'temperature' },
    schema: z.object({
      deviceId: z.string().min(1, 'Device ID is required'),
      metric: z.enum(['temperature', 'humidity', 'energy', 'aqi']).default('temperature'),
    }),
  },
  turbineSensor: {
    type: 'turbineSensor',
    category: 'source',
    displayName: 'Turbine Multi-Sensor',
    description: 'Streams comprehensive mechanical and electrical turbine telemetry',
    defaultConfig: { deviceId: 'TURBINE-001', metric: 'temperature' },
    schema: z.object({
      deviceId: z.string().default('TURBINE-001'),
      metric: z.enum(['temperature', 'humidity', 'energy', 'aqi']).default('temperature'),
    }),
  },
  temperatureSensor: {
    type: 'temperatureSensor',
    category: 'source',
    displayName: 'Temperature Sensor',
    description: 'High precision PT100 RTD temperature probe telemetry',
    defaultConfig: { deviceId: 'TEMP-001', metric: 'temperature' },
    schema: z.object({
      deviceId: z.string().default('TEMP-001'),
      metric: z.literal('temperature').default('temperature'),
    }),
  },
  humiditySensor: {
    type: 'humiditySensor',
    category: 'source',
    displayName: 'Humidity Sensor',
    description: 'Capacitive relative humidity sensor telemetry',
    defaultConfig: { deviceId: 'HUM-002', metric: 'humidity' },
    schema: z.object({
      deviceId: z.string().default('HUM-002'),
      metric: z.literal('humidity').default('humidity'),
    }),
  },
  energySensor: {
    type: 'energySensor',
    category: 'source',
    displayName: 'Energy Meter',
    description: 'Modbus 3-Phase active power consumption telemetry',
    defaultConfig: { deviceId: 'ENG-003', metric: 'energy' },
    schema: z.object({
      deviceId: z.string().default('ENG-003'),
      metric: z.literal('energy').default('energy'),
    }),
  },
  airQualitySensor: {
    type: 'airQualitySensor',
    category: 'source',
    displayName: 'Air Quality Sensor',
    description: 'Laser particulate & VOC air quality index telemetry',
    defaultConfig: { deviceId: 'AQI-004', metric: 'aqi' },
    schema: z.object({
      deviceId: z.string().default('AQI-004'),
      metric: z.literal('aqi').default('aqi'),
    }),
  },

  // --- Math Operations ---
  addition: {
    type: 'addition',
    category: 'math',
    displayName: 'Addition (+)',
    description: 'Adds a constant scalar or offset to the streaming value',
    defaultConfig: { operand: 10 },
    schema: z.object({
      operand: z.coerce.number().default(0),
    }),
  },
  subtraction: {
    type: 'subtraction',
    category: 'math',
    displayName: 'Subtraction (-)',
    description: 'Subtracts a constant scalar or offset from the streaming value',
    defaultConfig: { operand: 5 },
    schema: z.object({
      operand: z.coerce.number().default(0),
    }),
  },
  multiplication: {
    type: 'multiplication',
    category: 'math',
    displayName: 'Multiplication (×)',
    description: 'Scales the incoming measurement by a constant factor',
    defaultConfig: { operand: 1.5 },
    schema: z.object({
      operand: z.coerce.number().default(1),
    }),
  },
  division: {
    type: 'division',
    category: 'math',
    displayName: 'Division (÷)',
    description: 'Divides the incoming measurement by a constant divisor',
    defaultConfig: { operand: 2 },
    schema: z.object({
      operand: z.coerce.number().refine(n => n !== 0, 'Divisor cannot be zero').default(1),
    }),
  },
  movingAverage: {
    type: 'movingAverage',
    category: 'math',
    displayName: 'Moving Average Window',
    description: 'Calculates the rolling arithmetic mean across a sliding window of readings',
    defaultConfig: { windowSize: 5 },
    schema: z.object({
      windowSize: z.coerce.number().min(2, 'Window size must be at least 2').max(50).default(5),
    }),
  },
  minimum: {
    type: 'minimum',
    category: 'math',
    displayName: 'Rolling Minimum',
    description: 'Tracks the rolling minimum value across a sliding window',
    defaultConfig: { windowSize: 5 },
    schema: z.object({
      windowSize: z.coerce.number().min(2).max(50).default(5),
    }),
  },
  maximum: {
    type: 'maximum',
    category: 'math',
    displayName: 'Rolling Maximum',
    description: 'Tracks the rolling maximum value across a sliding window',
    defaultConfig: { windowSize: 5 },
    schema: z.object({
      windowSize: z.coerce.number().min(2).max(50).default(5),
    }),
  },
  thresholdComparison: {
    type: 'thresholdComparison',
    category: 'math',
    displayName: 'Threshold Comparison',
    description: 'Evaluates value against threshold condition (>, <, >=, <=, ==, !=)',
    defaultConfig: { operator: '>', threshold: 75 },
    schema: z.object({
      operator: z.enum(['>', '<', '>=', '<=', '==', '!=']).default('>'),
      threshold: z.coerce.number().default(50),
    }),
  },

  // --- Action Trigger Nodes ---
  smsAlert: {
    type: 'smsAlert',
    category: 'action',
    displayName: 'Mock SMS Alert',
    description: 'Dispatches emergency SMS notification to on-call engineers',
    defaultConfig: {
      recipient: '+1 (555) 019-2834',
      severity: 'critical',
      cooldownSeconds: 30,
    },
    schema: z.object({
      recipient: z.string().default('+1 (555) 019-2834'),
      severity: z.enum(['critical', 'warning', 'info']).default('critical'),
      cooldownSeconds: z.coerce.number().min(0).default(30),
    }),
  },
  webhook: {
    type: 'webhook',
    category: 'action',
    displayName: 'HTTP Webhook',
    description: 'Dispatches signed JSON POST payload to an external endpoint with retry',
    defaultConfig: {
      url: 'http://127.0.0.1:8000/api/mock-webhook-receiver',
      retries: 3,
      timeoutMs: 4000,
    },
    schema: z.object({
      url: z.string().url('Must be a valid HTTP/HTTPS URL'),
      retries: z.coerce.number().min(1).max(5).default(3),
      timeoutMs: z.coerce.number().min(500).max(10000).default(4000),
    }),
  },
  dashboardAlert: {
    type: 'dashboardAlert',
    category: 'action',
    displayName: 'Live Dashboard Alert',
    description: 'Generates live incident alert banner & toast across operator consoles',
    defaultConfig: {
      severity: 'warning',
      message: 'Threshold violation detected',
      cooldownSeconds: 30,
    },
    schema: z.object({
      severity: z.enum(['critical', 'warning', 'info']).default('warning'),
      message: z.string().default('Threshold violation detected'),
      cooldownSeconds: z.coerce.number().min(0).default(30),
    }),
  },
  logEvent: {
    type: 'logEvent',
    category: 'action',
    displayName: 'Execution Audit Log',
    description: 'Persists evaluated record into execution audit log for compliance',
    defaultConfig: {
      logLevel: 'INFO',
    },
    schema: z.object({
      logLevel: z.enum(['INFO', 'WARN', 'ERROR']).default('INFO'),
    }),
  },
};

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[type];
}

export function getAllowedNodeTypes(): string[] {
  return Object.keys(NODE_DEFINITIONS);
}
