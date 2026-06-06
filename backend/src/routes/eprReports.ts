import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticate, requireModule, requireAction, type AuthRequest } from '../middleware/auth.js';
import { applySiteScope } from '../middleware/siteScoping.js';
import { emptyToNull, emptyToNullUuid } from '../utils/zodHelpers.js';

const router = Router();
router.use(authenticate);

const reportSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  siteId: emptyToNullUuid,
  totalTonnes: z.number().default(0),
  totalRevenue: z.number().default(0),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED_REPORT', 'REJECTED_REPORT']).default('DRAFT'),
  data: z.any().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  buyerConfirmation: z.string().default(''),
  traceabilityRef: z.string().default(''),
});

const INCLUDE_RELATIONS = {
  createdByUser: { select: { id: true, name: true, email: true } },
  approvedByUser: { select: { id: true, name: true, email: true } },
  site: { select: { id: true, name: true, type: true } },
};

// ── GET /api/epr-reports ──
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { year, siteId, status } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (year) where.year = parseInt(year);
    if (status) where.status = status;

    // Enforce Depot-level sandboxing
    applySiteScope(req, where);
    if (!where.siteId && siteId) {
      where.siteId = siteId;
    }
    const reports = await prisma.eprReport.findMany({
      where,
      include: INCLUDE_RELATIONS,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/epr-reports (Create & Submit) ──
router.post('/', requireModule('epr-reports'), requireAction('epr-reports', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const d = reportSchema.parse(req.body);
    const r = await prisma.eprReport.create({
      data: {
        month: d.month,
        year: d.year,
        siteId: d.siteId || null,
        totalTonnes: d.totalTonnes,
        totalRevenue: d.totalRevenue,
        status: d.status as any,
        data: d.data ?? undefined,
        dateFrom: d.dateFrom ? new Date(d.dateFrom) : null,
        dateTo: d.dateTo ? new Date(d.dateTo) : null,
        buyerConfirmation: d.buyerConfirmation,
        traceabilityRef: d.traceabilityRef,
        submittedAt: d.status === 'SUBMITTED' ? new Date() : null,
        createdById: req.userId,
      },
      include: INCLUDE_RELATIONS,
    });
    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'CREATE', entity: 'EprReport', entityId: r.id, detail: `EPR ${r.month}/${r.year}` },
    });

    // Notify approvers (super_admin / site_admin users) about new submission
    if (d.status === 'SUBMITTED') {
      const approvers = await prisma.user.findMany({
        where: {
          isActive: true,
          customRole: {
            modules: { hasSome: ['epr-reports:approve'] },
          },
        },
        select: { id: true },
      });
      if (approvers.length > 0) {
        await prisma.notification.createMany({
          data: approvers.map(u => ({
            id: crypto.randomUUID(),
            userId: u.id,
            type: 'INFO' as any,
            icon: '📋',
            title: 'New EPR Report Submitted',
            message: `EPR report for ${r.month}/${r.year} has been submitted and requires your approval.`,
            action: '/epr-reports',
          })),
        });
      }
    }

    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/epr-reports/:id (Edit own draft/rejected reports) ──
router.put('/:id', requireModule('epr-reports'), requireAction('epr-reports', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    // Only allow editing own DRAFT or REJECTED reports
    const existing = await prisma.eprReport.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });
    if (existing.createdById !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own reports' });
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED_REPORT') {
      return res.status(400).json({ error: 'Only DRAFT or REJECTED reports can be edited' });
    }

    const d = reportSchema.partial().parse(req.body);
    const r = await prisma.eprReport.update({
      where: { id: req.params.id as string },
      data: {
        ...d,
        dateFrom: d.dateFrom ? new Date(d.dateFrom) : undefined,
        dateTo: d.dateTo ? new Date(d.dateTo) : undefined,
        status: d.status as any,
        submittedAt: d.status === 'SUBMITTED' ? new Date() : undefined,
        // Clear rejection fields when resubmitting
        ...(d.status === 'SUBMITTED' ? { rejectedReason: null, approvedById: null, approvedAt: null } : {}),
      },
      include: INCLUDE_RELATIONS,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/epr-reports/:id/approve ──
router.patch('/:id/approve', requireModule('epr-reports'), requireAction('epr-reports', 'approve'), async (req: AuthRequest, res, next) => {
  try {
    const report = await prisma.eprReport.findUnique({ where: { id: req.params.id as string } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED reports can be approved' });
    }
    // Prevent self-approval
    if (report.createdById === req.userId) {
      return res.status(403).json({ error: 'You cannot approve your own report' });
    }

    const r = await prisma.eprReport.update({
      where: { id: req.params.id as string },
      data: {
        status: 'APPROVED_REPORT',
        approvedById: req.userId,
        approvedAt: new Date(),
        rejectedReason: null,
      },
      include: INCLUDE_RELATIONS,
    });

    // Notify the creator
    if (report.createdById) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: report.createdById,
          type: 'SUCCESS' as any,
          icon: '✅',
          title: 'EPR Report Approved',
          message: `Your EPR report for ${report.month}/${report.year} has been approved.`,
          action: '/epr-reports',
        },
      });
    }

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'EprReport', entityId: r.id, detail: `Approved EPR ${r.month}/${r.year}` },
    });

    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/epr-reports/:id/reject ──
router.patch('/:id/reject', requireModule('epr-reports'), requireAction('epr-reports', 'approve'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'A rejection reason is required' });
    }

    const report = await prisma.eprReport.findUnique({ where: { id: req.params.id as string } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED reports can be rejected' });
    }
    if (report.createdById === req.userId) {
      return res.status(403).json({ error: 'You cannot reject your own report' });
    }

    const r = await prisma.eprReport.update({
      where: { id: req.params.id as string },
      data: {
        status: 'REJECTED_REPORT',
        approvedById: req.userId, // reviewer
        approvedAt: new Date(),
        rejectedReason: reason.trim(),
      },
      include: INCLUDE_RELATIONS,
    });

    // Notify the creator
    if (report.createdById) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: report.createdById,
          type: 'WARNING' as any,
          icon: '❌',
          title: 'EPR Report Rejected',
          message: `Your EPR report for ${report.month}/${report.year} was rejected. Reason: ${reason.trim()}`,
          action: '/epr-reports',
        },
      });
    }

    await prisma.auditLog.create({
      data: { userId: req.userId, action: 'UPDATE', entity: 'EprReport', entityId: r.id, detail: `Rejected EPR ${r.month}/${r.year}: ${reason.trim()}` },
    });

    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/epr-reports/:id ──
router.delete('/:id', requireModule('epr-reports'), requireAction('epr-reports', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.eprReport.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
