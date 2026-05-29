import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const coopSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  registrationNumber: z.string().default(''),
  contactPerson: z.string().default(''),
  contactNumber: z.string().default(''),
  totalMembers: z.number().default(0),
  hasBalingMachine: z.boolean().default(false),
  materialPayoutRates: z.any().nullish(),
  dailyTonsRecovered: z.number().default(0),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { siteId } = req.query;
    const where = siteId ? { siteId: String(siteId) } : {};
    const coops = await prisma.cooperative.findMany({ where });
    res.json(coops);
  } catch (err) { next(err); }
});

router.post('/', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    const data = coopSchema.parse(req.body);
    const coop = await prisma.cooperative.create({ data });
    res.status(201).json(coop);
  } catch (err) { next(err); }
});

router.put('/:id', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    const data = coopSchema.partial().parse(req.body);
    const coop = await prisma.cooperative.update({ where: { id: req.params.id }, data });
    res.json(coop);
  } catch (err) { next(err); }
});

router.delete('/:id', requireModule('sites'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.cooperative.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
