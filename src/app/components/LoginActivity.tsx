import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAccess } from '../lib/access';
import { loginActivityApi, type LoginActivityRow } from '../lib/api';
import { Download, Filter, History, MapPin, Search } from 'lucide-react';

function locationStatusLabel(status: string) {
  switch (status) {
    case 'granted':
      return 'Shared';
    case 'denied':
      return 'Permission denied';
    case 'unsupported':
      return 'Not supported';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Not captured';
  }
}

export function LoginActivityPage() {
  const { can, user } = useAccess();
  const [q, setQ] = useState('');
  const [event, setEvent] = useState('all');
  const [userId, setUserId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<LoginActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [users, setUsers] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    void loginActivityApi
      .list(400, {
        q: q || undefined,
        event: event !== 'all' ? event : undefined,
        userId: userId !== 'all' ? userId : undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => {
        setRows(res.activity ?? []);
        setTotal(Number(res.total ?? res.activity?.length ?? 0));
        if (res.timezone) setTimezone(res.timezone);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void loginActivityApi
      .facets()
      .then((f) => setUsers(f.users ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtParts = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-IN', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString('en-IN', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      timeZone: timezone,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

  const exportCsv = () => {
    const csv = [
      'Time,Timezone,Employee,Event,Location,Location status,Accuracy (m),IP,User agent',
      ...rows.map((r) =>
        [
          r.ts,
          timezone,
          r.userName,
          r.event,
          r.locationAddress || r.locationLabel || '',
          r.locationStatus,
          r.accuracy != null ? String(Math.round(r.accuracy)) : '',
          r.ip ?? '',
          r.userAgent ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'login-activity.csv';
    a.click();
  };

  const scopeHint =
    user?.role === 'manager'
      ? 'Your assigned team only'
      : user?.role === 'hr' || user?.role === 'admin'
        ? 'All employees'
        : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Login Activity</h1>
          <p className="text-muted-foreground">
            Employee login / logout history
            {scopeHint ? ` · ${scopeHint}` : ''} · {total} record(s) · {timezone}
          </p>
        </div>
        {can('login-activity', 'export') && (
          <Button variant="outline" className="gap-2 self-start" onClick={exportCsv} disabled={!rows.length}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Search & filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div className="space-y-1 sm:col-span-2 xl:col-span-2 min-w-0">
            <Label className="text-xs" htmlFor="login-activity-search">
              Search
            </Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="login-activity-search"
                className="pl-9"
                placeholder="Search employee, location, IP…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load();
                }}
              />
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs">Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs">Event</Label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Apply filters'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <History className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading activity…' : 'No login activity recorded for this filter.'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile / tablet cards */}
              <div className="lg:hidden divide-y divide-border">
                {rows.map((r) => {
                  const parts = fmtParts(r.ts);
                  return (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium truncate">{r.userName}</p>
                          <p className="text-xs text-muted-foreground" title={fmtFull(r.ts)}>
                            {parts.date} · {parts.time}
                          </p>
                        </div>
                        <Badge variant={r.event === 'login' ? 'secondary' : 'outline'} className="capitalize">
                          {r.event}
                        </Badge>
                      </div>
                      <LocationCell row={r} />
                      {r.ip ? <p className="text-xs text-muted-foreground">IP {r.ip}</p> : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
                <table className="w-full text-sm border-collapse min-w-[960px]">
                  <colgroup>
                    <col className="w-[11rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[7rem]" />
                    <col />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                  </colgroup>
                  <thead className="bg-muted/90 text-left sticky top-0 z-10 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Location</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Accuracy</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const parts = fmtParts(r.ts);
                      return (
                        <tr key={r.id} className="border-b border-border/70 hover:bg-muted/20 align-middle">
                          <td className="px-4 py-3 text-muted-foreground" title={fmtFull(r.ts)}>
                            <div className="leading-tight whitespace-nowrap">
                              <div className="tabular-nums text-foreground/80">{parts.date}</div>
                              <div className="text-xs tabular-nums">{parts.time}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <span className="block max-w-[10rem] truncate" title={r.userName}>
                              {r.userName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={r.event === 'login' ? 'secondary' : 'outline'} className="capitalize font-normal">
                              {r.event}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground min-w-[14rem]">
                            <LocationCell row={r} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">
                            {r.accuracy != null ? `±${Math.round(r.accuracy)} m` : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                            {r.ip || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LocationCell({ row }: { row: LoginActivityRow }) {
  if (row.locationStatus === 'granted' && (row.latitude != null || row.locationLabel || row.locationAddress)) {
    const label = row.locationAddress || row.locationLabel || `${row.latitude?.toFixed(4)}, ${row.longitude?.toFixed(4)}`;
    const href =
      row.latitude != null && row.longitude != null
        ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
        : undefined;
    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-start gap-1.5 text-primary hover:underline max-w-full"
          title={label}
        >
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2 text-left leading-snug">{label}</span>
        </a>
      );
    }
    return (
      <span className="inline-flex items-start gap-1.5 max-w-full">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span className="line-clamp-2 leading-snug">{label}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground">{locationStatusLabel(row.locationStatus)}</span>;
}
