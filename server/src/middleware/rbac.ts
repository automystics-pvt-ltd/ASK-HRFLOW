import type { Request, Response, NextFunction } from 'express';
import type { Action } from '../lib/permissions.js';
import { getFullUser, userCan } from '../lib/users.js';
import { queryOne, DEFAULT_TENANT } from '../db.js';

export function requirePermission(module: string, action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.sub) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    const ok = await userCan(req.user.sub, role, module, action);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/** Employee record: self via linked user_id or HR/admin with employees:read */
export function requireSelfOrPermission(module: string, action: Action, employeeIdParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.sub) return res.status(401).json({ error: 'Unauthorized' });
    const employeeId = Number(req.params[employeeIdParam]);
    if (!Number.isFinite(employeeId)) return res.status(400).json({ error: 'Invalid employee id' });

    const emp = await queryOne<{ user_id: string | null }>(
      'SELECT user_id FROM employees WHERE id = $1 AND tenant_id = $2',
      [employeeId, DEFAULT_TENANT],
    );
    if (!emp) return res.status(404).json({ error: 'Not found' });

    if (emp.user_id === req.user.sub) return next();

    const ok = await userCan(req.user.sub, req.user.role, module, action);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export async function ensureAppUser(req: Request) {
  if (!req.appUser && req.user?.sub) {
    req.appUser = await getFullUser(req.user.sub);
  }
  return req.appUser;
}