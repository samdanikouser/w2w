import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import prisma from '../config/db.js';
import { authenticate, JWT_SECRET, type AuthRequest } from '../middleware/auth.js';

const router = Router();

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

router.get('/setup-status', async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ isSetupComplete: userCount > 0 });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { site: true, customRole: true },
    });
    const hash = user?.passwordHash || '$2a$12$invalidplaceholderinvalidplaceholderinvalid';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !user.isActive || !valid) {
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

    const loginModules = user.customRole?.modules || [];
    const token = jwt.sign(
      { userId: user.id, modules: loginModules, siteId: user.siteId },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
        siteName: user.site?.name || null,
        modules: loginModules,
        roleName: user.customRole?.name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordPolicy,
  name: z.string().min(1),
  orgName: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, orgName } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    let siteId = null;
    if (orgName) {
      const site = await prisma.site.create({
        data: { name: orgName, type: 'COOPERATIVE', status: 'ACTIVE' },
      });
      siteId = site.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create an Admin role for this newly registered user
    const ALL_MODULES = ['dashboard','sites','epr-reports','pl-register','reports','demographics','employees','onboarding','attendance','check-in-out','beneficiary','stock-register','stock-variance','vehicles','depots','depot-scanner','training','violations','audit-log','waste-logs','w2w-settings'];
    
    const adminRole = await prisma.customRole.create({
      data: {
        name: 'System Administrator - ' + (orgName || name),
        description: 'Auto-generated admin role from registration',
        modules: ALL_MODULES,
        isActive: true
      }
    });

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        siteId,
        customRoleId: adminRole.id,
        isActive: true,
      },
      include: { site: true, customRole: true },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
    });

    const regModules = adminRole.modules;

    const token = jwt.sign(
      { userId: user.id, modules: regModules, siteId: user.siteId },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
        siteName: user.site?.name || null,
        modules: regModules,
        roleName: user.customRole?.name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

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

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { site: true, customRole: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const meModules = user.customRole?.modules || [];

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      siteId: user.siteId,
      siteName: user.site?.name || null,
      modules: meModules,
      roleName: user.customRole?.name || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.json({ message: 'If this email is registered, a temporary password has been generated.' });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
    tempPassword += 'A1!';

    const hash = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'UPDATE', entity: 'User', entityId: user.id, detail: 'Password reset via forgot-password' },
    });

    res.json({
      message: 'Temporary password generated. Please change it after logging in.',
      tempPassword,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
