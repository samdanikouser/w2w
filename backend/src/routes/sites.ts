import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const siteSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['COOPERATIVE', 'DEPOT', 'BUYBACK_CENTRE']).default('COOPERATIVE'),
  region: z.string().default(''),
  address: z.string().default(''),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// ── GET /api/sites ──
router.get('/', async (_req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true, wasteLogs: true } } },
    });
    res.json(sites);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites ──
router.post('/', authorize('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = siteSchema.parse(req.body);
    const site = await prisma.site.create({
      data: { ...data, lat: data.lat || null, lng: data.lng || null, status: data.status as any, type: data.type as any },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'Site', entityId: site.id, detail: `Created site ${site.name}` },
    });

    res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/sites/:id ──
router.put('/:id', authorize('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = siteSchema.partial().parse(req.body);
    const site = await prisma.site.update({
      where: { id: req.params.id as string },
      data: { ...data, lat: data.lat || undefined, lng: data.lng || undefined },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'Site', entityId: site.id, detail: `Updated site ${site.name}` },
    });

    res.json(site);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/sites/:id ──
router.delete('/:id', authorize('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.site.delete({ where: { id: req.params.id as string } });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'Site', entityId: req.params.id as string },
    });

    res.json({ message: 'Site deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
