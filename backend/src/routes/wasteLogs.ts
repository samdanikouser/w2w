import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const logSchema = z.object({
  date: z.string(),
  siteId: z.string().uuid().nullish(),
  wasteTypeId: z.string().uuid().nullish(),
  quantity: z.number().positive(),
  unit: z.string().default('kg'),
  pricePerUnit: z.number().default(0),
  collectorId: z.string().uuid().nullish(),
  notes: z.string().nullish(),
});

// ── GET /api/waste-logs ──
router.get('/', async (req, res, next) => {
  try {
    const { status, siteId, startDate, endDate, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (siteId) where.siteId = siteId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [logs, total] = await Promise.all([
      prisma.wasteLog.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          wasteType: { select: { id: true, name: true, colour: true } },
          collector: { select: { id: true, firstName: true, lastName: true, empNo: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.wasteLog.count({ where }),
    ]);

    // Summary aggregates
    const agg = await prisma.wasteLog.aggregate({
      where,
      _sum: { quantity: true, totalValue: true },
      _count: true,
    });

    res.json({
      data: logs,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      summary: {
        totalEntries: agg._count,
        totalQuantity: agg._sum.quantity || 0,
        totalValue: agg._sum.totalValue || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/waste-logs ──
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = logSchema.parse(req.body);
    const totalValue = data.quantity * data.pricePerUnit;

    const log = await prisma.wasteLog.create({
      data: {
        date: new Date(data.date),
        siteId: data.siteId || null,
        wasteTypeId: data.wasteTypeId || null,
        quantity: data.quantity,
        unit: data.unit,
        pricePerUnit: data.pricePerUnit,
        totalValue,
        collectorId: data.collectorId || null,
        notes: data.notes || null,
        createdById: req.userId,
        status: 'PENDING',
      },
      include: {
        site: { select: { id: true, name: true } },
        wasteType: { select: { id: true, name: true, colour: true } },
        collector: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId, action: 'CREATE', entity: 'WasteLog',
        entityId: log.id, detail: `Logged ${data.quantity} ${data.unit}`,
      },
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/waste-logs/:id/approve ──
router.patch('/:id/approve', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const log = await prisma.wasteLog.update({
      where: { id: req.params.id as string },
      data: { status: 'APPROVED', approvedById: req.userId, approvedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'APPROVE', entity: 'WasteLog', entityId: log.id },
    });

    res.json(log);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/waste-logs/:id/reject ──
router.patch('/:id/reject', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const log = await prisma.wasteLog.update({
      where: { id: req.params.id as string },
      data: { status: 'REJECTED', approvedById: req.userId, approvedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'REJECT', entity: 'WasteLog', entityId: log.id },
    });

    res.json(log);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/waste-logs/:id ──
router.delete('/:id', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.wasteLog.delete({ where: { id: req.params.id as string } });

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'WasteLog', entityId: req.params.id as string },
    });

    res.json({ message: 'Waste log deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
