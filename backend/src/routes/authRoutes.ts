import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/mongo.js';
import { config } from '../config/environment.js';

const router = Router();

function generateToken(user: any): string {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const db = getDatabase();
    const user = await db.collection('users').findOne({ email: email?.toLowerCase() });

    if (!user) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    const matches = await bcrypt.compare(password || '', user.passwordHash);
    if (!matches) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user._id.toString(),
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt?.toISOString ? user.createdAt.toISOString() : user.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/auth/demo-login - 1-Click Instant Demo Evaluation Login
router.post('/demo-login', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    let user = await db.collection('users').findOne({ email: 'demo@nexusflow.io' });

    if (!user) {
      const passwordHash = await bcrypt.hash('Demo@12345', 10);
      const insert = await db.collection('users').insertOne({
        email: 'demo@nexusflow.io',
        passwordHash,
        fullName: 'NexusFlow Demo Operator',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
      });
      user = await db.collection('users').findOne({ _id: insert.insertedId });
    }

    const token = generateToken(user!);
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user!._id.toString(),
        email: user!.email,
        full_name: user!.fullName,
        role: user!.role,
        is_active: user!.isActive,
        created_at: user!.createdAt?.toISOString ? user!.createdAt.toISOString() : user!.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role = 'operator' } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password required' });
    }

    const db = getDatabase();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ detail: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({
      email: email.toLowerCase(),
      passwordHash,
      fullName: full_name || email.split('@')[0],
      role,
      isActive: true,
      createdAt: new Date(),
    });

    const newUser = await db.collection('users').findOne({ _id: result.insertedId });
    const token = generateToken(newUser!);

    res.status(201).json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: newUser!._id.toString(),
        email: newUser!.email,
        full_name: newUser!.fullName,
        role: newUser!.role,
        is_active: newUser!.isActive,
        created_at: newUser!.createdAt?.toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    res.json({
      id: decoded.id,
      email: decoded.email,
      full_name: decoded.email,
      role: decoded.role,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  } catch {
    res.status(401).json({ detail: 'Invalid or expired token' });
  }
});

export default router;
