import type { AuthLocationPayload } from './api';

/**
 * Optional login/logout GPS stamp. Never blocks auth — denial and timeouts
 * resolve to a status payload without coordinates.
 */
export function captureAuthLocation(timeoutMs = 4000): Promise<AuthLocationPayload> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ locationStatus: 'unsupported' });
      return;
    }
    let settled = false;
    const finish = (payload: AuthLocationPayload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    const timer = window.setTimeout(() => finish({ locationStatus: 'unavailable' }), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        finish({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          locationStatus: 'granted',
        });
      },
      (err) => {
        window.clearTimeout(timer);
        if (err.code === err.PERMISSION_DENIED) finish({ locationStatus: 'denied' });
        else finish({ locationStatus: 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
