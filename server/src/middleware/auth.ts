import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../lib/permissions.js';
import type { PermissionSet } from '../lib/permissions.js';
import { getFullUser } from '../lib/users.js';

export const COOKIE = 'hrflow_token';

export interface AuthUser {
  sub: string;
  role: Role;
  email: string;
  name?: string;
  permissions?: PermissionSet;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
      appUser?: Awaited<ReturnType<typeof getFullUser>>;
    }
  }
}

export function signToken(payload: { id: string; role: Role; email: string }, rememberMe = false) {
  return jwt.sign(
    { sub: payload.id, role: payload.role, email: payload.email },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: rememberMe ? '30d' : '12h' },
  );
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me') as AuthUser;
    req.user = { sub: decoded.sub, role: decoded.role, email: decoded.email };
    next();
  } catch {
    res.clearCookie(COOKIE);
    req.user = null;
    next();
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.sub) {
    req.appUser = await getFullUser(req.user.sub);
    if (req.appUser?.permissions) req.user.permissions = req.appUser.permissions;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.sub) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export function setAuthCookie(res: Response, token: string, rememberMe = false) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
