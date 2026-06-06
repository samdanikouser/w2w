import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';

import { applySiteScope } from '../middleware/siteScoping.js';

const router = Router();
router.use(authenticate);

const coopSchema = z.object({
  siteId: z.string().nullish().transform(v => v || null),
  depotId: z.string().nullish().transform(v => v || null),
  name: z.string().min(1),
  registrationNumber: z.string().nullish().transform(v => v ?? ''),
  contactPerson: z.string().nullish().transform(v => v ?? ''),
  contactNumber: z.string().nullish().transform(v => v ?? ''),
  totalMembers: z.number().nullish().transform(v => v ?? 0),
  hasBalingMachine: z.boolean().default(false),
  materialPayoutRates: z.any().nullish(),
  dailyTonsRecovered: z.number().nullish().transform(v => v ?? 0),
  stage: z.string().nullish().transform(v => v ?? 'Formation'),
  proPartner: z.string().nullish().transform(v => v ?? ''),
  mentor: z.string().nullish().transform(v => v ?? ''),
  focus: z.string().nullish().transform(v => v ?? ''),
  revenue: z.number().nullish().transform(v => v ?? 0),
  notes: z.string().nullish().transform(v => v ?? ''),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { siteId, depotId } = req.query;
    const where: any = {};

    // Apply site-level scoping
    applySiteScope(req, where);

    // Allow query param overrides only within scope
    if (siteId && !where.siteId) where.siteId = String(siteId);
    if (depotId) where.depotId = String(depotId);

    const coops = await prisma.cooperative.findMany({
      where,
      include: {
        site: { select: { id: true, name: true, type: true } },
        depot: { select: { id: true, name: true } },
        sites: { select: { id: true, name: true, type: true } },
      },
    });
    res.json(coops);
  } catch (err) { next(err); }
});

router.post('/', requireModule('sites'), requireAction('sites', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const data = coopSchema.parse(req.body);
    const coop = await prisma.cooperative.create({ data });
    res.status(201).json(coop);
  } catch (err) { next(err); }
});

router.put('/:id', requireModule('sites'), requireAction('sites', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const data = coopSchema.partial().parse(req.body);
    const coop = await prisma.cooperative.update({ where: { id: req.params.id as string }, data });
    res.json(coop);
  } catch (err) { next(err); }
});

router.delete('/:id', requireModule('sites'), requireAction('sites', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.cooperative.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
