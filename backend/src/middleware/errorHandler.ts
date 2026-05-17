import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('❌', err.message);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: (err as any).errors,
    });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    const code = (err as any).code;
    if (code === 'P2002') {
      return res.status(409).json({ error: 'A record with that value already exists.' });
    }
    if (code === 'P2025') {
      return res.status(404).json({ error: 'Record not found.' });
    }
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
}
