import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';
import { emptyToNull } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const reportSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  siteId: emptyToNull,
  totalTonnes: z.number().default(0),
  totalRevenue: z.number().default(0),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED_REPORT', 'REJECTED_REPORT']).default('DRAFT'),
  data: z.any().nullish(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { year, siteId } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (year) where.year = parseInt(year);

    // Enforce Depot-level sandboxing
    if (req.userSiteId) {
      where.siteId = req.userSiteId;
    } else if (siteId) {
      where.siteId = siteId;
    }
    const reports = await prisma.eprReport.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireModule('epr-reports'), async (req: AuthRequest, res, next) => {
  try {
    const d = reportSchema.parse(req.body);
    const r = await prisma.eprReport.create({
      data: {
        month: d.month,
        year: d.year,
        siteId: d.siteId || null,
        totalTonnes: d.totalTonnes,
        totalRevenue: d.totalRevenue,
        status: d.status as any,
        data: d.data ?? undefined,
        submittedAt: d.status === 'SUBMITTED' ? new Date() : null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'EprReport', entityId: r.id, detail: `EPR ${r.month}/${r.year}` },
    });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireModule('epr-reports'), async (req: AuthRequest, res, next) => {
  try {
    const d = reportSchema.partial().parse(req.body);
    const r = await prisma.eprReport.update({
      where: { id: req.params.id as string },
      data: {
        ...d,
        status: d.status as any,
        submittedAt: d.status === 'SUBMITTED' ? new Date() : undefined,
      },
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireModule('epr-reports'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.eprReport.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
