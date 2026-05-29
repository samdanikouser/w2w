import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  code: z.string().min(1),
  item: z.string().min(1),
  category: z.string().default('PPE'),
  uom: z.string().default('each'),
  onHand: z.number().default(0),
  reorderAt: z.number().default(0),
  siteId: emptyToNullUuid,
});

function deriveStatus(onHand: number, reorderAt: number): 'OK' | 'LOW' | 'OUT' {
  if (onHand <= 0) return 'OUT';
  if (onHand <= reorderAt) return 'LOW';
  return 'OK';
}

router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({
      orderBy: { item: 'asc' },
      include: { site: { select: { id: true, name: true } } },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireModule('stock-register'), async (req: AuthRequest, res, next) => {
  try {
    const d = itemSchema.parse(req.body);
    const status = deriveStatus(d.onHand, d.reorderAt);
    const s = await prisma.stockItem.create({
      data: { ...d, siteId: d.siteId || null, status },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'StockItem', entityId: s.id, detail: `Added ${s.item}` },
    });
    res.status(201).json(s);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireModule('stock-register'), async (req: AuthRequest, res, next) => {
  try {
    const d = itemSchema.partial().parse(req.body);
    const existing = await prisma.stockItem.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const onHand = d.onHand ?? existing.onHand;
    const reorderAt = d.reorderAt ?? existing.reorderAt;
    const s = await prisma.stockItem.update({
      where: { id: req.params.id as string },
      data: { ...d, status: deriveStatus(onHand, reorderAt) },
    });
    res.json(s);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireModule('stock-register'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.stockItem.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
