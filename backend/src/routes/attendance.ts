import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']).default('PRESENT'),
  clockIn: z.string().nullish(),
  clockOut: z.string().nullish(),
  hoursWorked: z.number().nullish(),
  notes: z.string().nullish(),
});

router.get('/', async (req, res, next) => {
  try {
    const { employeeId, month } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { employee: { select: { id: true, firstName: true, lastName: true, empNo: true } } },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('SUPER_ADMIN', 'SITE_ADMIN', 'DATA_CLERK'), async (req: AuthRequest, res, next) => {
  try {
    const d = attendanceSchema.parse(req.body);
    const r = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: d.employeeId, date: new Date(d.date) } },
      update: {
        status: d.status as any,
        clockIn: d.clockIn ? new Date(d.clockIn) : null,
        clockOut: d.clockOut ? new Date(d.clockOut) : null,
        hoursWorked: d.hoursWorked ?? null,
        notes: d.notes ?? null,
      },
      create: {
        employeeId: d.employeeId,
        date: new Date(d.date),
        status: d.status as any,
        clockIn: d.clockIn ? new Date(d.clockIn) : null,
        clockOut: d.clockOut ? new Date(d.clockOut) : null,
        hoursWorked: d.hoursWorked ?? null,
        notes: d.notes ?? null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'Attendance', entityId: r.id, detail: `${d.status} ${d.date}` },
    });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'SITE_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.attendance.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Attendance deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
