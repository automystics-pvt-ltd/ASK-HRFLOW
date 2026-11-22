import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { LogIn, LogOut, MapPin, Lock, Loader2, AlertCircle, Timer } from 'lucide-react';

interface Stamp {
  time: string; // ISO
  lat: number;
  lng: number;
  accuracy: number;
}
interface Entry {
  date: string; // yyyy-mm-dd
  checkIn: Stamp;
  checkOut?: Stamp;
}

const KEY = 'hrflow.timesheet.v1';
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const fmtDur = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

function getLocation(): Promise<Stamp> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          time: new Date().toISOString(),
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Location permission is required. Allow location access in your browser and try again.'
              : 'Could not get your location. Please try again.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function LocationLink({ s }: { s: Stamp }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      <MapPin className="w-3 h-3" />
      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
    </a>
  );
}

export function Timesheet() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }, [entries]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const today = entries.find((e) => e.date === dayKey());
  const state: 'idle' | 'in' | 'done' = !today ? 'idle' : today.checkOut ? 'done' : 'in';

  // Entries are append-only: a stamp can be written once and is never editable.
  const punch = async () => {
    if (busy || state === 'done') return;
    setBusy(true);
    setError('');
    try {
      const stamp = await getLocation();
      setEntries((prev) => {
        const k = dayKey();
        const cur = prev.find((e) => e.date === k);
        if (!cur) return [{ date: k, checkIn: stamp }, ...prev];
        if (cur.checkOut) return prev;
        return prev.map((e) => (e.date === k ? { ...e, checkOut: stamp } : e));
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          My Timesheet
        </CardTitle>
        <Badge variant="secondary" className="gap-1">
          <Lock className="w-3 h-3" /> Locked once recorded
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-2xl font-medium">
              {state === 'idle' && 'Not checked in'}
              {state === 'in' && `Working · ${fmtDur(now - new Date(today!.checkIn.time).getTime())}`}
              {state === 'done' &&
                `Done · ${fmtDur(new Date(today!.checkOut!.time).getTime() - new Date(today!.checkIn.time).getTime())}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Your location is captured automatically when you check in or out.
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2 w-full sm:w-auto"
            variant={state === 'in' ? 'destructive' : 'default'}
            disabled={busy || state === 'done'}
            onClick={punch}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'in' ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {busy ? 'Getting location…' : state === 'idle' ? 'Check In' : state === 'in' ? 'Check Out' : 'Completed for today'}
          </Button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Check in</th>
                  <th className="py-2 pr-4 font-medium">Check out</th>
                  <th className="py-2 pr-4 font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.date} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {new Date(e.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{fmtTime(e.checkIn.time)}</div>
                      <LocationLink s={e.checkIn} />
                    </td>
                    <td className="py-3 pr-4">
                      {e.checkOut ? (
                        <>
                          <div className="font-medium">{fmtTime(e.checkOut.time)}</div>
                          <LocationLink s={e.checkOut} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">In progress</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {e.checkOut ? fmtDur(new Date(e.checkOut.time).getTime() - new Date(e.checkIn.time).getTime()) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No timesheet entries yet. Check in to start today.</p>
        )}
      </CardContent>
    </Card>
  );
}
