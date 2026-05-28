import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const roleSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().default(''),
  
  modules: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

// ── GET /api/roles ──
router.get('/', async (_req, res, next) => {
  try {
    const roles = await prisma.customRole.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/roles ──
router.post('/', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    const d = roleSchema.parse(req.body);
    const r = await prisma.customRole.create({ data: { ...d, } });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'CustomRole', entityId: r.id, detail: `Created role ${r.name}` },
    });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/roles/:id ──
router.put('/:id', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    const d = roleSchema.partial().parse(req.body);
    const r = await prisma.customRole.update({
      where: { id: req.params.id as string },
      data: { ...d, },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'CustomRole', entityId: r.id, detail: `Updated role ${r.name}` },
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/roles/:id ──
router.delete('/:id', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    // Refuse delete if users still reference this role
    const inUse = await prisma.user.count({ where: { customRoleId: req.params.id as string } });
    if (inUse > 0) {
      return res.status(409).json({ error: `Role is assigned to ${inUse} user(s). Reassign them first.` });
    }
    await prisma.customRole.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'CustomRole', entityId: req.params.id as string },
    });
    res.json({ message: 'Role deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
