import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const employeeSchema = z.object({
  empNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  idNumber: z.string().default(''),
  role: z.string().default(''),
  department: z.string().default(''),
  siteId: z.string().uuid().nullish(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']).default('ACTIVE'),
  email: z.string().default(''),
  phone: z.string().default(''),
  startDate: z.string().nullish(),
  dailyRate: z.number().default(0),
  bankName: z.string().default(''),
  bankAccount: z.string().default(''),
  bankBranch: z.string().default(''),
  // Personal extended
  dateOfBirth: z.string().nullish(),
  gender: z.string().nullish(),
  race: z.string().nullish(),
  nationality: z.string().default('South African'),
  disability: z.string().default('None'),
  bloodGroup: z.string().nullish(),
  // EPWP
  epwpRefNo: z.string().nullish(),
  epwpEnrolmentDate: z.string().nullish(),
  epwpYouth: z.boolean().default(false),
  // Remuneration
  stipend: z.number().default(0),
  serviceFee: z.number().default(0),
  attendancePct: z.number().default(0),
  // Exit
  exitDate: z.string().nullish(),
  exitReason: z.string().nullish(),
  // Income Uplift
  incomeBeforeW2W: z.number().default(0),
  // Contact
  currentAddress: z.string().nullish(),
  permanentAddress: z.string().nullish(),
  // Emergency Contact
  emergencyName: z.string().nullish(),
  emergencyRelationship: z.string().nullish(),
  emergencyPhone: z.string().nullish(),
  // System Access
  customRoleId: z.string().nullish(),
  loginPassword: z.string().nullish(),
  // Onboarding
  onboardStatus: z.string().default('Pending'),
  uniformIssued: z.boolean().default(false),
  ppeIssued: z.boolean().default(false),
  trainingComplete: z.number().int().default(0),
});

// ── GET /api/employees ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { search, status, siteId, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    // Enforce Depot-level sandboxing
    if (req.userSiteId) {
      where.siteId = req.userSiteId;
    } else if (siteId) {
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
        include: { site: { select: { id: true, name: true } } },
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
router.post('/', requireModule('employees'), async (req: AuthRequest, res, next) => {
  try {
    const { customRoleId, loginPassword, ...data } = employeeSchema.parse(req.body);

    const employee = await prisma.employee.create({
      data: {
        ...data,
        siteId: data.siteId || null,
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
router.put('/:id', requireModule('employees'), async (req: AuthRequest, res, next) => {
  try {
    const { customRoleId, loginPassword, ...data } = employeeSchema.partial().parse(req.body);

    const employee = await prisma.employee.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        siteId: data.siteId || undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
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
router.delete('/:id', requireModule('employees'), async (req: AuthRequest, res, next) => {
  try {
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
