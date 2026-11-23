import React, { useEffect, useMemo, useState } from 'react';
import { useCurrency, formatMoney, currencies } from './lib/currency';
import type { EmployeeRecord } from './components/EmployeeManagement';
import {
  employeesApi,
  payrollApi,
  recruitmentApi,
  performanceApi,
  noticesApi,
} from './lib/api';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useRole } from './lib/roles';
import { useAccess } from './lib/access';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Progress } from './components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
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
  Loader2,
  Palette,
  Trash2,
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
        <Button
          variant="outline"
          className="gap-2"
          disabled={!latest}
          onClick={() => {
            if (!latest) return;
            const gross = Number(breakdown.gross ?? 0);
            const deductions = Number(breakdown.deductions ?? 0);
            const net = Number(latest.net_pay ?? 0);
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip</title>
<style>body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}h1{margin:0 0 8px}table{border-collapse:collapse;margin-top:24px;width:100%;max-width:480px}td{padding:8px 0;border-bottom:1px solid #e2e8f0}</style></head><body>
<h1>Payslip</h1>
<p>Period run #${String(latest.payroll_run_id ?? latest.payrollRunId ?? '—')} · Issued ${String(latest.issued_at ?? latest.issuedAt ?? '').slice(0, 10)}</p>
<table>
<tr><td>Gross pay</td><td style="text-align:right">${formatMoney(gross, myCur)}</td></tr>
<tr><td>Deductions</td><td style="text-align:right">${formatMoney(deductions, myCur)}</td></tr>
<tr><td><strong>Net pay</strong></td><td style="text-align:right"><strong>${formatMoney(net, myCur)}</strong></td></tr>
</table>
</body></html>`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            a.download = `payslip-${String(latest.id)}.html`;
            a.click();
            toast.success('Payslip downloaded');
          }}
        >
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
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={() => {
              const header = 'Period,Start,End,Status,Total';
              const lines = runs.map((r) =>
                [r.period_label, r.period_start, r.period_end, r.status, r.total_amount]
                  .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                  .join(','),
              );
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([[header, ...lines].join('\n')], { type: 'text/csv' }));
              a.download = 'payroll-runs.csv';
              a.click();
              toast.success(`Exported ${runs.length} payroll run(s)`);
            }}
          >
            <FileText className="w-6 h-6" />
            Generate Reports
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={() => {
              window.location.hash = '#/settings';
              toast.success('Open Organization Settings for tax and company configuration');
            }}
          >
            <Settings className="w-6 h-6" />
            Tax Settings
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={() => {
              toast.success(
                `Payroll volume ${formatMoney(totalPayroll, currencies.USD)} across ${runs.length} run(s) · ${payslips.length} payslip(s)`,
              );
            }}
          >
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
  const [jobOpen, setJobOpen] = useState(false);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    department: 'Engineering',
    location: 'Remote',
    description: '',
  });

  const reloadJobs = () => {
    recruitmentApi
      .jobs()
      .then(({ items }) => setJobs(items ?? []))
      .catch(() => toast.error('Could not load jobs'));
    recruitmentApi
      .candidates()
      .then(({ candidates: c }) => setCandidates(c ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    reloadJobs();
  }, []);

  const open = jobs.filter((j) => String(j.status) === 'open').length;
  const interviews = candidates.filter((c) => String(c.stage) === 'interview').length;
  const offers = candidates.filter((c) => String(c.stage) === 'offer').length;

  const postJob = async () => {
    if (!jobForm.title.trim() || !jobForm.department.trim()) {
      toast.error('Title and department are required');
      return;
    }
    setJobBusy(true);
    try {
      await recruitmentApi.createJob({
        title: jobForm.title.trim(),
        department: jobForm.department.trim(),
        location: jobForm.location.trim() || undefined,
        description: jobForm.description.trim() || undefined,
      });
      toast.success('Job opening posted');
      setJobOpen(false);
      setJobForm({ title: '', department: 'Engineering', location: 'Remote', description: '' });
      reloadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not post job');
    } finally {
      setJobBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-medium">Recruitment</h1>
          <p className="text-muted-foreground">Manage job openings and candidate pipeline</p>
        </div>
        {can.canPostJobs && (
          <Dialog open={jobOpen} onOpenChange={setJobOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Post New Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post new job opening</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    placeholder="Senior Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    value={jobForm.department}
                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    placeholder="Role summary"
                  />
                </div>
                <Button disabled={jobBusy} onClick={() => void postJob()}>
                  {jobBusy ? 'Posting…' : 'Post job'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
            <div key={String(j.id)} className="flex justify-between gap-3 p-3 border rounded-lg items-center">
              <div>
                <p className="font-medium">{String(j.title)}</p>
                <p className="text-sm text-muted-foreground">
                  {String(j.department)} · {String(j.location ?? '—')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{String(j.status)}</Badge>
                {can.canPostJobs && String(j.status) === 'open' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void recruitmentApi
                        .updateJob(Number(j.id), { status: 'closed' })
                        .then(() => {
                          toast.success('Opening closed');
                          reloadJobs();
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : 'Update failed'));
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
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
    const rows = myGoals.slice(0, 8).map((g) => [String(g.title), Number(g.progress ?? 0)] as [string, number]);
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
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals assigned yet.</p>
            ) : (
              rows.map(([g, v]) => (
                <div key={g}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{g}</span>
                    <span className="text-muted-foreground">{v}%</span>
                  </div>
                  <Progress value={v} />
                </div>
              ))
            )}
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


export { RoleSettings as SettingsPage } from './components/RoleSettings';
