import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { applySiteScope, enforceCreateScope, getAllowedSiteIds } from '../middleware/siteScoping.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const vehicleSchema = z.object({
  registration: z.string().min(1),
  make: z.string().default(''),
  model: z.string().default(''),
  year: z.number().int().nullish(),
  siteId: emptyToNullUuid,
  status: z.enum(['OPERATIONAL', 'ACTIVE', 'MAINTENANCE', 'UNDER_REPAIR', 'DECOMMISSIONED', 'INACTIVE']).default('OPERATIONAL'),
  condition: z.string().default('Good'),
  assignedTo: z.string().default(''),
  fuelType: z.string().default(''),
  lastService: emptyToNull,
  nextService: emptyToNull,
  odometerKm: z.number().nullish(),
});

// ── GET /api/vehicles ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const where: any = {};
    applySiteScope(req, where);
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { registration: 'asc' },
      include: { site: { select: { id: true, name: true } } },
    });
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/vehicles ──
router.post('/', requireModule('vehicles'), requireAction('vehicles', 'create'), enforceCreateScope(), async (req: AuthRequest, res, next) => {
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
        condition: data.condition,
        assignedTo: data.assignedTo,
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
router.put('/:id', requireModule('vehicles'), requireAction('vehicles', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id as string }, select: { siteId: true } });
      if (existing?.siteId && !allowed.includes(existing.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

    const data = vehicleSchema.partial().parse(req.body);
    const v = await prisma.vehicle.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        lastService: data.lastService !== undefined ? (data.lastService ? new Date(data.lastService) : null) : undefined,
        nextService: data.nextService !== undefined ? (data.nextService ? new Date(data.nextService) : null) : undefined,
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
router.delete('/:id', requireModule('vehicles'), requireAction('vehicles', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id as string }, select: { siteId: true } });
      if (existing?.siteId && !allowed.includes(existing.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

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
