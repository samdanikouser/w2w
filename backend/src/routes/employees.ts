import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { applySiteScope, enforceCreateScope, getAllowedSiteIds } from '../middleware/siteScoping.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const employeeSchema = z.object({
  empNo: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  idNumber: z.string().default(''),
  role: z.string().default(''),
  department: z.string().default(''),
  siteId: emptyToNullUuid,
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']).default('ACTIVE'),
  email: z.string().default(''),
  phone: z.string().default(''),
  startDate: emptyToNull,
  dailyRate: z.number().default(0),
  bankName: z.string().default(''),
  bankAccount: z.string().default(''),
  bankBranch: z.string().default(''),
  // Personal extended
  dateOfBirth: emptyToNull,
  gender: emptyToNull,
  race: emptyToNull,
  nationality: z.string().default('South African'),
  disability: z.string().default('None'),
  bloodGroup: emptyToNull,
  // EPWP
  epwpRefNo: emptyToNull,
  epwpEnrolmentDate: emptyToNull,
  epwpYouth: z.boolean().default(false),
  // Remuneration
  stipend: z.number().default(0),
  serviceFee: z.number().default(0),
  attendancePct: z.number().default(0),
  // Exit
  exitDate: emptyToNull,
  exitReason: emptyToNull,
  // Income Uplift
  incomeBeforeW2W: z.number().default(0),
  // Contact
  currentAddress: emptyToNull,
  permanentAddress: emptyToNull,
  // Emergency Contact
  emergencyName: emptyToNull,
  emergencyRelationship: emptyToNull,
  emergencyPhone: emptyToNull,
  // System Access
  customRoleId: emptyToNull,
  loginPassword: emptyToNull,
  // Onboarding
  onboardStatus: z.string().default('Pending'),
  uniformIssued: z.boolean().default(false),
  ppeIssued: z.boolean().default(false),
  trainingComplete: z.number().int().default(0),
  // Vehicle Licence (SA)
  licenceCode: z.string().default(''),
  licenceNumber: z.string().default(''),
  licenceExpiry: emptyToNull,
  hasPrDP: z.boolean().default(false),
  prdpExpiry: emptyToNull,
  // Photo
  photo: z.string().nullish().transform(v => v || null),
});

// ── GET /api/employees ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { search, status, siteId, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    // Enforce Depot-level sandboxing
    applySiteScope(req, where);
    if (!where.siteId && siteId) {
      where.siteId = siteId;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { empNo: { contains: search as string, mode: 'insensitive' } },
        { department: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          trainings: {
            include: { trainingModule: { select: { id: true, name: true, type: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({ data: employees, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/employees/:id ──
router.get('/:id', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id as string },
      include: { site: true, trainings: { include: { trainingModule: true } } },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/employees ──
router.post('/', requireModule('employees'), requireAction('employees', 'create'), enforceCreateScope(), async (req: AuthRequest, res, next) => {
  try {
    const { customRoleId, loginPassword, ...data } = employeeSchema.parse(req.body);

    // Auto-generate sequential empNo: W2W-001, W2W-002, etc.
    const lastEmp = await prisma.employee.findFirst({
      where: { empNo: { startsWith: 'W2W-' } },
      orderBy: { empNo: 'desc' },
      select: { empNo: true },
    });
    let nextNum = 1;
    if (lastEmp?.empNo) {
      const match = lastEmp.empNo.match(/W2W-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const empNo = `W2W-${String(nextNum).padStart(3, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        ...data,
        empNo,
        siteId: data.siteId || req.userSiteId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        status: data.status as any,
      },
      include: { site: { select: { id: true, name: true } } },
    });

    if (customRoleId && loginPassword && data.email) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash(loginPassword, 12);
      await prisma.user.create({
        data: {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email.toLowerCase(),
          passwordHash,
          siteId: data.siteId || null,
          customRoleId,
          isActive: true,
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'CREATE',
        entity: 'Employee',
        entityId: employee.id,
        detail: `Created employee ${employee.empNo}`,
      },
    });

    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/employees/:id ──
router.put('/:id', requireModule('employees'), requireAction('employees', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.employee.findUnique({ where: { id: req.params.id as string }, select: { siteId: true } });
      if (existing?.siteId && !allowed.includes(existing.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this employee' });
      }
    }
    const { customRoleId, loginPassword, ...data } = employeeSchema.partial().parse(req.body);

    const employee = await prisma.employee.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        siteId: data.siteId !== undefined ? (data.siteId || null) : undefined,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
        status: data.status as any,
      },
      include: { site: { select: { id: true, name: true } } },
    });

    if (customRoleId && loginPassword && data.email) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash(loginPassword, 12);
      
      const existingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
      if (existingUser) {
        await prisma.user.update({
          where: { email: data.email.toLowerCase() },
          data: {
            customRoleId,
            passwordHash
          }
        });
      } else {
        await prisma.user.create({
          data: {
            name: `${employee.firstName} ${employee.lastName}`,
            email: data.email.toLowerCase(),
            passwordHash,
            siteId: employee.siteId || null,
            customRoleId,
            isActive: true,
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entity: 'Employee',
        entityId: employee.id,
        detail: `Updated employee ${employee.empNo}`,
      },
    });

    res.json(employee);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/employees/:id ──
router.delete('/:id', requireModule('employees'), requireAction('employees', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = getAllowedSiteIds(req);
    if (allowed.length > 0) {
      const existing = await prisma.employee.findUnique({ where: { id: req.params.id as string }, select: { siteId: true } });
      if (existing?.siteId && !allowed.includes(existing.siteId)) {
        return res.status(403).json({ error: 'You do not have access to this employee' });
      }
    }
    const employee = await prisma.employee.delete({ where: { id: req.params.id as string } });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'DELETE',
        entity: 'Employee',
        entityId: employee.id,
        detail: `Deleted employee ${employee.empNo}`,
      },
    });

    res.json({ message: 'Employee deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
