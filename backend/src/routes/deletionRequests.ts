import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const createRequestSchema = z.object({
  reason: z.string().min(1),
  scope: z.string().default('all'),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']),
  notes: z.string().default(''),
});

// ── GET /api/deletion-requests ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.userModules?.includes('w2w-settings');

    const requests = await (prisma as any).deletionRequest.findMany({
      where: isAdmin ? {} : { requestedBy: req.userId! },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/deletion-requests ──
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const reference = `POPIA-${Date.now().toString(36).toUpperCase()}`;

    const request = await (prisma as any).deletionRequest.create({
      data: {
        reference,
        requestedBy: req.userId!,
        reason: data.reason,
        scope: data.scope,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'CREATE',
        entity: 'DeletionRequest',
        entityId: request.id,
        detail: `Created POPIA deletion request ${reference} (scope: ${data.scope})`,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/deletion-requests/:id/status (admin only) ──
router.patch('/:id/status', requireModule('w2w-settings'), async (req: AuthRequest, res, next) => {
  try {
    const { status, notes } = updateStatusSchema.parse(req.body);

    const existing = await (prisma as any).deletionRequest.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Deletion request not found' });
    }

    const updated = await (prisma as any).deletionRequest.update({
      where: { id: req.params.id as string },
      data: {
        status,
        notes,
        ...(status === 'COMPLETED' || status === 'REJECTED'
          ? { processedAt: new Date() }
          : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entity: 'DeletionRequest',
        entityId: updated.id,
        detail: `Updated deletion request ${existing.reference} status to ${status}`,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
