import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { emptyToNull } from '../utils/zodHelpers.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const depotSchema = z.object({
  name: z.string().min(1),
  regionCode: z.string().default('A'),
  physicalAddress: z.string().default(''),
  managerUserId: emptyToNull,
  totalFleetCount: z.number().default(0),
  totalCompactorTrucks: z.number().default(0),
  totalSkipLoaderTrucks: z.number().default(0),
  operatingBudget: z.number().default(0),
  operationalStatus: z.string().default('active'),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { regionCode } = req.query;
    const where = regionCode ? { regionCode: String(regionCode) } : {};
    const depots = await prisma.depot.findMany({ where, include: { sites: true } });
    res.json(depots);
  } catch (err) { next(err); }
});

router.post('/', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    const data = depotSchema.parse(req.body);
    const depot = await prisma.depot.create({ data });
    res.status(201).json(depot);
  } catch (err) { next(err); }
});

router.put('/:id', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    const data = depotSchema.partial().parse(req.body);
    const depot = await prisma.depot.update({ where: { id: req.params.id }, data });
    res.json(depot);
  } catch (err) { next(err); }
});

router.delete('/:id', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.depot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
