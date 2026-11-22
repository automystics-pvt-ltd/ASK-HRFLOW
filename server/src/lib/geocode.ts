/**
 * Reverse geocode via OpenStreetMap Nominatim.
 * Never invents place names — returns null on failure/timeout.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '0');

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ASK-HRFlow/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    const name = data?.display_name?.trim();
    return name || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
