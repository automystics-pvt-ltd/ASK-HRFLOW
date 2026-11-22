import { useAccess } from '../lib/access';
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { approvalsApi, auditApi, dashboardApi, performanceApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Users, Clock, DollarSign, TrendingUp, UserCheck, CalendarDays, Award, AlertCircle,
  ArrowUpRight, Plus, MessageSquare, Heart, Loader2,
} from 'lucide-react';

type InboxItem = {
  id: number;
  typeLabel: string;
  requesterName: string;
  moduleKey: string;
  entityId: string;
  busy?: boolean;
};

type Activity = { id: string; user: string; action: string; time: string; type: string };
type Performer = { name: string; role: string; score: number; avatar?: string };

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins || 1} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function DashboardOverview({ go }: { go: (tab: string) => void }) {
  const { user, can } = useAccess();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    newHires: 0,
    monthlyPayroll: 0,
    attendanceRate: 0,
    engagementScore: 0,
    pendingLeave: 0,
  });
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);

  const loadInbox = useCallback(() => {
    approvalsApi
      .inbox()
      .then(({ inbox: rows }) =>
        setInbox(
          (rows ?? []).map((r) => ({
            id: Number(r.id),
            typeLabel: String(r.typeLabel ?? r.workflowName ?? r.moduleKey ?? 'Request'),
            requesterName: String(r.requesterName ?? r.requesterId ?? 'Employee'),
            moduleKey: String(r.moduleKey ?? ''),
            entityId: String(r.entityId ?? ''),
          })),
        ),
      )
      .catch(() => setInbox([]));
  }, []);

  useEffect(() => {
    dashboardApi
      .stats()
      .then(({ stats: s }) => {
        setStats({
          totalEmployees: Number(s.totalEmployees ?? 0),
          activeEmployees: Number(s.activeEmployees ?? 0),
          newHires: Number(s.newHires ?? 0),
          monthlyPayroll: Number(s.monthlyPayroll ?? 0),
          attendanceRate: Number(s.attendanceRate ?? 0),
          engagementScore: Number(s.attendanceRate ?? 0) > 0 ? Math.min(99, Math.round(Number(s.attendanceRate) * 0.9 + 10)) : 0,
          pendingLeave: Number(s.pendingLeave ?? 0),
        });
      })
      .catch(() => {});

    loadInbox();

    auditApi
      .list()
      .then(({ audit }) => {
        setActivities(
          (audit ?? []).slice(0, 8).map((l, i) => ({
            id: String(l.id ?? i),
            user: String(l.actorName ?? 'System'),
            action: String(l.detail ?? l.event ?? 'Activity'),
            time: relativeTime(String(l.ts ?? '')),
            type: String(l.event ?? 'activity').toLowerCase().includes('leave')
              ? 'leave'
              : String(l.event ?? '').toLowerCase().includes('attendance')
                ? 'attendance'
                : String(l.event ?? '').toLowerCase().includes('performance')
                  ? 'performance'
                  : 'profile',
          })),
        );
      })
      .catch(() => setActivities([]));

    if (can('performance', 'read')) {
      performanceApi
        .reviews()
        .then(({ reviews }) => {
          const ranked = (reviews ?? [])
            .map((r) => ({
              name: String(r.employeeName ?? r.employee_name ?? r.name ?? 'Employee'),
              role: String(r.position ?? r.role ?? r.department ?? 'Team member'),
              score: Number(r.score ?? r.rating ?? 0),
              avatar: r.avatar != null ? String(r.avatar) : undefined,
            }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          setPerformers(ranked);
        })
        .catch(() => setPerformers([]));
    }
  }, [can, loadInbox]);

  const decide = async (id: number, action: 'approve' | 'reject') => {
    setActingId(id);
    try {
      await approvalsApi.action(id, action);
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      loadInbox();
      dashboardApi
        .stats()
        .then(({ stats: s }) =>
          setStats((prev) => ({
            ...prev,
            pendingLeave: Number(s.pendingLeave ?? prev.pendingLeave),
          })),
        )
        .catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061a52] via-[#0a3a9e] to-[#1d6bff] p-4 sm:p-6 text-primary-foreground">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-xl sm:text-2xl mb-2 !text-white">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-primary-foreground/80 mb-4 text-sm sm:text-base">Here's what's happening with your team today.</p>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">
              <Users className="w-4 h-4 mr-2" />
              {stats.totalEmployees} Total Employees
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">
              <UserCheck className="w-4 h-4 mr-2" />
              {stats.activeEmployees} Active Today
            </Badge>
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 hidden sm:block w-48 lg:w-64 h-32 opacity-20">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1594892342285-9b86df3ad47a?w=1080&q=80"
            alt="Team workspace"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {[
          { title: 'Total Employees', value: stats.totalEmployees, sub: `+${stats.newHires} new this month`, icon: Users },
          { title: 'Attendance Rate', value: `${stats.attendanceRate}%`, progress: stats.attendanceRate, icon: Clock },
          {
            title: 'Monthly Payroll',
            value: `$${(stats.monthlyPayroll / 1e6).toFixed(1)}M`,
            sub: `${stats.pendingLeave} leave pending`,
            icon: DollarSign,
          },
          { title: 'Engagement Score', value: `${stats.engagementScore}%`, progress: stats.engagementScore, icon: Heart },
        ].map((m) => (
          <Card
            key={m.title}
            className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{m.value}</div>
              {m.progress != null && <Progress value={m.progress} className="mt-2" />}
              {m.sub && (
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />
                  {m.sub}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2 border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {activity.type === 'leave' && <CalendarDays className="w-4 h-4 text-primary" />}
                    {activity.type === 'performance' && <TrendingUp className="w-4 h-4 text-primary" />}
                    {activity.type === 'profile' && <Users className="w-4 h-4 text-primary" />}
                    {activity.type === 'attendance' && <Clock className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {performers.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No review scores yet.</p>
                <Button size="sm" variant="outline" onClick={() => go('performance')} disabled={!can('performance', 'read')}>
                  Open performance
                </Button>
              </div>
            ) : (
              performers.map((performer, index) => (
                <div key={performer.name} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      {performer.avatar ? <AvatarImage src={performer.avatar} alt={performer.name} /> : null}
                      <AvatarFallback>
                        {performer.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs text-primary-foreground font-medium">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{performer.name}</p>
                    <p className="text-xs text-muted-foreground">{performer.role}</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    {performer.score}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pending Approvals
              </div>
              <Badge variant="secondary">{inbox.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals.</p>
            ) : (
              inbox.map((approval) => (
                <div key={approval.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{approval.typeLabel}</p>
                    <p className="text-xs text-muted-foreground">{approval.requesterName}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={actingId === approval.id}
                      onClick={() => void decide(approval.id, 'reject')}
                    >
                      {actingId === approval.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reject'}
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      disabled={actingId === approval.id}
                      onClick={() => void decide(approval.id, 'approve')}
                    >
                      {actingId === approval.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium">Pending leave reviews</p>
                <p className="text-xs text-muted-foreground">{stats.pendingLeave} awaiting decision</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => go('attendance')}>
                Open
              </Button>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium">Approvals inbox</p>
                <p className="text-xs text-muted-foreground">{inbox.length} in workflow queue</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => go('notifications')}>
                Open
              </Button>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium">Payroll processing</p>
                <p className="text-xs text-muted-foreground">Review runs and payslips</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => go('payroll')} disabled={!can('payroll', 'read')}>
                Open
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            disabled={!can('employees', 'create')}
            onClick={() => go('employees')}
          >
            <Plus className="w-6 h-6" />
            Add Employee
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            disabled={!can('attendance', 'read')}
            onClick={() => go('attendance')}
          >
            <Clock className="w-6 h-6" />
            View Attendance
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            disabled={!can('payroll', 'read')}
            onClick={() => go('payroll')}
          >
            <DollarSign className="w-6 h-6" />
            Process Payroll
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            disabled={!can('reports', 'read') && !can('dashboard', 'read')}
            onClick={() => go(can('audit', 'read') ? 'audit' : 'settings')}
          >
            <TrendingUp className="w-6 h-6" />
            Run Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
