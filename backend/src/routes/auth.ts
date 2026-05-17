import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import prisma from '../config/db.js';
import { authenticate, JWT_SECRET, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Hard rate-limit on login: 10 attempts per 15 min per IP ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Password policy: 10+ chars, mixed case, digit. Enforce on every write. ──
const passwordPolicy = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a digit');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordPolicy,
});

// ── POST /api/auth/login ──
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { site: true },
    });
    // Constant-time-ish failure: always run bcrypt to mask user-existence
    const hash = user?.passwordHash || '$2a$12$invalidplaceholderinvalidplaceholderinvalid';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !user.isActive || !valid) {
      // Audit failed login attempts on existing accounts
      if (user) {
        await prisma.auditLog.create({
          data: { userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        siteId: user.siteId,
        siteName: user.site?.name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/change-password ──
router.post('/change-password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(403).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
    });

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { site: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      siteName: user.site?.name || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
