import { z } from 'zod';
import { getDatabase, TelemetryDocument } from '../database/mongo.js';
import { pipelineManager } from '../compiler/pipelineManager.js';
import { wsHub } from '../websockets/hub.js';

// Schema accepting standard or legacy flat payload
export const TelemetryInputSchema = z.object({
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  deviceType: z.string().optional(),
  location: z.string().optional(),
  metadata: z.object({
    deviceId: z.string().optional(),
    deviceType: z.string().optional(),
    location: z.string().optional(),
  }).optional(),
  timestamp: z.coerce.date().optional(),
  temperature: z.coerce.number().optional(),
  humidity: z.coerce.number().optional(),
  energy: z.coerce.number().optional(),
  energy_consumption: z.coerce.number().optional(),
  aqi: z.coerce.number().optional(),
  air_quality: z.coerce.number().optional(),
  measurements: z.object({
    temperature: z.coerce.number().optional(),
    humidity: z.coerce.number().optional(),
    energy: z.coerce.number().optional(),
    aqi: z.coerce.number().optional(),
  }).optional(),
}).refine(data => data.deviceId || data.device_id || data.metadata?.deviceId, {
  message: 'Either deviceId, device_id, or metadata.deviceId must be provided',
});

export type TelemetryInput = z.infer<typeof TelemetryInputSchema>;

export class TelemetryService {
  normalizePayload(input: TelemetryInput): TelemetryDocument {
    const deviceId = (input.deviceId || input.device_id || input.metadata?.deviceId)!.trim();
    const timestamp = input.timestamp instanceof Date ? input.timestamp : new Date();

    const temp = input.measurements?.temperature ?? input.temperature ?? 25.0;
    const hum = input.measurements?.humidity ?? input.humidity ?? 50.0;
    const eng = input.measurements?.energy ?? input.energy ?? input.energy_consumption ?? 40.0;
    const aqi = input.measurements?.aqi ?? input.aqi ?? input.air_quality ?? 35.0;

    return {
      timestamp,
      metadata: {
        deviceId,
        deviceType: input.metadata?.deviceType || input.deviceType || 'industrial',
        location: input.metadata?.location || input.location || 'Facility Floor',
      },
      measurements: {
        temperature: Number(temp.toFixed(2)),
        humidity: Number(hum.toFixed(2)),
        energy: Number(eng.toFixed(2)),
        aqi: Number(aqi.toFixed(2)),
      },
    };
  }

  async ingestSingle(rawInput: TelemetryInput): Promise<TelemetryDocument> {
    const validated = TelemetryInputSchema.parse(rawInput);
    const doc = this.normalizePayload(validated);

    const db = getDatabase();
    await db.collection<TelemetryDocument>('telemetry').insertOne(doc);

    // Asynchronously update device lastSeen
    db.collection('devices').updateOne(
      { deviceId: doc.metadata.deviceId },
      { $set: { lastSeen: doc.timestamp, status: 'online' } }
    ).catch(() => {});

    // Distribute to compiled active RxJS pipelines
    pipelineManager.dispatchTelemetry(doc);

    // Broadcast live telemetry update over WebSockets (with format matching both frontend types)
    const broadcastPayload = {
      device_id: doc.metadata.deviceId,
      deviceId: doc.metadata.deviceId,
      device_name: doc.metadata.deviceId,
      temperature: doc.measurements.temperature,
      humidity: doc.measurements.humidity,
      energy_consumption: doc.measurements.energy,
      energy: doc.measurements.energy,
      air_quality: doc.measurements.aqi,
      aqi: doc.measurements.aqi,
      is_abnormal: doc.measurements.temperature > 80 || doc.measurements.aqi > 150,
      timestamp: doc.timestamp.toISOString(),
      metadata: doc.metadata,
      measurements: doc.measurements,
    };

    wsHub.broadcast('telemetry:update', broadcastPayload);
    wsHub.broadcast('new_telemetry', { telemetry: broadcastPayload });

    return doc;
  }

