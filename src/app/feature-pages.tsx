import React, { useEffect, useMemo, useState } from 'react';
import { useCurrency, formatMoney, currencies } from './lib/currency';
import type { EmployeeRecord } from './components/EmployeeManagement';
import {
  employeesApi,
  payrollApi,
  recruitmentApi,
  performanceApi,
  settingsApi,
  noticesApi,
} from './lib/api';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useRole } from './lib/roles';
import { useAccess } from './lib/access';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import {
  DollarSign,
  UserPlus,
  TrendingUp,
  Award,
  Users,
  Calendar,
  BarChart3,
  FileText,
  Target,
  Star,
  Gift,
  MessageSquare,
  Settings,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

function PayrollCurrencyAdmin() {
  const { role } = useRole();
  const { user } = useAccess();
  const { currencyFor, setCurrency, isOverridden } = useCurrency();
  const isAdmin = role === 'admin';
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  useEffect(() => {
    employeesApi
      .list()
      .then(({ employees: rows }) => {
        setEmployees(
          rows.map((r) => ({
            id: Number(r.id),
            name: String(r.name),
            email: String(r.email),
            department: String(r.department),
            position: String(r.position ?? ''),
            status: String(r.status),
            joinDate: String(r.joinDate ?? r.join_date).slice(0, 10),
            salary: Number(r.salary ?? 0),
            location: String(r.location ?? ''),
            country: String(r.country ?? 'United States'),
          })),
        );
      })
      .catch(() => {});
  }, []);
  const self = {
    id: user?.id ?? 'me',
    name: user ? `${user.name} (you)` : 'You',
    country: employees.find((e) => e.email === user?.email)?.country ?? 'India',
    salary: employees.find((e) => e.email === user?.email)?.salary ?? 0,
  };
  const rows = [self, ...employees.filter((e) => e.email !== user?.email)];
  return (
    <Card className="border border-border rounded-xl">
      <CardHeader>
        <CardTitle>Payroll currency by employee</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? 'Defaults to the employee’s country. Admin can override any employee’s payroll currency.'
            : 'Set by Admin based on the employee’s country.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const cur = currencyFor(r.id, r.country);
          return (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/60 p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.country} · Salary {formatMoney(r.salary, cur)}
                  {isOverridden(r.id) ? ' · custom' : ''}
                </p>
              </div>
              {isAdmin ? (
                <Select value={cur.code} onValueChange={(v) => setCurrency(r.id, v)}>
                  <SelectTrigger className="w-full sm:w-44" aria-label={`Currency for ${r.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(currencies).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{cur.code}</Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PayrollManagement() {
  const { can, role } = useRole();
  const { user } = useAccess();
  const { currencyFor } = useCurrency();
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [payslips, setPayslips] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = () =>
    Promise.all([
      payrollApi.runs().then(({ runs: r }) => setRuns(r ?? [])),
      payrollApi.payslips().then(({ payslips: p }) => setPayslips(p ?? [])),
    ]).catch(() => toast.error('Could not load payroll data'));

  useEffect(() => {
    void reload();
  }, []);

  const myEmpPayslips = payslips;
  const latest = myEmpPayslips[0];
  const breakdown =
    latest && typeof latest.breakdown === 'object' && latest.breakdown
      ? (latest.breakdown as { gross?: number; deductions?: number })
      : {};
  const myCountry = 'India';
  const myCur = currencyFor(user?.id ?? 'me', myCountry);

  if (role === 'employee') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">My Payslips</h1>
          <p className="text-muted-foreground">You can only view your own pay information</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(
            [
              ['Net Pay', Number(latest?.net_pay ?? 0)],
              ['Gross Pay', Number(breakdown.gross ?? 0)],
              ['Deductions', Number(breakdown.deductions ?? 0)],
            ] as [string, number][]
          ).map(([l, v]) => (
            <Card key={l} className="border border-border rounded-xl">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-2xl font-medium">{formatMoney(v, myCur)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {myEmpPayslips.length === 0 && <p className="text-sm text-muted-foreground">No payslips available yet.</p>}
        <p className="text-xs text-muted-foreground">
          Paid in {myCur.code}, set by Admin for your country ({myCountry}).
        </p>
        <Button variant="outline" className="gap-2" disabled={!latest} onClick={() => toast.success('Payslip download queued')}>
          <FileText className="w-4 h-4" />
          Download payslip
        </Button>
      </div>
    );
  }

  const totalPayroll = runs.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const employeesProcessed = payslips.length;
  const nextLabel = runs[0] ? String(runs[0].period_label) : '—';

  const processPayroll = async () => {
    setBusy(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const label = now.toLocaleString('en-US', { month: 'short' }) + ' payroll';
      const res = await payrollApi.process({ periodLabel: label, periodStart: start, periodEnd: end });
      toast.success(`Processed payroll for ${res.employeesProcessed} employees`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payroll failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Payroll Management</h1>
        <p className="text-muted-foreground">Manage employee compensation and benefits</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Payroll', value: formatMoney(totalPayroll || 0, currencies.USD, { compact: true }), icon: DollarSign },
          { label: 'Employees Processed', value: String(employeesProcessed), icon: Users },
          { label: 'Latest Run', value: nextLabel, icon: Calendar },
        ].map((s) => (
          <Card
            key={s.label}
            className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-medium">{s.value}</p>
              </div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <PayrollCurrencyAdmin />
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle>Payroll Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {can.canProcessPayroll && (
            <Button variant="outline" className="h-20 flex-col gap-2" disabled={busy} onClick={() => void processPayroll()}>
              <DollarSign className="w-6 h-6" />
              {busy ? 'Processing…' : 'Process Payroll'}
            </Button>
          )}
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => toast.info(`${runs.length} payroll run(s) on record`)}>
            <FileText className="w-6 h-6" />
            Generate Reports
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => toast.info('Tax settings are managed in Organization Settings')}>
            <Settings className="w-6 h-6" />
            Tax Settings
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => toast.info(`Total processed volume: ${formatMoney(totalPayroll, currencies.USD)}`)}>
            <BarChart3 className="w-6 h-6" />
            Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecruitmentManagement() {
  const { can } = useRole();
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [candidates, setCandidates] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    recruitmentApi
      .jobs()
      .then(({ items }) => setJobs(items ?? []))
      .catch(() => toast.error('Could not load jobs'));
    recruitmentApi
      .candidates()
      .then(({ candidates: c }) => setCandidates(c ?? []))
      .catch(() => {});
  }, []);

  const open = jobs.filter((j) => String(j.status) === 'open').length;
  const interviews = candidates.filter((c) => String(c.stage) === 'interview').length;
  const offers = candidates.filter((c) => String(c.stage) === 'offer').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-medium">Recruitment</h1>
          <p className="text-muted-foreground">Manage job openings and candidate pipeline</p>
        </div>
        {can.canPostJobs && (
          <Button className="gap-2" onClick={() => toast.info('Use Admin tools to add openings; create API returns 501 until full form ships.')}>
            <UserPlus className="w-4 h-4" />
            Post New Job
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Open Positions', value: open, icon: UserPlus },
          { label: 'Applications', value: candidates.length, icon: FileText },
          { label: 'Interviews', value: interviews, icon: Calendar },
          { label: 'Offers Extended', value: offers, icon: CheckCircle },
        ].map((s) => (
          <Card
            key={s.label}
            className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-medium">{s.value}</p>
              </div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle>Openings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No job openings yet.</p>}
          {jobs.map((j) => (
            <div key={String(j.id)} className="flex justify-between gap-3 p-3 border rounded-lg">
              <div>
                <p className="font-medium">{String(j.title)}</p>
                <p className="text-sm text-muted-foreground">
                  {String(j.department)} · {String(j.location ?? '—')}
                </p>
              </div>
              <Badge>{String(j.status)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function PerformanceManagement() {
  const { role, user } = useRole();
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [goals, setGoals] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    performanceApi
      .reviews()
      .then(({ reviews: r }) => setReviews(r ?? []))
      .catch(() => {});
    performanceApi
      .goals()
      .then(({ goals: g }) => setGoals(g ?? []))
      .catch(() => {});
  }, []);

  const myGoals = useMemo(() => {
    if (role !== 'employee') return goals;
    return goals;
  }, [goals, role]);

  if (role === 'employee') {
    const displayGoals = myGoals.slice(0, 3).map((g) => [String(g.title), Number(g.progress ?? 0)] as [string, number]);
    const fallback: [string, number][] = [
      ['Ship onboarding revamp', 70],
      ['Complete security certification', 45],
      ['Mentor two new joiners', 90],
    ];
    const rows = displayGoals.length ? displayGoals : fallback;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">My Performance</h1>
          <p className="text-muted-foreground">Your goals and review cycle</p>
        </div>
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle>Goals &amp; KPIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map(([g, v]) => (
              <div key={g}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{g}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <Progress value={v} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const ratings = reviews.map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n) && n > 0);
  const averageRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const reviewsCompleted = reviews.filter((r) => String(r.status) === 'completed').length;
  const reviewsPending = reviews.filter((r) => String(r.status) === 'pending' || String(r.status) === 'draft').length;
  const goalCompletionRate = goals.length
    ? Math.round(goals.reduce((s, g) => s + Number(g.progress ?? 0), 0) / goals.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Performance Management</h1>
        <p className="text-muted-foreground">Track employee performance and development</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Average Rating', value: `${averageRating.toFixed(1)}/5.0`, icon: Star },
          { label: 'Reviews Completed', value: String(reviewsCompleted), icon: CheckCircle },
          { label: 'Pending Reviews', value: String(reviewsPending), icon: AlertTriangle },
          { label: 'Goal Completion', value: `${goalCompletionRate}%`, icon: Target },
        ].map((s) => (
          <Card key={s.label} className="border border-border rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-medium">{s.value}</p>
              </div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Signed in as {user?.name ?? '—'}. Metrics load from MySQL.</p>
    </div>
  );
}

export function EmployeeEngagement() {
  const [noticesCount, setNoticesCount] = useState(0);
  useEffect(() => {
    noticesApi
      .list()
      .then(({ notices }) => setNoticesCount(notices?.length ?? 0))
      .catch(() => {});
  }, []);
  const d = {
    overallScore: noticesCount ? Math.min(95, 70 + noticesCount * 3) : 0,
    surveyResponses: noticesCount,
    recognitionsGiven: noticesCount,
    activePrograms: noticesCount ? Math.max(1, Math.min(8, noticesCount)) : 0,
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Employee Engagement</h1>
        <p className="text-muted-foreground">Foster positive workplace culture and recognition</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Engagement Score', value: d.overallScore ? `${d.overallScore}%` : '—', icon: TrendingUp },
          { label: 'Survey Responses', value: String(d.surveyResponses), icon: MessageSquare },
          { label: 'Recognitions', value: String(d.recognitionsGiven), icon: Award },
          { label: 'Active Programs', value: String(d.activePrograms), icon: Gift },
        ].map((s) => (
          <Card key={s.label} className="border border-border rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-medium">{s.value}</p>
              </div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { can, role } = useRole();
  const [company, setCompany] = useState<{ name?: string; timezone?: string; currency?: string }>({});

  useEffect(() => {
    settingsApi
      .get()
      .then(({ settings }) => {
        const c = settings.company;
        if (c && typeof c === 'object') setCompany(c as { name?: string; timezone?: string; currency?: string });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="text-muted-foreground">Configure your HR system preferences</p>
      </div>
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle>Your access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{role === 'hr' ? 'HR' : role === 'admin' ? 'Admin' : 'Employee'}</span>.
          {company.name ? (
            <>
              {' '}
              Organization: <span className="font-medium text-foreground">{company.name}</span> ({company.timezone}, {company.currency}).
            </>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {can.canManageCompany && (
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle>Company Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Configure company-wide HR policies</p>
            </CardContent>
          </Card>
        )}
        {can.canManageAccess && (
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle>User Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage user roles and access permissions</p>
            </CardContent>
          </Card>
        )}
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Configure notification preferences</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
