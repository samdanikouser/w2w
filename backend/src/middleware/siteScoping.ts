import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

/**
 * Checks if this user is an unrestricted admin.
 * A user is admin ONLY if they have the 'w2w-settings' module (Settings access).
 * All other users are restricted — even if they have no site/depot assignment.
 */
function isAdmin(req: AuthRequest): boolean {
  return !!(req.userModules && req.userModules.includes('w2w-settings'));
}

/**
 * Returns the list of site IDs the user is allowed to access.
 * - Admin (w2w-settings) → [] (empty = unrestricted)
 * - Depot Manager with linked sites → managedSiteIds
 * - Single-site user → [userSiteId]
 * - Non-admin with no assignments → [] (empty = sees nothing, enforced by applySiteScope)
 */
export function getAllowedSiteIds(req: AuthRequest): string[] {
  if (isAdmin(req)) return []; // admin — unrestricted

  if (req.managedSiteIds && req.managedSiteIds.length > 0) {
    // Depot manager with linked sites — include their own siteId too if set
    const ids = [...req.managedSiteIds];
    if (req.userSiteId && !ids.includes(req.userSiteId)) ids.push(req.userSiteId);
    return ids;
  }
  if (req.userDepotId) {
    // Depot manager but NO sites linked yet — they can only see their own site if set
    return req.userSiteId ? [req.userSiteId] : [];
  }
  if (req.userSiteId) {
    return [req.userSiteId];
  }
  return []; // non-admin with no assignments — sees nothing
}

/**
 * Applies site scoping to a Prisma `where` clause based on the user's access level:
 *
 * 1. Admin (w2w-settings) → no filter applied (sees everything)
 * 2. Depot Manager with linked sites → filters to managedSiteIds
 * 3. Depot Manager with NO linked sites → sees nothing (empty match)
 * 4. Single-site user → filters to their assigned siteId
 * 5. Non-admin with no assignment → sees nothing (empty match)
 *
 * @param req - The authenticated request
 * @param where - The Prisma where clause to mutate
 * @param siteIdField - The field name for siteId in the target model (default: 'siteId')
 */
export function applySiteScope(req: AuthRequest, where: any, siteIdField = 'siteId') {
  // Admin users see everything — no filter
  if (isAdmin(req)) return;

  if (req.managedSiteIds && req.managedSiteIds.length > 0) {
    // Depot manager with linked sites
    const ids = [...req.managedSiteIds];
    if (req.userSiteId && !ids.includes(req.userSiteId)) ids.push(req.userSiteId);
    where[siteIdField] = { in: ids };
  } else if (req.userDepotId) {
    // Depot manager but NO sites linked yet → should see nothing
    if (req.userSiteId) {
      where[siteIdField] = req.userSiteId;
    } else {
      where[siteIdField] = { in: [] }; // match nothing
    }
  } else if (req.userSiteId) {
    // Single-site user: filter to their assigned site
    where[siteIdField] = req.userSiteId;
  } else {
    // Non-admin with no site/depot assignment → sees nothing
    where[siteIdField] = { in: [] };
  }
}

/**
 * Middleware: Validates that a siteId in the request body is within the user's scope.
 * Used on POST (create) operations to prevent creating resources outside scope.
 */
export function enforceCreateScope(siteIdField = 'siteId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (isAdmin(req)) return next(); // admin — no restrictions

    const allowed = getAllowedSiteIds(req);
    if (allowed.length === 0) {
      return res.status(403).json({ error: 'You have no sites assigned — cannot create resources' });
    }

    const bodySiteId = req.body?.[siteIdField];
    if (!bodySiteId) return next(); // no siteId in body — let the route handle it

    if (!allowed.includes(bodySiteId)) {
      return res.status(403).json({ error: 'You cannot create resources for this site' });
    }
    next();
  };
}
