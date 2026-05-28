import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const wasteTypeSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(''),
  unit: z.string().default('kg'),
  pricePerUnit: z.number().default(0),
  buyer: z.string().default(''),
  colour: z.string().default('#146484'),
  isActive: z.boolean().default(true),
});

// ── GET /api/waste-types ──
router.get('/', async (_req, res, next) => {
  try {
    const types = await prisma.wasteType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/waste-types ──
router.post('/', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    const data = wasteTypeSchema.parse(req.body);
    const wt = await prisma.wasteType.create({ data });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'WasteType', entityId: wt.id, detail: `Created waste type ${wt.name}` },
    });

    res.status(201).json(wt);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/waste-types/:id ──
router.put('/:id', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    const data = wasteTypeSchema.partial().parse(req.body);
    const wt = await prisma.wasteType.update({ where: { id: req.params.id as string }, data });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'WasteType', entityId: wt.id },
    });

    res.json(wt);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/waste-types/:id (soft) ──
router.delete('/:id', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.wasteType.update({ where: { id: req.params.id as string }, data: { isActive: false } });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'WasteType', entityId: req.params.id as string },
    });

    res.json({ message: 'Waste type deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
