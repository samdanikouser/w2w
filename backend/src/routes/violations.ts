import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const violationSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(['VERBAL', 'WRITTEN', 'FINAL_WRITTEN', 'DISMISSAL']).default('VERBAL'),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'CLOSED']).default('OPEN'),
  notes: z.string().default(''),
});

router.get('/', async (_req, res, next) => {
  try {
    const records = await prisma.violation.findMany({
      orderBy: { date: 'desc' },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, empNo: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const d = violationSchema.parse(req.body);
    const v = await prisma.violation.create({
      data: {
        employeeId: d.employeeId,
        date: new Date(d.date),
        type: d.type,
        severity: d.severity as any,
        status: d.status as any,
        notes: d.notes,
        issuedById: req.userId || null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'Violation', entityId: v.id, detail: `${d.severity} — ${d.type}` },
    });
    res.status(201).json(v);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const d = violationSchema.partial().parse(req.body);
    const v = await prisma.violation.update({
      where: { id: req.params.id as string },
      data: {
        ...d,
        date: d.date ? new Date(d.date) : undefined,
        severity: d.severity as any,
        status: d.status as any,
      },
    });
    res.json(v);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.violation.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Violation deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
