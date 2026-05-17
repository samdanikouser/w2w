import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const vehicleSchema = z.object({
  registration: z.string().min(1),
  make: z.string().default(''),
  model: z.string().default(''),
  year: z.number().int().nullish(),
  siteId: z.string().nullish(),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'DECOMMISSIONED']).default('OPERATIONAL'),
  fuelType: z.string().default(''),
  lastService: z.string().nullish(),
  nextService: z.string().nullish(),
  odometerKm: z.number().nullish(),
});

// ── GET /api/vehicles ──
router.get('/', async (_req, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { registration: 'asc' },
      include: { site: { select: { id: true, name: true } } },
    });
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/vehicles ──
router.post('/', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = vehicleSchema.parse(req.body);
    const v = await prisma.vehicle.create({
      data: {
        registration: data.registration,
        make: data.make,
        model: data.model,
        year: data.year ?? null,
        siteId: data.siteId || null,
        status: data.status as any,
        fuelType: data.fuelType,
        lastService: data.lastService ? new Date(data.lastService) : null,
        nextService: data.nextService ? new Date(data.nextService) : null,
        odometerKm: data.odometerKm ?? null,
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'Vehicle', entityId: v.id, detail: `Added vehicle ${v.registration}` },
    });

    res.status(201).json(v);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/vehicles/:id ──
router.put('/:id', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = vehicleSchema.partial().parse(req.body);
    const v = await prisma.vehicle.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        lastService: data.lastService ? new Date(data.lastService) : undefined,
        nextService: data.nextService ? new Date(data.nextService) : undefined,
        status: data.status as any,
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'Vehicle', entityId: v.id, detail: `Updated vehicle ${v.registration}` },
    });

    res.json(v);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/vehicles/:id ──
router.delete('/:id', authorize('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.id as string } });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'Vehicle', entityId: req.params.id as string },
    });

    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
