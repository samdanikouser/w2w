import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userModules?: string[];
  userSiteId?: string | null;
  userDepotId?: string | null;
  managedSiteIds?: string[];
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
      modules: string[];
      siteId: string | null;
      depotId?: string | null;
      managedSiteIds?: string[];
    };
    req.userId = payload.userId;
    req.userModules = payload.modules || [];
    req.userSiteId = payload.siteId || null;
    req.userDepotId = payload.depotId || null;
    req.managedSiteIds = payload.managedSiteIds || [];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireModule(...modules: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userModules) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    // Allow access if the user has ANY of the required modules
    const hasAccess = modules.some(m => req.userModules!.includes(m));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Checks that the user has a specific action permission for a module.
 * E.g. requireAction('employees', 'create') checks for 'employees:create' in userModules.
 */
export function requireAction(module: string, action: 'create' | 'edit' | 'delete' | 'approve') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perm = `${module}:${action}`;
    if (!req.userModules?.includes(perm)) {
      return res.status(403).json({
        error: `You do not have permission to ${action} in this module`,
        code: 'PERMISSION_DENIED',
      });
    }
    next();
  };
}
