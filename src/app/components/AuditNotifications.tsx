import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAccess, type AuditEntry } from '../lib/access';
import { approvalsApi, auditApi } from '../lib/api';
import { ApprovalReasonDialog } from './ApprovalReasonDialog';
import { toast } from 'sonner';
import { Download, Bell, CheckCheck, Search, ShieldCheck, CheckCircle, Megaphone, AlertTriangle, Filter } from 'lucide-react';

export function AuditLogs() {
  const { can } = useAccess();
  const [q, setQ] = useState('');
  const [module, setModule] = useState('all');
  const [actorId, setActorId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [modules, setModules] = useState<Array<{ key: string; count: number }>>([]);
  const [actors, setActors] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void auditApi
      .list(300, {
        q: q || undefined,
        module: module !== 'all' ? module : undefined,
        actorId: actorId !== 'all' ? actorId : undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => {
        setRows(res.audit ?? []);
        setTotal(Number(res.total ?? res.audit?.length ?? 0));
        if (res.timezone) setTimezone(res.timezone);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void auditApi
      .facets()
      .then((f) => {
        setModules(f.modules ?? []);
        setActors(f.actors ?? []);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (iso: string, display?: string) =>
    display ||
    new Date(iso).toLocaleString('en-IN', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const exportCsv = () => {
    const csv = [
      'Time,Timezone,Actor,Module,Event,Detail,Target,Before,After',
      ...rows.map((r) =>
        [
          r.ts,
          timezone,
          r.actorName,
          r.moduleKey ?? '',
          r.event,
          r.detail,
          r.targetId ?? '',
          r.before ? JSON.stringify(r.before) : '',
          r.after ? JSON.stringify(r.after) : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'audit-log.csv';
    a.click();
  };

  const moduleOptions = useMemo(() => {
    const keys = new Set(modules.map((m) => m.key).filter(Boolean));
    ['employees', 'leave', 'claims', 'payroll', 'settings', 'access', 'system'].forEach((k) => keys.add(k));
    return Array.from(keys);
  }, [modules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Audit Logs</h1>
          <p className="text-muted-foreground">
            Created / modified history across HRMS · {total} record(s) · {timezone}
          </p>
        </div>
        {can('audit', 'export') && (
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
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search event, actor, detail…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Module</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {moduleOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Actor</Label>
            <Select value={actorId} onValueChange={setActorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {actors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="lg:col-span-5">
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Apply filters'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {['Time', 'Actor', 'Module', 'Event', 'Detail', 'Changes'].map((h) => (
                    <th key={h} className="p-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className="border-t border-border">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(e.ts, e.displayTime)}</td>
                      <td className="p-3">{e.actorName}</td>
                      <td className="p-3">
                        {e.moduleKey ? <Badge variant="outline">{e.moduleKey}</Badge> : '—'}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">{e.event}</Badge>
                      </td>
                      <td className="p-3 max-w-md">{e.detail}</td>
                      <td className="p-3">
                        {e.before != null || e.after != null ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          >
                            {expanded === e.id ? 'Hide' : 'View'}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr className="border-t border-border bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                            <div>
                              <p className="font-sans font-medium mb-1">Previous values</p>
                              <pre className="whitespace-pre-wrap break-all">
                                {e.before ? JSON.stringify(e.before, null, 2) : '—'}
                              </pre>
                            </div>
                            <div>
                              <p className="font-sans font-medium mb-1">Updated values</p>
                              <pre className="whitespace-pre-wrap break-all">
                                {e.after ? JSON.stringify(e.after, null, 2) : '—'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const icons = { approval: CheckCircle, access: ShieldCheck, announcement: Megaphone, alert: AlertTriangle };

export function NotificationsPage() {
  const { notices, user, markRead, unread } = useAccess();
  const [inbox, setInbox] = useState<Record<string, unknown>[]>([]);
  const [reasonTarget, setReasonTarget] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);

  const loadInbox = () => {
    approvalsApi
      .inbox()
      .then(({ inbox: rows }) => setInbox(rows ?? []))
      .catch(() => setInbox([]));
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Notifications</h1>
          <p className="text-muted-foreground">{unread} unread</p>
        </div>
        <Button variant="outline" className="gap-2 self-start" disabled={!unread} onClick={() => markRead()}>
          <CheckCheck className="w-4 h-4" />
          Mark all as read
        </Button>
      </div>

      {inbox.length > 0 && (
        <Card className="rounded-xl border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Approvals inbox ({inbox.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inbox.map((item) => (
              <div
                key={String(item.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/50"
              >
                <div>
                  <p className="font-medium">{String(item.workflowName ?? item.moduleKey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {String(item.entityType)} #{String(item.entityId)} · {String(item.stepLabel ?? '')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setReasonTarget({ id: Number(item.id), action: 'approve' })}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReasonTarget({ id: Number(item.id), action: 'reject' })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <ApprovalReasonDialog
        open={Boolean(reasonTarget)}
        title={reasonTarget?.action === 'approve' ? 'Approval reason' : 'Rejection reason'}
        actionLabel={reasonTarget?.action === 'approve' ? 'Approve' : 'Reject'}
        onOpenChange={(open) => {
          if (!open) setReasonTarget(null);
        }}
        onConfirm={async (comment) => {
          if (!reasonTarget) return;
          await approvalsApi.action(reasonTarget.id, reasonTarget.action, comment);
          toast.success(reasonTarget.action === 'approve' ? 'Approved' : 'Rejected');
          loadInbox();
          setReasonTarget(null);
        }}
      />

      {notices.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-10 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2" />
            You’re all caught up.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const Icon = icons[n.kind];
            const isRead = n.read.includes(user?.id ?? '');
            return (
              <Card key={n.id} className={`rounded-xl ${isRead ? '' : 'border-primary/40 bg-primary/5'}`}>
                <CardContent className="p-4 flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmt(n.ts)}</p>
                  </div>
                  {!isRead && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
