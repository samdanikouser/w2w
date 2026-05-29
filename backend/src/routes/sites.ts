import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const siteSchema = z.object({
  name: z.string().min(1),
  type: z.string().default('IWMC'),
  region: z.string().default(''),
  address: z.string().default(''),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  ward: z.string().optional().default(''),
  gps: z.string().optional().default(''),
  supervisor: z.string().optional().default(''),
  beneficiaries: z.number().optional().default(0),
  ohsRating: z.number().optional().default(80),
  monthlyTonnage: z.number().optional().default(0),
  phase: z.string().optional().default(''),
  focus: z.string().optional().default(''),
  cleanliness: z.string().optional().default(''),
  launched: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  provinceId: z.string().optional().default(''),
  municipalityId: z.string().optional().default(''),
  subRegionId: z.string().optional().default(''),
  depotId: emptyToNullUuid,
  currentSkipBinCount: z.number().optional().nullish(),
  gateFee: z.number().optional().nullish(),
  weighbridge: emptyToNull,
  maxVehicleTonnage: z.number().optional().nullish(),
  acceptedMaterials: z.array(z.string()).optional().default([]),
  metadata: z.any().optional(),
});

// ── GET /api/sites ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { depot_id } = req.query;
    const where: any = {};
    const hasAdminAccess = req.userModules?.some(m => ['w2w-settings', 'facilities', 'sites'].includes(m));
    if (req.userSiteId && !hasAdminAccess) {
      where.id = req.userSiteId;
    }
    if (depot_id) {
      where.depotId = String(depot_id);
    }

    const sites = await prisma.site.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true, wasteLogs: true } } },
    });
    res.json(sites);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites ──
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = siteSchema.parse(req.body);
    const site = await prisma.site.create({
      data: { 
        ...data, 
        lat: data.lat || null, 
        lng: data.lng || null, 
        status: data.status as any, 
        type: data.type as any,
        depotId: data.depotId || null,
        currentSkipBinCount: data.currentSkipBinCount || null,
        gateFee: data.gateFee || null,
        weighbridge: data.weighbridge || null
      },
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
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = siteSchema.partial().parse(req.body);
    const site = await prisma.site.update({
      where: { id: req.params.id as string },
      data: { ...data, lat: data.lat || undefined, lng: data.lng || undefined, type: data.type as any, status: data.status as any, depotId: data.depotId !== undefined ? (data.depotId || null) : undefined } as any,
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
router.delete('/:id', async (req: AuthRequest, res, next) => {
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
