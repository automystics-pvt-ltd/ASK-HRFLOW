import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query } from '../db.js';
import { reverseGeocode } from './geocode.js';

export type LoginActivityEvent = 'login' | 'logout';
export type LocationStatus = 'granted' | 'denied' | 'unavailable' | 'unsupported' | 'not_requested';

export type LoginLocationPayload = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  locationStatus?: LocationStatus | string | null;
};

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const xf = req.headers['x-forwarded-for'];
  const forwarded = typeof xf === 'string' ? xf.split(',')[0]?.trim() : '';
  const ip = forwarded || (typeof req.ip === 'string' ? req.ip : '') || '';
  return ip && ip !== 'unknown' ? ip.slice(0, 64) : null;
}

function clientUa(req: { headers: Record<string, unknown> }): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' && ua.trim() ? ua.trim().slice(0, 512) : null;
}

function normalizeStatus(raw: unknown, hasCoords: boolean): LocationStatus {
  const s = String(raw || '').toLowerCase();
  if (hasCoords) return 'granted';
  if (s === 'denied' || s === 'unavailable' || s === 'unsupported' || s === 'not_requested' || s === 'granted') {
    return s as LocationStatus;
  }
  return 'not_requested';
}

async function resolveLoginLocation(payload: LoginLocationPayload): Promise<{
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationLabel: string | null;
  locationAddress: string | null;
  locationStatus: LocationStatus;
}> {
  const lat = payload.latitude != null ? Number(payload.latitude) : NaN;
  const lng = payload.longitude != null ? Number(payload.longitude) : NaN;
  const acc = payload.accuracy != null ? Number(payload.accuracy) : NaN;
  const hasCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  if (!hasCoords) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      locationLabel: null,
      locationAddress: null,
      locationStatus: normalizeStatus(payload.locationStatus, false),
    };
  }

  const address = await reverseGeocode(lat, lng);
  return {
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(acc) ? acc : null,
    locationLabel: address ? address.slice(0, 160) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    locationAddress: address,
    locationStatus: 'granted',
  };
}

/** Persist a login/logout activity row. Never throws to the caller. */
export async function recordLoginActivity(opts: {
  req: { ip?: string; headers: Record<string, unknown>; body?: unknown };
  userId: string;
  userName: string;
  event: LoginActivityEvent;
}): Promise<void> {
  try {
    const body = (opts.req.body || {}) as LoginLocationPayload & Record<string, unknown>;
    const loc = await resolveLoginLocation({
      latitude: body.latitude as number | null | undefined,
      longitude: body.longitude as number | null | undefined,
      accuracy: body.accuracy as number | null | undefined,
      locationStatus: body.locationStatus as string | null | undefined,
    });

    await query(
      `INSERT INTO login_activity
        (id, tenant_id, user_id, user_name, event, ip, user_agent,
         latitude, longitude, accuracy, location_label, location_address, location_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        'la-' + uuid().slice(0, 10),
        DEFAULT_TENANT,
        opts.userId,
        opts.userName.slice(0, 120),
        opts.event,
        clientIp(opts.req),
        clientUa(opts.req),
        loc.latitude,
        loc.longitude,
        loc.accuracy,
        loc.locationLabel,
        loc.locationAddress,
        loc.locationStatus,
      ],
    );
  } catch (err) {
    console.warn('login_activity write failed:', err instanceof Error ? err.message : err);
  }
}
