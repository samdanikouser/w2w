import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR']).default('INFO'),
  icon: z.string().default('📌'),
  title: z.string().min(1),
  message: z.string().default(''),
  action: z.string().nullish(),
});

// ── GET /api/notifications ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.userId!,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/notifications/unread-count ──
router.get('/unread-count', async (req: AuthRequest, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId!, read: false },
    });

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/notifications/read-all ──
router.patch('/read-all', async (req: AuthRequest, res, next) => {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.userId!, read: false },
      data: { read: true },
    });

    res.json({ message: 'All notifications marked as read', count });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/notifications/:id/read ──
router.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id as string },
    });

    if (!notification || notification.userId !== req.userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id as string },
      data: { read: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/notifications ──
router.delete('/', async (req: AuthRequest, res, next) => {
  try {
    const { count } = await prisma.notification.deleteMany({
      where: { userId: req.userId!, read: true },
    });

    res.json({ message: 'Read notifications cleared', count });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/notifications/:id ──
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id as string },
    });

    if (!notification || notification.userId !== req.userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/notifications (admin only) ──
router.post('/', requireModule('dashboard'), async (req: AuthRequest, res, next) => {
  try {
    const data = createNotificationSchema.parse(req.body);

    // Broadcast to all active users
    if (data.userId === 'all') {
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const created = await prisma.notification.createMany({
        data: activeUsers.map((u) => ({
          userId: u.id,
          type: data.type as any,
          icon: data.icon,
          title: data.title,
          message: data.message,
          action: data.action ?? null,
        })),
      });

      await prisma.auditLog.create({
        data: {
          userId: req.userId,
          action: 'CREATE',
          entity: 'Notification',
          detail: `Broadcast notification "${data.title}" to ${created.count} users`,
        },
      });

      return res.status(201).json({ message: 'Notification broadcast', count: created.count });
    }

    // Single user notification
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        icon: data.icon,
        title: data.title,
        message: data.message,
        action: data.action ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'CREATE',
        entity: 'Notification',
        entityId: notification.id,
        detail: `Created notification "${data.title}" for user ${data.userId}`,
      },
    });

    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
});

export default router;
