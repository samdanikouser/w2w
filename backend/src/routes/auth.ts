import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Try again in 15 minutes.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Try again in 15 minutes.' },
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

// ── Refresh token config ──
const REFRESH_TOKEN_DAYS = 7;
const ACCESS_TOKEN_MINUTES = '15m';
const COOKIE_NAME = 'w2w_refresh';
const IS_PROD = process.env.NODE_ENV === 'production';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const family = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt, family },
  });

  return rawToken;
}

function setRefreshCookie(res: any, rawToken: string) {
  res.cookie(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: any) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    path: '/api/auth',
  });
}

async function resolveDepotManager(userId: string) {
  try {
    const managedDepot = await prisma.depot.findFirst({
      where: { managerUserId: userId },
      include: {
        sites: { select: { id: true } },
        cooperatives: { include: { sites: { select: { id: true } } } },
      },
    });
    if (!managedDepot) return { depotId: null, depotName: null, managedSiteIds: [] as string[], isDepotManager: false };
    const directSiteIds = managedDepot.sites?.map((s: any) => s.id) || [];
    const coopSiteIds = managedDepot.cooperatives?.flatMap((c: any) => c.sites.map((s: any) => s.id)) || [];
    const managedSiteIds = [...new Set([...directSiteIds, ...coopSiteIds])];
    return { depotId: managedDepot.id, depotName: managedDepot.name, managedSiteIds, isDepotManager: true };
  } catch (_) {
    return { depotId: null, depotName: null, managedSiteIds: [] as string[], isDepotManager: false };
  }
}

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

    let loginModules = user.customRole?.modules || [];

    // Auto-upgrade legacy roles: if a role has base modules but is missing action permissions,
    // add all action permissions. This handles roles created before granular permissions existed.
    if (user.customRole && loginModules.length > 0) {
      const ACTION_MAP: Record<string, string[]> = {
        'employees': ['employees:create','employees:edit','employees:delete'],
        'facilities': ['facilities:create','facilities:edit','facilities:delete'],
        'sites': ['sites:create','sites:edit','sites:delete'],
        'depots': ['depots:create','depots:edit','depots:delete'],
        'waste-logs': ['waste-logs:create','waste-logs:edit','waste-logs:delete'],
        'stock-register': ['stock-register:create','stock-register:edit','stock-register:delete'],
        'vehicles': ['vehicles:create','vehicles:edit','vehicles:delete'],
        'attendance': ['attendance:create','attendance:delete'],
        'training': ['training:create','training:edit','training:delete'],
        'pl-register': ['pl-register:create','pl-register:edit','pl-register:delete'],
        'violations': ['violations:create','violations:edit','violations:delete'],
      };
      const hasAnyAction = loginModules.some((m: string) => m.includes(':'));
      if (!hasAnyAction) {
        // Legacy role — upgrade by adding all actions for existing modules
        const upgraded = [...loginModules];
        for (const mod of loginModules) {
          const actions = ACTION_MAP[mod as string];
          if (actions) upgraded.push(...actions);
        }
        // Persist the upgrade
        await prisma.customRole.update({
          where: { id: user.customRole.id },
          data: { modules: upgraded },
        });
        loginModules = upgraded;
      }
    }

    // Resolve depot manager info
    const depot = await resolveDepotManager(user.id);

    const token = jwt.sign(
      { userId: user.id, modules: loginModules, siteId: user.siteId, depotId: depot.depotId, managedSiteIds: depot.managedSiteIds },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_MINUTES }
    );

    // Issue refresh token as httpOnly cookie
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

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
        depotId: depot.depotId,
        depotName: depot.depotName,
        managedSiteIds: depot.managedSiteIds,
        isDepotManager: depot.isDepotManager,
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

