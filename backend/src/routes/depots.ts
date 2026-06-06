import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const depotSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullish().transform(v => v ?? ''),
  type: z.string().nullish().transform(v => v ?? 'IWMC'),
  status: z.string().nullish().transform(v => v ?? 'Active'),
  address: z.string().nullish().transform(v => v ?? ''),
  gps: z.string().nullish().transform(v => v ?? ''),
  phone: z.string().nullish().transform(v => v ?? ''),
  operatingHours: z.string().nullish().transform(v => v ?? ''),
  capacity: z.number().nullish().transform(v => v ?? 0),
  currentStock: z.number().nullish().transform(v => v ?? 0),
  siteId: z.string().nullish().transform(v => v || null),
  managerUserId: z.string().nullish().transform(v => v || null),
  notes: z.string().nullish().transform(v => v ?? ''),
  // Multi-site linking
  linkedSiteIds: z.array(z.string()).optional(),
});

// ── Helper: sync Site.depotId for linked sites ──
async function syncLinkedSites(depotId: string, linkedSiteIds: string[] | undefined) {
  if (linkedSiteIds === undefined) return; // field not sent → skip

  // 1. Clear depotId on sites previously linked to this depot but now removed
  await prisma.site.updateMany({
    where: { depotId, id: { notIn: linkedSiteIds } },
    data: { depotId: null },
  });

  // 2. Set depotId on newly linked sites
  if (linkedSiteIds.length > 0) {
    await prisma.site.updateMany({
      where: { id: { in: linkedSiteIds } },
      data: { depotId },
    });
  }
}

// ── GET /api/depots ── (scoped)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const where: any = {};

    // Scope: depot manager → only their depot
    if (req.userDepotId) {
      where.id = req.userDepotId;
    } else if (req.managedSiteIds && req.managedSiteIds.length > 0) {
      // User has managed sites → show depots that own those sites
      where.sites = { some: { id: { in: req.managedSiteIds } } };
    } else if (req.userSiteId) {
      // Single-site user → show depot their site belongs to
      where.sites = { some: { id: req.userSiteId } };
    }
    // If none → admin → no filter (sees all)

    const depots = await prisma.depot.findMany({
      where,
      include: {
        sites: { select: { id: true, name: true, type: true, status: true } },
        cooperatives: { select: { id: true, name: true, stage: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(depots);
  } catch (err) { next(err); }
});

// ── GET /api/depots/:id ──
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const depot = await prisma.depot.findUnique({
      where: { id: req.params.id as string },
      include: {
        sites: { select: { id: true, name: true, type: true, status: true } },
        cooperatives: { select: { id: true, name: true, stage: true } },
      },
    });
    if (!depot) return res.status(404).json({ error: 'Depot not found' });
    res.json(depot);
  } catch (err) { next(err); }
});

// ── POST /api/depots ──
router.post('/', requireModule('depots', 'facilities', 'sites'), requireAction('depots', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const { linkedSiteIds, ...data } = depotSchema.parse(req.body);
    const depot = await prisma.depot.create({ data });

    // Link sites to this depot
    await syncLinkedSites(depot.id, linkedSiteIds);

    // Re-fetch with includes
    const full = await prisma.depot.findUnique({
      where: { id: depot.id },
      include: {
        sites: { select: { id: true, name: true, type: true, status: true } },
        cooperatives: { select: { id: true, name: true, stage: true } },
      },
    });
    res.status(201).json(full);
  } catch (err) { next(err); }
});

// ── PUT /api/depots/:id ──
router.put('/:id', requireModule('depots', 'facilities', 'sites'), requireAction('depots', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const { linkedSiteIds, ...data } = depotSchema.partial().parse(req.body);
    const depot = await prisma.depot.update({
      where: { id: req.params.id as string },
      data,
    });

    // Sync linked sites
    await syncLinkedSites(depot.id, linkedSiteIds);

    // Re-fetch with includes
    const full = await prisma.depot.findUnique({
      where: { id: depot.id },
      include: {
        sites: { select: { id: true, name: true, type: true, status: true } },
        cooperatives: { select: { id: true, name: true, stage: true } },
      },
    });
    res.json(full);
  } catch (err) { next(err); }
});

// ── DELETE /api/depots/:id ──
router.delete('/:id', requireModule('depots', 'facilities', 'sites'), requireAction('depots', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const depotId = req.params.id as string;
    // Unlink all sites first
    await prisma.site.updateMany({
      where: { depotId },
      data: { depotId: null },
    });
    await prisma.depot.delete({ where: { id: depotId } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
