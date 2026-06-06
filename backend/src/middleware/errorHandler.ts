import type { Request, Response, NextFunction } from 'express';

// Human-readable field name mapping
const FIELD_LABELS: Record<string, string> = {
  empNo: 'Employee Number',
  email: 'Email Address',
  name: 'Name',
  idNumber: 'ID Number',
  phone: 'Phone Number',
  reference: 'Reference',
};

function friendlyField(raw: string): string {
  return FIELD_LABELS[raw] || raw.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('❌', err.message);

  // ── Zod validation errors ──
  if (err.name === 'ZodError') {
    const issues = (err as any).errors || [];
    const msgs = issues.map((e: any) => {
      const path = e.path?.join(' → ') || 'field';
      return `${friendlyField(path)}: ${e.message}`;
    });
    return res.status(400).json({
      error: msgs.length === 1 ? msgs[0] : `Please fix the following:\n${msgs.join('\n')}`,
      details: issues,
    });
  }

  // ── Prisma known errors ──
  if (err.name === 'PrismaClientKnownRequestError') {
    const code = (err as any).code;
    const meta = (err as any).meta;

    // Unique constraint violation
    if (code === 'P2002') {
      const target = meta?.target;
      const fields = Array.isArray(target) ? target.map(friendlyField).join(', ') : friendlyField(target || 'value');
      return res.status(409).json({ error: `A record with that ${fields} already exists. Please use a different value.` });
    }

    // Record not found
    if (code === 'P2025') {
      const model = meta?.modelName || 'Record';
      return res.status(404).json({ error: `${model} not found. It may have been deleted.` });
    }

    // Foreign key constraint (invalid reference)
    if (code === 'P2003') {
      const field = meta?.field_name || 'reference';
      return res.status(400).json({ error: `Invalid ${friendlyField(field)}. The selected item does not exist. Please refresh and try again.` });
    }

    // Required relation not found
    if (code === 'P2018') {
      return res.status(400).json({ error: 'A required related record was not found. Please check your selections.' });
    }
  }

  // ── Prisma validation errors ──
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      error: 'Invalid data submitted. Please check all fields and try again.',
    });
  }

  // ── Generic fallback ──
  // SECURITY: Only expose err.message in explicit development mode.
  // All other environments (production, staging, undefined) get a safe generic message.
  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong. Please try again or contact support.',
  });
}
