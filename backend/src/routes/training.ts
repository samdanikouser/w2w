import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';
import { emptyToNull } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const moduleSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  type: z.string().default('MANDATORY'),
  durationHrs: z.number().default(0),
  isActive: z.boolean().default(true),
});

const enrolmentSchema = z.object({
  employeeId: z.string().min(1),
  trainingModuleId: z.string().min(1),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED']).default('NOT_STARTED'),
  completedDate: emptyToNull,
  expiryDate: emptyToNull,
  score: z.number().nullish(),
});

// ── Modules ──
router.get('/modules', async (_req, res, next) => {
  try {
    const modules = await prisma.trainingModule.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employeeTrainings: true } } },
    });
    res.json(modules);
  } catch (err) {
    next(err);
  }
});

router.post('/modules', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    const data = moduleSchema.parse(req.body);
    const m = await prisma.trainingModule.create({ data });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'TrainingModule', entityId: m.id, detail: `Added module ${m.name}` },
    });
    res.status(201).json(m);
  } catch (err) {
    next(err);
  }
});

router.put('/modules/:id', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    const data = moduleSchema.partial().parse(req.body);
    const m = await prisma.trainingModule.update({ where: { id: req.params.id as string }, data });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'TrainingModule', entityId: m.id, detail: `Updated module ${m.name}` },
    });
    res.json(m);
  } catch (err) {
    next(err);
  }
});

router.delete('/modules/:id', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.trainingModule.delete({ where: { id: req.params.id as string } });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'DELETE', entity: 'TrainingModule', entityId: req.params.id as string },
    });
    res.json({ message: 'Module deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Enrolments / Records ──
router.get('/records', async (_req, res, next) => {
  try {
    const records = await prisma.employeeTraining.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, empNo: true } },
        trainingModule: { select: { id: true, name: true, durationHrs: true } },
      },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

router.post('/records', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    const data = enrolmentSchema.parse(req.body);
    const r = await prisma.employeeTraining.create({
      data: {
        employeeId: data.employeeId,
        trainingModuleId: data.trainingModuleId,
        status: data.status as any,
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        score: data.score ?? null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'EmployeeTraining', entityId: r.id, detail: 'Training enrolment created' },
    });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

router.put('/records/:id', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    const data = enrolmentSchema.partial().parse(req.body);
    const r = await prisma.employeeTraining.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        status: data.status as any,
        completedDate: data.completedDate ? new Date(data.completedDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
});

router.delete('/records/:id', requireModule('training'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.employeeTraining.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
