import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Audit log is read-only via API (writes happen inside other route handlers)
router.get('/', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req, res, next) => {
  try {
    const { entity, userId, limit = '200' } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const events = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

export default router;
