import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Resolves the JWT secret with a hard-fail in production if not set.
 * Cached at module load so we fail fast on boot.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ JWT_SECRET must be set (>= 32 chars) in production. Refusing to start.');
      process.exit(1);
    }
    console.warn('⚠️  JWT_SECRET not set or too short. Using dev fallback — DO NOT USE IN PRODUCTION.');
    return 'dev-secret-do-not-use-in-production-at-all-32+chars';
  }
  return secret;
}
const JWT_SECRET = getJwtSecret();
export { JWT_SECRET };

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
