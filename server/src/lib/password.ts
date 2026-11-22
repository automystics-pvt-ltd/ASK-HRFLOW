import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 10;
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MINUTES = 15;

/** Cryptographically strong temporary password (never logged). */
export function generateTempPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export type PasswordPolicyResult = { ok: true } | { ok: false; error: string };

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (password.length > 128) {
    return { ok: false, error: 'Password is too long.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: 'Password must include at least one letter and one number.' };
  }
  if (password.toLowerCase() === 'demo123') {
    return { ok: false, error: 'Choose a stronger password than the default demo credential.' };
  }
  return { ok: true };
}

/** Simple in-memory IP throttle for login / forgot-password. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function throttle(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { ok: true };
}
