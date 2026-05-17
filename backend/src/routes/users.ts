import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

// Same password policy as auth.ts
const passwordPolicy = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a digit');

const createSchema = z.object({
  employeeId: z.string().uuid(),
  email: z.string().email(),
  password: passwordPolicy,
  customRoleId: z.string().uuid().optional().nullable(),
});

const updateSchema = z.object({
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
  newPassword: passwordPolicy.optional(),
});

// ── GET /api/users ──
router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        siteId: true,
        site: { select: { id: true, name: true } },
        employeeId: true,
        employee: { select: { id: true, firstName: true, lastName: true, empNo: true } },
        customRoleId: true,
        customRole: { select: { id: true, name: true, systemRole: true } },
      },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users  (create from existing employee) ──
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);

    // Verify employee exists and isn't already linked to a user
    const emp = await prisma.employee.findUnique({
      where: { id: d.employeeId },
      include: { user: true },
    });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (emp.user) return res.status(409).json({ error: 'Employee already has a user account' });

    // Verify email is unique
    const existing = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    // Resolve the system role from the custom role
    let systemRole: 'SUPER_ADMIN' | 'SITE_ADMIN' | 'DATA_CLERK' | 'FIELD_WORKER' = 'FIELD_WORKER';
    if (d.customRoleId) {
      const cr = await prisma.customRole.findUnique({ where: { id: d.customRoleId } });
      if (!cr || !cr.isActive) return res.status(400).json({ error: 'Invalid custom role' });
      systemRole = cr.systemRole as any;
    }

    const passwordHash = await bcrypt.hash(d.password, 12);
    const user = await prisma.user.create({
      data: {
        email: d.email.toLowerCase(),
        passwordHash,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        role: systemRole,
        employeeId: emp.id,
        siteId: emp.siteId || null,
        customRoleId: d.customRoleId || null,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, employeeId: true, customRoleId: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        detail: `Created user ${user.email} for employee ${emp.empNo}`,
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/users/:id ──
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const d = updateSchema.parse(req.body);

    // Resolve system role if customRoleId is changing
    let systemRole: 'SUPER_ADMIN' | 'SITE_ADMIN' | 'DATA_CLERK' | 'FIELD_WORKER' | undefined;
    if (d.customRoleId) {
      const cr = await prisma.customRole.findUnique({ where: { id: d.customRoleId } });
      if (!cr || !cr.isActive) return res.status(400).json({ error: 'Invalid custom role' });
      systemRole = cr.systemRole as any;
    }

    const data: any = {
      email: d.email?.toLowerCase(),
      isActive: d.isActive,
      customRoleId: d.customRoleId === null ? null : d.customRoleId,
    };
    if (systemRole) data.role = systemRole;
    if (d.newPassword) data.passwordHash = await bcrypt.hash(d.newPassword, 12);

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, customRoleId: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        detail: d.newPassword ? 'Updated user (password reset)' : 'Updated user',
        ipAddress: req.ip || null,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/users/:id ──
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    await prisma.user.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'DELETE',
        entity: 'User',
        entityId: req.params.id as string,
        ipAddress: req.ip || null,
      },
    });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
