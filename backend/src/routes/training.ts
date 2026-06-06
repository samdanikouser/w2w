import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { getAllowedSiteIds } from '../middleware/siteScoping.js';
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
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employeeTrainings: true } } },
    });
    res.json(modules);
  } catch (err) {
    next(err);
  }
});

router.post('/modules', requireModule('training'), requireAction('training', 'create'), async (req: AuthRequest, res, next) => {
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

router.put('/modules/:id', requireModule('training'), requireAction('training', 'edit'), async (req: AuthRequest, res, next) => {
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

router.delete('/modules/:id', requireModule('training'), requireAction('training', 'delete'), async (req: AuthRequest, res, next) => {
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

// ── Sync modules from Settings ──
// Accepts the full array of training modules from the frontend settings
// and reconciles with the DB (create missing, update existing, deactivate removed)
const syncSchema = z.array(z.object({
  settingsId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().default('MANDATORY'),
}));

router.post('/modules/sync', requireModule('training'), requireAction('training', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const incoming = syncSchema.parse(req.body);
    const existing = await prisma.trainingModule.findMany();

    const existingByName = new Map(existing.map(m => [m.name.toLowerCase(), m]));
    const incomingNames = new Set(incoming.map(m => m.name.toLowerCase()));

    const created: string[] = [];
    const updated: string[] = [];

    // Create or update modules from settings
    for (const mod of incoming) {
      const key = mod.name.toLowerCase();
      const found = existingByName.get(key);
      if (found) {
        // Update type if changed
        if (found.type !== mod.type.toUpperCase()) {
          await prisma.trainingModule.update({
            where: { id: found.id },
            data: { type: mod.type.toUpperCase(), isActive: true },
          });
          updated.push(mod.name);
        } else if (!found.isActive) {
          // Re-activate if it was deactivated
          await prisma.trainingModule.update({
            where: { id: found.id },
            data: { isActive: true },
          });
          updated.push(mod.name);
        }
      } else {
        // Create new
        await prisma.trainingModule.create({
          data: { name: mod.name, type: mod.type.toUpperCase(), description: '', durationHrs: 0, isActive: true },
        });
        created.push(mod.name);
      }
    }

    // Deactivate modules removed from settings (don't delete — they may have records)
    const deactivated: string[] = [];
    for (const ex of existing) {
      if (!incomingNames.has(ex.name.toLowerCase()) && ex.isActive) {
        await prisma.trainingModule.update({ where: { id: ex.id }, data: { isActive: false } });
        deactivated.push(ex.name);
      }
    }

    res.json({ message: 'Sync complete', created, updated, deactivated });
  } catch (err) {
    next(err);
  }
});

// ── Enrolments / Records ──
router.get('/records', async (req: AuthRequest, res, next) => {
  try {
    const where: any = {};
    // Apply site scoping via employee relationship
    if (req.managedSiteIds && req.managedSiteIds.length > 0) {
      where.employee = { ...where.employee, siteId: { in: req.managedSiteIds } };
    } else if (req.userSiteId) {
      where.employee = { ...where.employee, siteId: req.userSiteId };
    }
    const records = await prisma.employeeTraining.findMany({
      where,
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

router.post('/records', requireModule('training'), requireAction('training', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const data = enrolmentSchema.parse(req.body);

    // Validate employee belongs to user's site scope
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { siteId: true } });
      if (employee?.siteId && !allowed.includes(employee.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

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

router.put('/records/:id', requireModule('training'), requireAction('training', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const data = enrolmentSchema.partial().parse(req.body);
    const r = await prisma.employeeTraining.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        status: data.status as any,
        completedDate: data.completedDate !== undefined ? (data.completedDate ? new Date(data.completedDate) : null) : undefined,
        expiryDate: data.expiryDate !== undefined ? (data.expiryDate ? new Date(data.expiryDate) : null) : undefined,
      },
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
});

router.delete('/records/:id', requireModule('training'), requireAction('training', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.employeeTraining.findUnique({
        where: { id: req.params.id as string },
        select: { employee: { select: { siteId: true } } },
      });
      if (existing?.employee?.siteId && !allowed.includes(existing.employee.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this resource' });
      }
    }

    await prisma.employeeTraining.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
