import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { applySiteScope, enforceCreateScope, getAllowedSiteIds } from '../middleware/siteScoping.js';
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
  unitCost: z.number().default(0),
  size: z.string().default(''),
  supplier: z.string().default(''),
  notes: z.string().default(''),
  serial: z.string().default(''),
  condition: z.string().default('Good'),
  assignedTo: z.string().default(''),
  assignedSite: z.string().default(''),
});

function deriveStatus(onHand: number, reorderAt: number): 'OK' | 'LOW' | 'OUT' {
  if (onHand <= 0) return 'OUT';
  if (onHand <= reorderAt) return 'LOW';
  return 'OK';
}

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const where: any = {};
    applySiteScope(req, where);
    // Also include items with no site assigned (unassigned stock)
    if (where.siteId) {
      where.OR = [{ siteId: where.siteId }, { siteId: null }];
      delete where.siteId;
    }
    const items = await prisma.stockItem.findMany({
      where,
      orderBy: { item: 'asc' },
      include: { site: { select: { id: true, name: true } } },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireModule('stock-register'), requireAction('stock-register', 'create'), enforceCreateScope(), async (req: AuthRequest, res, next) => {
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

router.put('/:id', requireModule('stock-register'), requireAction('stock-register', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const d = itemSchema.partial().parse(req.body);
    const existing = await prisma.stockItem.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0 && existing.siteId && !allowed.includes(existing.siteId)) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }
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

router.delete('/:id', requireModule('stock-register'), requireAction('stock-register', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.stockItem.findUnique({ where: { id: req.params.id as string }, select: { siteId: true } });
      if (existing?.siteId && !allowed.includes(existing.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

    await prisma.stockItem.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
