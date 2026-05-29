import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const txSchema = z.object({
  date: z.string().min(1),
  type: z.enum(['REVENUE', 'EXPENSE']),
  category: z.string().default(''),
  description: z.string().default(''),
  amount: z.number(),
  siteId: emptyToNullUuid,
  reference: emptyToNull,
});

// ── GET /api/transactions ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { type, siteId, month } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (type) where.type = type;

    // Enforce Depot-level sandboxing
    if (req.userSiteId) {
      where.siteId = req.userSiteId;
    } else if (siteId) {
      where.siteId = siteId;
    }
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const data = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const totalRevenue = data.filter((t) => t.type === 'REVENUE').reduce((s, t) => s + t.amount, 0);
    const totalExpense = Math.abs(data.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0));

    res.json({
      data,
      total: data.length,
      summary: { totalRevenue, totalExpense, net: totalRevenue - totalExpense },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireModule('pl-register'), async (req: AuthRequest, res, next) => {
  try {
    const d = txSchema.parse(req.body);
    const t = await prisma.transaction.create({
      data: {
        date: new Date(d.date),
        type: d.type as any,
        category: d.category,
        description: d.description,
        amount: d.type === 'EXPENSE' ? -Math.abs(d.amount) : Math.abs(d.amount),
        siteId: d.siteId || null,
        reference: d.reference || null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'Transaction', entityId: t.id, detail: `${t.type} ${t.amount}` },
    });
    res.status(201).json(t);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireModule('pl-register'), async (req: AuthRequest, res, next) => {
  try {
    const d = txSchema.partial().parse(req.body);
    const t = await prisma.transaction.update({
      where: { id: req.params.id as string },
      data: {
        ...d,
        date: d.date ? new Date(d.date) : undefined,
        type: d.type as any,
        amount: d.amount !== undefined
          ? (d.type === 'EXPENSE' ? -Math.abs(d.amount) : Math.abs(d.amount))
          : undefined,
      },
    });
    res.json(t);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireModule('pl-register'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'Transaction', entityId: req.params.id as string },
    });
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
