import React, { useCallback, useEffect, useState } from 'react';
import { attendanceApi, timesheetsApi } from '../lib/api';
import { useAccess } from '../lib/access';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LogIn, LogOut, MapPin, Lock, Loader2, AlertCircle, Timer, CalendarDays, Plus, Send, Check, X } from 'lucide-react';

interface Stamp {
  time: string; // ISO
  lat: number;
  lng: number;
  accuracy: number;
  address?: string | null;
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
  const label = s.address?.trim() || null;
  return (
    <a
      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1 text-primary hover:underline max-w-[220px]"
      title={label || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
    >
      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
      <span className="line-clamp-2 text-left">
        {label || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}
      </span>
    </a>
  );
}

type WeeklySheet = {
  id: number;
  weekStart: string;
  status: string;
  totalHours: number;
  userId?: string;
};

function mapSheet(row: Record<string, unknown>): WeeklySheet {
  return {
    id: Number(row.id),
    weekStart: String(row.week_start ?? row.weekStart ?? '').slice(0, 10),
    status: String(row.status ?? 'draft'),
    totalHours: Number(row.total_hours ?? row.totalHours ?? 0),
    userId: row.user_id != null ? String(row.user_id) : row.userId != null ? String(row.userId) : undefined,
  };
}

function WeeklyTimesheets() {
  const { can, user } = useAccess();
  const canApprove = can('attendance', 'approve');
  const [sheets, setSheets] = useState<WeeklySheet[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dayEntries, setDayEntries] = useState<{ workDate: string; hours: number; notes?: string }[]>([]);
  const [entryForm, setEntryForm] = useState({ workDate: dayKey(), hours: '8' });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    timesheetsApi
      .list()
      .then(({ timesheets }) => setSheets((timesheets ?? []).map(mapSheet)))
      .catch(() => toast.error('Could not load weekly timesheets'));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId == null) {
      setDayEntries([]);
      return;
    }
    timesheetsApi
      .get(selectedId)
      .then(({ entries }) =>
        setDayEntries(
          (entries ?? []).map((e) => ({
            workDate: String(e.work_date ?? e.workDate ?? '').slice(0, 10),
            hours: Number(e.hours ?? 0),
            notes: e.notes != null ? String(e.notes) : undefined,
          })),
        ),
      )
      .catch(() => setDayEntries([]));
  }, [selectedId]);

  const createWeek = async () => {
    setLoading(true);
    try {
      const { id } = await timesheetsApi.create();
      toast.success('Week timesheet created');
      refresh();
      setSelectedId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create week');
    } finally {
      setLoading(false);
    }
  };

  const addHours = async () => {
    if (selectedId == null) return;
    const hours = Number(entryForm.hours);
    if (!entryForm.workDate || Number.isNaN(hours) || hours <= 0) {
      toast.error('Enter a valid date and hours');
      return;
    }
    try {
      await timesheetsApi.addEntry(selectedId, { workDate: entryForm.workDate, hours });
      toast.success('Hours saved');
      const { entries, timesheet } = await timesheetsApi.get(selectedId);
      setDayEntries(
        (entries ?? []).map((e) => ({
          workDate: String(e.work_date ?? e.workDate ?? '').slice(0, 10),
          hours: Number(e.hours ?? 0),
        })),
      );
      setSheets((prev) =>
        prev.map((s) =>
          s.id === selectedId
            ? { ...s, totalHours: Number((timesheet as Record<string, unknown>).total_hours ?? (timesheet as Record<string, unknown>).totalHours ?? s.totalHours) }
            : s,
        ),
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add hours');
    }
  };

  const submitSheet = async (id: number) => {
    try {
      await timesheetsApi.submit(id);
      toast.success('Timesheet submitted');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    }
  };

  const reviewSheet = async (id: number, approve: boolean) => {
    try {
      await timesheetsApi.approve(id, approve);
      toast.success(approve ? 'Timesheet approved' : 'Timesheet rejected');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    }
  };

  const selected = sheets.find((s) => s.id === selectedId);
  const mineDraft = selected && selected.status === 'draft' && (!selected.userId || selected.userId === user?.id);

  return (
    <Card className="border border-border rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Weekly timesheets
        </CardTitle>
        <Button size="sm" className="gap-1" disabled={loading} onClick={() => void createWeek()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create week
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {sheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No weekly timesheets yet. Create this week to log hours.</p>
        ) : (
          <div className="space-y-2">
            {sheets.map((s) => (
              <div
                key={s.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border/50 ${selectedId === s.id ? 'bg-primary/5 border-primary/30' : ''}`}
              >
                <button type="button" className="text-left min-w-0" onClick={() => setSelectedId(s.id)}>
                  <p className="font-medium">
                    Week of{' '}
                    {s.weekStart
                      ? new Date(s.weekStart + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.totalHours}h total</p>
                </button>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Badge variant="secondary" className="capitalize">
                    {s.status}
                  </Badge>
                  {s.status === 'draft' && (!s.userId || s.userId === user?.id) && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => void submitSheet(s.id)}>
                      <Send className="w-3 h-3" /> Submit
                    </Button>
                  )}
                  {s.status === 'submitted' && canApprove && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => void reviewSheet(s.id, false)}>
                        <X className="w-3 h-3" /> Reject
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => void reviewSheet(s.id, true)}>
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && mineDraft && (
          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <p className="text-sm font-medium">Add hours</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="ts-date">Date</Label>
                <Input
                  id="ts-date"
                  type="date"
                  value={entryForm.workDate}
                  onChange={(e) => setEntryForm((f) => ({ ...f, workDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-hours">Hours</Label>
                <Input
                  id="ts-hours"
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={entryForm.hours}
                  onChange={(e) => setEntryForm((f) => ({ ...f, hours: e.target.value }))}
                />
              </div>
              <Button onClick={() => void addHours()}>Save entry</Button>
            </div>
            {dayEntries.length > 0 && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                {dayEntries.map((e) => (
                  <li key={e.workDate}>
                    {e.workDate}: <span className="text-foreground font-medium">{e.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
      const k = dayKey();
      const cur = entries.find((e) => e.date === k);
      try {
        const res = !cur
          ? await attendanceApi.checkIn({ latitude: stamp.lat, longitude: stamp.lng, accuracy: stamp.accuracy })
          : await attendanceApi.checkOut({ latitude: stamp.lat, longitude: stamp.lng, accuracy: stamp.accuracy });
        const address = res.locationAddress ?? res.location ?? null;
        const stamped = { ...stamp, address };
        setEntries((prev) => {
          const existing = prev.find((e) => e.date === k);
          if (!existing) return [{ date: k, checkIn: stamped }, ...prev];
          if (existing.checkOut) return prev;
          return prev.map((e) => (e.date === k ? { ...e, checkOut: stamped } : e));
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Attendance sync failed');
        throw e;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <WeeklyTimesheets />
    </div>
  );
}
