import { Router, Request, Response } from 'express';
import { getDatabase, DeviceDocument } from '../database/mongo.js';

const router = Router();

// GET /api/devices
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const query: any = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { deviceId: { $regex: req.query.search, $options: 'i' } },
        { location: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const devices = await db.collection<DeviceDocument>('devices').find(query).toArray();
    // Return with compatibility fields (id / deviceId)
    const formatted = devices.map(d => ({
      id: d.deviceId,
      deviceId: d.deviceId,
      name: d.name,
      type: d.type,
      location: d.location,
      description: d.description,
      status: d.status,
      last_seen: d.lastSeen ? d.lastSeen.toISOString() : null,
      created_at: d.createdAt.toISOString(),
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, deviceId, name, type, location, description } = req.body;
    const finalId = (deviceId || id || `DEV-${Date.now()}`).toUpperCase();

    const doc: DeviceDocument = {
      deviceId: finalId,
      name: name || finalId,
      type: type || 'industrial',
      location: location || 'Field Node',
      description: description || '',
      status: 'online',
      lastSeen: new Date(),
      createdAt: new Date(),
    };

    const db = getDatabase();
    await db.collection<DeviceDocument>('devices').insertOne(doc);

    res.status(201).json({
      id: doc.deviceId,
      deviceId: doc.deviceId,
      name: doc.name,
      type: doc.type,
      location: doc.location,
      description: doc.description,
      status: doc.status,
      last_seen: doc.lastSeen?.toISOString(),
      created_at: doc.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/devices/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const device = await db.collection<DeviceDocument>('devices').findOne({ deviceId: req.params.id });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({
      id: device.deviceId,
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      location: device.location,
      description: device.description,
      status: device.status,
      last_seen: device.lastSeen?.toISOString(),
      created_at: device.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/devices/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { name, type, location, description, status } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    const result = await db.collection<DeviceDocument>('devices').findOneAndUpdate(
      { deviceId: req.params.id },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Device not found' });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = await db.collection('devices').deleteOne({ deviceId: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Device not found' });
    res.json({ success: true, message: `Device ${req.params.id} deleted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