  async ingestBatch(inputs: TelemetryInput[]): Promise<{ insertedCount: number }> {
    if (!inputs || inputs.length === 0) {
      return { insertedCount: 0 };
    }

    const docs: TelemetryDocument[] = [];
    for (const raw of inputs) {
      const parsed = TelemetryInputSchema.safeParse(raw);
      if (parsed.success) {
        docs.push(this.normalizePayload(parsed.data));
      }
    }

    if (docs.length === 0) {
      return { insertedCount: 0 };
    }

    const db = getDatabase();
    // High-performance unordered bulk insert
    const result = await db.collection<TelemetryDocument>('telemetry').insertMany(docs, { ordered: false });

    // Distribute latest readings and notify
    for (const doc of docs.slice(-50)) {
      pipelineManager.dispatchTelemetry(doc);
    }

    // Broadcast last reading to update UI
    const lastDoc = docs[docs.length - 1];
    wsHub.broadcast('telemetry:update', {
      device_id: lastDoc.metadata.deviceId,
      deviceId: lastDoc.metadata.deviceId,
      temperature: lastDoc.measurements.temperature,
      humidity: lastDoc.measurements.humidity,
      energy_consumption: lastDoc.measurements.energy,
      air_quality: lastDoc.measurements.aqi,
      timestamp: lastDoc.timestamp.toISOString(),
    });

    return { insertedCount: result.insertedCount };
  }

  async getLatest(deviceId?: string): Promise<any[]> {
    const db = getDatabase();
    const match = deviceId ? { 'metadata.deviceId': deviceId } : {};

    const pipeline = [
      { $match: match },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$metadata.deviceId',
          latestDoc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latestDoc' } },
    ];

    const results = await db.collection('telemetry').aggregate(pipeline).toArray();

    return results.map(doc => ({
      device_id: doc.metadata?.deviceId,
      deviceId: doc.metadata?.deviceId,
      device_name: doc.metadata?.deviceId,
      temperature: doc.measurements?.temperature ?? 0,
      humidity: doc.measurements?.humidity ?? 0,
      energy_consumption: doc.measurements?.energy ?? 0,
      air_quality: doc.measurements?.aqi ?? 0,
      timestamp: doc.timestamp?.toISOString ? doc.timestamp.toISOString() : doc.timestamp,
    }));
  }

  async getHistory(deviceId?: string, limit = 100, startTime?: Date, endTime?: Date): Promise<any[]> {
    const db = getDatabase();
    const query: any = {};
    if (deviceId) {
      query['metadata.deviceId'] = deviceId;
    }
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }

    const docs = await db
      .collection<TelemetryDocument>('telemetry')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(limit, 2000))
      .toArray();

    return docs.map(doc => ({
      device_id: doc.metadata?.deviceId,
      deviceId: doc.metadata?.deviceId,
      device_name: doc.metadata?.deviceId,
      temperature: doc.measurements?.temperature,
      humidity: doc.measurements?.humidity,
      energy_consumption: doc.measurements?.energy,
      air_quality: doc.measurements?.aqi,
      is_abnormal: (doc.measurements?.temperature > 80 || (doc.measurements?.aqi || 0) > 150),
      timestamp: doc.timestamp?.toISOString ? doc.timestamp.toISOString() : doc.timestamp,
    }));
  }

  async getStats(): Promise<any> {
    const db = getDatabase();
    const totalReadings = await db.collection('telemetry').countDocuments();

    const agg = await db.collection('telemetry').aggregate([
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$measurements.temperature' },
          minTemp: { $min: '$measurements.temperature' },
          maxTemp: { $max: '$measurements.temperature' },
          avgHum: { $avg: '$measurements.humidity' },
          minHum: { $min: '$measurements.humidity' },
          maxHum: { $max: '$measurements.humidity' },
          avgEnergy: { $avg: '$measurements.energy' },
          avgAqi: { $avg: '$measurements.aqi' },
        },
      },
    ]).toArray();

    const stats = agg[0] || {};

    return {
      totalReadings,
      averages: {
        temperature: Number((stats.avgTemp || 0).toFixed(2)),
        humidity: Number((stats.avgHum || 0).toFixed(2)),
        energy: Number((stats.avgEnergy || 0).toFixed(2)),
        aqi: Number((stats.avgAqi || 0).toFixed(2)),
      },
      ranges: {
        temperature: { min: stats.minTemp || 0, max: stats.maxTemp || 0 },
        humidity: { min: stats.minHum || 0, max: stats.maxHum || 0 },
      },
    };
  }
}

export const telemetryService = new TelemetryService();