router.post('/register', registerLimiter, async (req, res, next) => {
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
        data: { name: orgName, type: 'IWMC', status: 'ACTIVE' },
      });
      siteId = site.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create an Admin role for this newly registered user
    const ALL_MODULES = [
      'dashboard',
      'sites','sites:create','sites:edit','sites:delete',
      'facilities','facilities:create','facilities:edit','facilities:delete',
      'epr-reports',
      'pl-register','pl-register:create','pl-register:edit','pl-register:delete',
      'reports',
      'demographics',
      'employees','employees:create','employees:edit','employees:delete',
      'onboarding',
      'attendance','attendance:create','attendance:delete',
      'check-in-out','check-in-out:create',
      'beneficiary',
      'stock-register','stock-register:create','stock-register:edit','stock-register:delete',
      'stock-variance',
      'vehicles','vehicles:create','vehicles:edit','vehicles:delete',
      'depots','depots:create','depots:edit','depots:delete',
      'depot-scanner',
      'training','training:create','training:edit','training:delete',
      'violations','violations:create','violations:edit','violations:delete',
      'audit-log',
      'waste-logs','waste-logs:create','waste-logs:edit','waste-logs:delete',
      'w2w-settings',
    ];
    
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
      { expiresIn: ACCESS_TOKEN_MINUTES }
    );

    // Issue refresh token as httpOnly cookie
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

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

    // Revoke all refresh tokens on password change — force re-login everywhere
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
    });

    clearRefreshCookie(res);
    res.json({ message: 'Password updated. Please log in again.' });
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

    // Check if this user is a depot manager (safe fallback if table missing)
    const depot = await resolveDepotManager(user.id);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      siteId: user.siteId,
      siteName: user.site?.name || null,
      modules: meModules,
      roleName: user.customRole?.name || null,
      depotId: depot.depotId,
      depotName: depot.depotName,
      managedSiteIds: depot.managedSiteIds,
      isDepotManager: depot.isDepotManager,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Timing-safe: always hash so response time is consistent whether user exists or not
      await bcrypt.hash('dummy-password-for-timing', 12);
      return res.json({ message: 'If this email is registered, a password reset has been processed.' });
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

    // SECURITY: Never return the temp password in the response.
    // In production, send via email/SMS. In dev, log server-side only.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV ONLY] Temp password for ${email}: ${tempPassword}`);
    }

    res.json({
      message: 'If this email is registered, a password reset has been processed.',
    });
  } catch (err) {
    next(err);
  }
});

// ── Refresh token endpoint ──
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[COOKIE_NAME];
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });

    const tokenHash = hashToken(rawToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { site: true, customRole: true } } },
    });

    // Token not found or expired
    if (!storedToken || storedToken.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Token reuse detected — revoke entire family (potential theft)
    if (storedToken.revoked) {
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revoked: true },
      });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Token reuse detected. All sessions revoked.' });
    }

    const user = storedToken.user;
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'User account disabled' });
    }

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Issue new refresh token in same family
    const newRawToken = crypto.randomBytes(48).toString('hex');
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { tokenHash: newTokenHash, userId: user.id, expiresAt: newExpiresAt, family: storedToken.family },
    });
    setRefreshCookie(res, newRawToken);

    // Issue new access token
    const modules = user.customRole?.modules || [];
    const depot = await resolveDepotManager(user.id);

    const token = jwt.sign(
      { userId: user.id, modules, siteId: user.siteId, depotId: depot.depotId, managedSiteIds: depot.managedSiteIds },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_MINUTES }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
        siteName: user.site?.name || null,
        modules,
        roleName: user.customRole?.name || null,
        depotId: depot.depotId,
        depotName: depot.depotName,
        managedSiteIds: depot.managedSiteIds,
        isDepotManager: depot.isDepotManager,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Logout endpoint ──
router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.[COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (storedToken) {
      // Revoke entire token family
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revoked: true },
      });
    }
  }
  clearRefreshCookie(res);
  res.json({ message: 'Logged out' });
});

export default router;
