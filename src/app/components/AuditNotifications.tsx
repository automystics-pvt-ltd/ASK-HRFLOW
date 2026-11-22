import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useAccess } from '../lib/access';
import { Download, Bell, CheckCheck, Search, ShieldCheck, CheckCircle, Megaphone, AlertTriangle } from 'lucide-react';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AuditLogs() {
  const { audit, can } = useAccess();
  const [q, setQ] = useState('');
  const rows = audit.filter((e) => `${e.event} ${e.detail} ${e.actorName}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => {
    const csv = ['Time,Actor,Event,Detail', ...rows.map((r) => [r.ts, r.actorName, r.event, r.detail].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'audit-log.csv'; a.click();
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div><h1 className="text-2xl font-medium">Audit Logs</h1><p className="text-muted-foreground">Every sign-in and access change, newest first</p></div>
        {can('audit', 'export') && <Button variant="outline" className="gap-2 self-start" onClick={exportCsv} disabled={!rows.length}><Download className="w-4 h-4" />Export CSV</Button>}
      </div>
      <div className="relative max-w-sm"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search activity" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Card className="rounded-xl"><CardContent className="p-0 overflow-x-auto">
        {rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p> : (
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-left"><tr>{['Time', 'Actor', 'Event', 'Detail'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 200).map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(e.ts)}</td><td className="p-3">{e.actorName}</td>
                <td className="p-3"><Badge variant="secondary">{e.event}</Badge></td><td className="p-3">{e.detail}</td>
              </tr>))}</tbody>
          </table>)}
      </CardContent></Card>
    </div>
  );
}

const icons = { approval: CheckCircle, access: ShieldCheck, announcement: Megaphone, alert: AlertTriangle };

export function NotificationsPage() {
  const { notices, user, markRead, unread } = useAccess();
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div><h1 className="text-2xl font-medium">Notifications</h1><p className="text-muted-foreground">{unread} unread</p></div>
        <Button variant="outline" className="gap-2 self-start" disabled={!unread} onClick={() => markRead()}><CheckCheck className="w-4 h-4" />Mark all as read</Button>
      </div>
      {notices.length === 0 ? (
        <Card className="rounded-xl"><CardContent className="p-10 text-center text-muted-foreground"><Bell className="w-8 h-8 mx-auto mb-2" />You’re all caught up.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const Icon = icons[n.kind]; const isRead = n.read.includes(user?.id ?? '');
            return (
              <Card key={n.id} className={`rounded-xl ${isRead ? '' : 'border-primary/40 bg-primary/5'}`}>
                <CardContent className="p-4 flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0"><p className="font-medium">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p><p className="text-xs text-muted-foreground mt-1">{fmt(n.ts)}</p></div>
                  {!isRead && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
