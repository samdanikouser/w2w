import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { getAllowedSiteIds } from '../middleware/siteScoping.js';
import { emptyToNull } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']).default('PRESENT'),
  clockIn: emptyToNull,
  clockOut: emptyToNull,
  hoursWorked: z.number().nullish(),
  notes: emptyToNull,
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { employeeId, month } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    // Apply site scoping via employee relationship
    if (req.managedSiteIds && req.managedSiteIds.length > 0) {
      where.employee = { ...where.employee, siteId: { in: req.managedSiteIds } };
    } else if (req.userSiteId) {
      where.employee = { ...where.employee, siteId: req.userSiteId };
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

router.post('/', requireModule('attendance'), requireAction('attendance', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const d = attendanceSchema.parse(req.body);

    // Validate employee belongs to user's site scope
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const employee = await prisma.employee.findUnique({ where: { id: d.employeeId }, select: { siteId: true } });
      if (employee?.siteId && !allowed.includes(employee.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

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

router.delete('/:id', requireModule('attendance'), requireAction('attendance', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.attendance.findUnique({
        where: { id: req.params.id as string },
        select: { employee: { select: { siteId: true } } },
      });
      if (existing?.employee?.siteId && !allowed.includes(existing.employee.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

    await prisma.attendance.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Attendance deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
