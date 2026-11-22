import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Timesheet } from './Timesheet';
import { useAccess } from '../lib/access';
import { approvalsApi, dashboardApi, holidaysApi, leaveApi, noticesApi, activityApi, ApiError } from '../lib/api';
import { ApprovalReasonDialog } from './ApprovalReasonDialog';
import { CalendarDays, CheckCircle2, ClipboardList, Cake, Megaphone, Users, UserPlus, Clock, FileCheck2, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

const card = 'border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export function WelcomeBanner({ subtitle, chips }: { subtitle: string; chips?: React.ReactNode }) {
  const { user } = useAccess();
  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#061a52] via-[#0a3a9e] to-[#1d6bff] p-4 sm:p-6 text-white">
      <h1 className="text-xl sm:text-2xl mb-1 !text-white">{greeting()}, {user?.name.split(' ')[0]}</h1>
      <p className="text-white/80 text-sm sm:text-base">{subtitle}</p>
      {chips && <div className="flex flex-wrap gap-2 mt-4">{chips}</div>}
    </div>
  );
}
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">{children}</span>
);

function Stat({ label, value, icon: Icon, hint }: { label: string; value: React.ReactNode; icon: any; hint?: string }) {
  return (
    <Card className={card}><CardContent className="p-5 flex items-start justify-between">
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-medium">{value}</p>{hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}</div>
      <Icon className="w-5 h-5 text-primary" />
    </CardContent></Card>
  );
}

function formatHolidayDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EmployeeDashboard({ go }: { go: (t: string) => void }) {
  const [leave, setLeave] = useState<{ n: string; used: number; total: number }[]>([]);
  const [holidays, setHolidays] = useState<{ d: string; n: string }[]>([]);
  const [announcements, setAnnouncements] = useState<{ t: string; b: string }[]>([]);
  const [attendanceRate, setAttendanceRate] = useState<string>('—');
  const [pendingTasks, setPendingTasks] = useState(0);
  const [timesheetHint, setTimesheetHint] = useState('Loading…');

  useEffect(() => {
    leaveApi
      .balances()
      .then(({ balances }) => {
        const rows = Object.entries(balances ?? {}).map(([n, v]) => ({
          n,
          used: Number((v as { used?: number }).used ?? 0),
          total: Number((v as { total?: number }).total ?? 0),
        }));
        setLeave(rows);
      })
      .catch(() => setLeave([]));

    holidaysApi
      .list()
      .then(({ holidays: rows }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = (rows ?? [])
          .filter((h) => h.active !== false)
          .map((h) => ({
            n: String(h.name ?? ''),
            raw: String(h.holidayDate ?? h.holiday_date ?? ''),
          }))
          .filter((h) => h.n && h.raw)
          .map((h) => ({ n: h.n, d: formatHolidayDate(h.raw), t: new Date(h.raw.includes('T') ? h.raw : `${h.raw}T00:00:00`).getTime() }))
          .filter((h) => !Number.isNaN(h.t) && h.t >= today.getTime())
          .sort((a, b) => a.t - b.t)
          .slice(0, 5)
          .map(({ n, d }) => ({ n, d }));
        setHolidays(upcoming);
      })
      .catch(() => setHolidays([]));

    noticesApi
      .list()
      .then(({ notices }) => {
        setAnnouncements(
          (notices ?? []).slice(0, 4).map((n) => ({
            t: String(n.title ?? 'Notice'),
            b: String(n.body ?? n.message ?? ''),
          })),
        );
      })
      .catch(() => setAnnouncements([]));

    dashboardApi
      .stats()
      .then(({ stats }) => {
        setAttendanceRate(`${stats.attendanceRate ?? 0}%`);
        setPendingTasks(Number(stats.pendingLeave ?? 0));
        setTimesheetHint(stats.pendingTimesheets ? `${stats.pendingTimesheets} pending review` : 'Up to date');
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="Here is your day at a glance." />
      <Timesheet />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Attendance this month" value={attendanceRate} icon={Clock} hint="Last 30 days" />
        <Stat label="Timesheet status" value={<Badge variant="secondary">Self-service</Badge>} icon={FileCheck2} hint={timesheetHint} />
        <Stat label="Pending tasks" value={String(pendingTasks)} icon={ClipboardList} hint="Leave awaiting decision" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className={card}>
          <CardHeader><CardTitle className="text-base">Leave balance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {leave.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave balances yet.</p>
            ) : (
              leave.map((l) => (
                <div key={l.n}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{l.n}</span>
                    <span className="text-muted-foreground">{Math.max(0, l.total - l.used)} of {l.total} left</span>
                  </div>
                  <Progress value={l.total ? Math.min(100, (l.used / l.total) * 100) : 0} />
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => go('attendance')}>Apply for leave</Button>
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" />Upcoming holidays</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
            ) : (
              holidays.map((h) => (
                <div key={h.n} className="flex justify-between text-sm">
                  <span>{h.n}</span>
                  <Badge variant="secondary">{h.d}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" />Announcements</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.t}>
                  <p className="text-sm font-medium">{a.t}</p>
                  <p className="text-xs text-muted-foreground">{a.b}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ManagerDashboard({ go }: { go: (t: string) => void }) {
  const [pending, setPending] = useState(0);
  const [teamReport, setTeamReport] = useState<Record<string, unknown>[]>([]);
  const [inbox, setInbox] = useState<Record<string, unknown>[]>([]);
  const [reasonTarget, setReasonTarget] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);

  const load = () => {
    void approvalsApi
      .inbox()
      .then(({ inbox: rows }) => {
        setInbox(rows ?? []);
        setPending((rows ?? []).length);
      })
      .catch(() => {});
    void activityApi
      .report()
      .then(({ report }) => setTeamReport(report ?? []))
      .catch(() => {});
  };
  useEffect(load, []);

  const decide = (id: number, action: 'approve' | 'reject') => {
    setReasonTarget({ id, action });
  };

  return (
    <div className="space-y-6">
      <WelcomeBanner
        subtitle="Your team’s attendance, leave and claims."
        chips={
          <>
            <Chip>
              <Users className="w-3.5 h-3.5" />
              {teamReport.length} reports
            </Chip>
            <Chip>
              <ClipboardList className="w-3.5 h-3.5" />
              {pending} pending
            </Chip>
          </>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Team size" value={String(teamReport.length)} icon={Users} />
        <Stat label="Pending approvals" value={String(pending)} icon={ClipboardList} hint="Leave & claims" />
        <Stat
          label="Leave remaining (team)"
          value={String(teamReport.reduce((s, r) => s + Number(r.leaveRemaining ?? 0), 0))}
          icon={CalendarDays}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={card}>
          <CardHeader>
            <CardTitle className="text-base">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inbox.length === 0 && <p className="text-sm text-muted-foreground">No pending items.</p>}
            {inbox.map((item) => (
              <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">
                    {String(item.requesterName)} · {String(item.typeLabel || item.moduleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">{String(item.stepLabel || '')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void decide(Number(item.id), 'reject')}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => void decide(Number(item.id), 'approve')}>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => go('attendance')}>
              Open attendance & claims
            </Button>
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader>
            <CardTitle className="text-base">Team leave summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamReport.length === 0 && <p className="text-sm text-muted-foreground">No team members assigned.</p>}
            {teamReport.map((r) => (
              <div key={String(r.userId ?? r.employeeId)} className="flex justify-between text-sm border-b py-2">
                <span>{String(r.name)}</span>
                <span className="text-muted-foreground">
                  Rem {Number(r.leaveRemaining)} · Pend {Number(r.pendingLeave)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <ApprovalReasonDialog
        open={Boolean(reasonTarget)}
        title={reasonTarget?.action === 'approve' ? 'Approval reason' : 'Rejection reason'}
        actionLabel={reasonTarget?.action === 'approve' ? 'Approve' : 'Reject'}
        onOpenChange={(open) => {
          if (!open) setReasonTarget(null);
        }}
        onConfirm={async (comment) => {
          if (!reasonTarget) return;
          try {
            await approvalsApi.action(reasonTarget.id, reasonTarget.action, comment);
            toast.success(reasonTarget.action === 'approve' ? 'Approved' : 'Rejected');
            load();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Action failed');
          } finally {
            setReasonTarget(null);
          }
        }}
      />
    </div>
  );
}

export function HRDashboard({ go }: { go: (t: string) => void }) {
  const { can } = useAccess();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeave: 0,
    pendingTimesheets: 0,
    newHires: 0,
    activeEmployees: 0,
  });

  useEffect(() => {
    dashboardApi
      .stats()
      .then(({ stats: s }) =>
        setStats({
          totalEmployees: Number(s.totalEmployees ?? 0),
          pendingLeave: Number(s.pendingLeave ?? 0),
          pendingTimesheets: Number(s.pendingTimesheets ?? 0),
          newHires: Number(s.newHires ?? 0),
          activeEmployees: Number(s.activeEmployees ?? 0),
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="People operations overview for your departments."
        chips={<><Chip><Users className="w-3.5 h-3.5" />{stats.totalEmployees} employees</Chip><Chip><UserPlus className="w-3.5 h-3.5" />{stats.newHires} new this month</Chip></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Present today" value={String(stats.activeEmployees)} icon={CheckCircle2} hint="Active employees" />
        <Stat label="Pending leave" value={String(stats.pendingLeave)} icon={CalendarDays} hint="Awaiting your review" />
        <Stat label="Timesheet approvals" value={String(stats.pendingTimesheets)} icon={FileCheck2} hint="Submitted this week" />
        <Stat label="New joiners" value={String(stats.newHires)} icon={UserPlus} hint="This month" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`${card} lg:col-span-2`}>
          <CardHeader><CardTitle className="text-base">HR tasks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              [`Review ${stats.pendingLeave} pending leave request${stats.pendingLeave === 1 ? '' : 's'}`, 'attendance'],
              [`Complete onboarding for ${stats.newHires} new joiner${stats.newHires === 1 ? '' : 's'}`, 'employees'],
              ['Schedule interviews for open roles', 'recruitment'],
            ].map(([t, tab]) => (
              <div key={t} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                <span>{t}</span>
                <Button size="sm" variant="outline" disabled={!can(tab, 'read')} onClick={() => go(tab)}>Open</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cake className="w-4 h-4" />Birthdays & anniversaries</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-primary" />Check employee directory for upcoming dates</div>
            <Button size="sm" variant="outline" className="w-full" disabled={!can('employees', 'read')} onClick={() => go('employees')}>
              Open directory
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
