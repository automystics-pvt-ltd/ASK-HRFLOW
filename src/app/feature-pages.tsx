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
  documentsApi,
  brandingApi,
  hrDocumentsApi,
  holidaysApi,
  leaveTypesApi,
  type BrandingCompany,
  type BrandingTheme,
} from './lib/api';
import { useBranding } from './lib/branding';
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
  Upload,
  Loader2,
  Palette,
  Trash2,
} from 'lucide-react';
import { LeavePolicyPanel, CardsPanel } from './components/AdvancedHRPanels';

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

type DocRow = { id: string; title: string; category: string; mimeType: string; createdAt: string };

export function SettingsPage() {
  const { can, role } = useRole();
  const acc = useAccess();
  const branding = useBranding();
  const [company, setCompany] = useState<BrandingCompany>({});
  const [theme, setTheme] = useState<BrandingTheme>({});
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<Record<string, unknown>[]>([]);
  const [holidays, setHolidays] = useState<Record<string, unknown>[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ employeeId: '', docType: 'offer_letter', relievingDate: '', salary: '' });
  const [holidayForm, setHolidayForm] = useState({ name: '', holidayDate: '', kind: 'public' });
  const [ltForm, setLtForm] = useState({
    code: '',
    name: '',
    defaultDays: '10',
    carryForward: false,
    allowHalfDay: true,
  });

  const loadDocuments = () => {
    if (!acc.can('employees', 'read')) return;
    documentsApi
      .list()
      .then(({ documents: rows }) =>
        setDocuments(
          (rows ?? []).map((r) => ({
            id: String(r.id),
            title: String(r.title ?? 'Untitled'),
            category: String(r.category ?? 'general'),
            mimeType: String(r.mime_type ?? r.mimeType ?? ''),
            createdAt: String(r.created_at ?? r.createdAt ?? ''),
          })),
        ),
      )
      .catch(() => {});
  };

  const loadAdminData = () => {
    if (can.canManageCompany || acc.can('attendance', 'update')) {
      leaveTypesApi
        .list()
        .then(({ types }) => setLeaveTypes(types ?? []))
        .catch(() => {});
    }
    if (acc.can('attendance', 'read')) {
      holidaysApi
        .list()
        .then(({ holidays: rows }) => setHolidays(rows ?? []))
        .catch(() => {});
    }
    if (acc.can('settings', 'read')) {
      hrDocumentsApi
        .templates()
        .then(({ templates: rows }) => setTemplates(rows ?? []))
        .catch(() => {});
    }
    if (acc.can('employees', 'read')) {
      employeesApi
        .list({ limit: 200 })
        .then(({ employees: rows }) =>
          setEmployees((rows ?? []).map((e) => ({ id: Number(e.id), name: String(e.name ?? '') }))),
        )
        .catch(() => {});
    }
  };

  useEffect(() => {
    brandingApi
      .get()
      .then((data) => {
        setCompany(data.company ?? {});
        setTheme(data.theme ?? {});
      })
      .catch(() => {
        settingsApi
          .get()
          .then(({ settings }) => {
            const c = settings.company;
            if (c && typeof c === 'object') setCompany(c as BrandingCompany);
          })
          .catch(() => {});
      });
    loadDocuments();
    loadAdminData();
  }, []);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!acc.can('employees', 'create')) {
      toast.error('You do not have permission to upload documents');
      return;
    }
    setUploading(true);
    try {
      await documentsApi.upload(file, { title: docTitle.trim() || file.name, category: 'general' });
      toast.success('Document uploaded');
      setDocTitle('');
      loadDocuments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      await brandingApi.updateCompany(company);
      await branding.refresh();
      toast.success('Company info saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingCompany(false);
    }
  };

  const saveTheme = async () => {
    try {
      await brandingApi.updateTheme(theme);
      await branding.refresh();
      toast.success('Theme saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const onLogoUpload = async (file: File | null) => {
    if (!file) return;
    try {
      await brandingApi.uploadLogo(file);
      await branding.refresh();
      toast.success('Logo uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Logo upload failed');
    }
  };

  const removeLogo = async () => {
    try {
      await brandingApi.removeLogo();
      await branding.refresh();
      toast.success('Logo removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

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
              Organization: <span className="font-medium text-foreground">{company.name}</span>
              {company.timezone ? ` (${company.timezone}${company.currency ? `, ${company.currency}` : ''})` : ''}.
            </>
          ) : null}
        </CardContent>
      </Card>

      {can.canManageCompany && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Company info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ['name', 'Name'],
                  ['legalName', 'Legal name'],
                  ['address', 'Address'],
                  ['phone', 'Phone'],
                  ['email', 'Email'],
                  ['website', 'Website'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={String(company[key] ?? '')}
                    onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
                  />
                </div>
              ))}
              <Button onClick={() => void saveCompany()} disabled={savingCompany}>
                {savingCompany ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save company
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Branding & theme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="Logo" className="h-12 max-w-[160px] object-contain" />
                ) : (
                  <p className="text-sm text-muted-foreground">No custom logo</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input type="file" accept="image/*" onChange={(e) => void onLogoUpload(e.target.files?.[0] ?? null)} />
                {branding.logoUrl && (
                  <Button variant="outline" className="gap-2" onClick={() => void removeLogo()}>
                    <Trash2 className="w-4 h-4" /> Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['primary', 'secondary', 'accent'] as const).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="capitalize">{key}</Label>
                    <Input
                      type="color"
                      value={String(theme[key] ?? '#1e3a5f')}
                      onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={theme.mode ?? 'system'}
                  onValueChange={(v) => setTheme({ ...theme, mode: v as BrandingTheme['mode'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void saveTheme()}>Save theme</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {(acc.role === 'admin' || acc.role === 'hr') && (
        <>
          <LeavePolicyPanel />
          <CardsPanel />
        </>
      )}

      {(can.canManageCompany || acc.can('attendance', 'update')) && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle>Leave types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={ltForm.code} onChange={(e) => setLtForm({ ...ltForm, code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={ltForm.name} onChange={(e) => setLtForm({ ...ltForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Default days</Label>
                <Input
                  type="number"
                  value={ltForm.defaultDays}
                  onChange={(e) => setLtForm({ ...ltForm, defaultDays: e.target.value })}
                />
              </div>
              <Button
                onClick={() => {
                  void leaveTypesApi
                    .create({
                      code: ltForm.code,
                      name: ltForm.name,
                      defaultDays: Number(ltForm.defaultDays),
                      carryForward: ltForm.carryForward,
                      allowHalfDay: ltForm.allowHalfDay,
                    })
                    .then(() => {
                      toast.success('Leave type created');
                      setLtForm({ code: '', name: '', defaultDays: '10', carryForward: false, allowHalfDay: true });
                      loadAdminData();
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
                }}
              >
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {leaveTypes.map((t) => (
                <div key={String(t.id)} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium">
                      {String(t.name)} <span className="text-muted-foreground text-xs">({String(t.code)})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(t.defaultDays ?? 0)} days · half-day {t.allowHalfDay ? 'yes' : 'no'} · carry-forward{' '}
                      {t.carryForward ? 'yes' : 'no'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void leaveTypesApi
                        .update(Number(t.id), { active: !t.active })
                        .then(() => {
                          toast.success(t.active ? 'Deactivated' : 'Activated');
                          loadAdminData();
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
                    }}
                  >
                    {t.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {can.canManageCompany && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={holidayForm.holidayDate}
                  onChange={(e) => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Kind</Label>
                <Select value={holidayForm.kind} onValueChange={(v) => setHolidayForm({ ...holidayForm, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="weekly_off">Weekly off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  void holidaysApi
                    .create(holidayForm)
                    .then(() => {
                      toast.success('Holiday added');
                      setHolidayForm({ name: '', holidayDate: '', kind: 'public' });
                      loadAdminData();
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
                }}
              >
                Add holiday
              </Button>
            </div>
            <div className="space-y-2">
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holidays configured.</p>
              ) : (
                holidays.map((h) => (
                  <div key={String(h.id)} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/50">
                    <div>
                      <p className="font-medium">{String(h.name)}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(h.holidayDate)} · {String(h.kind)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void holidaysApi
                          .remove(Number(h.id))
                          .then(() => {
                            toast.success('Removed');
                            loadAdminData();
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {acc.can('settings', 'read') && (
        <Card className="border border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              HR document templates
            </CardTitle>
            {acc.can('employees', 'create') && (
              <Dialog open={genOpen} onOpenChange={setGenOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">Generate document</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate HR document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label>Employee</Label>
                      <Select
                        value={genForm.employeeId}
                        onValueChange={(v) => setGenForm({ ...genForm, employeeId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Document type</Label>
                      <Select value={genForm.docType} onValueChange={(v) => setGenForm({ ...genForm, docType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {templates
                            .filter((t) => t.active)
                            .map((t) => (
                              <SelectItem key={String(t.id)} value={String(t.docType)}>
                                {String(t.name)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Relieving date (optional)</Label>
                      <Input
                        type="date"
                        value={genForm.relievingDate}
                        onChange={(e) => setGenForm({ ...genForm, relievingDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Salary override (optional)</Label>
                      <Input
                        value={genForm.salary}
                        onChange={(e) => setGenForm({ ...genForm, salary: e.target.value })}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!genForm.employeeId) {
                          toast.error('Select an employee');
                          return;
                        }
                        const fields: Record<string, string> = {};
                        if (genForm.relievingDate) fields.relieving_date = genForm.relievingDate;
                        if (genForm.salary) fields.salary = genForm.salary;
                        void hrDocumentsApi
                          .generate({
                            employeeId: Number(genForm.employeeId),
                            docType: genForm.docType,
                            fields,
                          })
                          .then(({ id, title }) => {
                            toast.success(`Generated: ${title}`);
                            setGenOpen(false);
                            window.open(hrDocumentsApi.viewUrl(id), '_blank');
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : 'Generate failed'));
                      }}
                    >
                      Generate
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              templates.map((t) => (
                <div key={String(t.id)} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium">{String(t.name)}</p>
                    <p className="text-xs text-muted-foreground">{String(t.docType)} · v{Number(t.version)}</p>
                  </div>
                  {can.canManageCompany && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void hrDocumentsApi
                          .activateTemplate(String(t.id), !t.active)
                          .then(() => {
                            toast.success(t.active ? 'Deactivated' : 'Activated');
                            loadAdminData();
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
                      }}
                    >
                      {t.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                  {!can.canManageCompany && (
                    <Badge variant={t.active ? 'default' : 'secondary'}>{t.active ? 'Active' : 'Inactive'}</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {can.canManageAccess && (
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle>User Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage user roles and access permissions from Access Control.</p>
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

      {acc.can('employees', 'read') && (
        <Card className="border border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {acc.can('employees', 'create') && (
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5 flex-1 w-full">
                  <Label htmlFor="doc-title">Title (optional)</Label>
                  <Input
                    id="doc-title"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Document title"
                  />
                </div>
                <div className="space-y-1.5 w-full sm:w-auto">
                  <Label htmlFor="doc-file">File</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    disabled={uploading}
                    onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
                  />
                </div>
                {uploading && (
                  <Button disabled className="gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                  </Button>
                )}
              </div>
            )}
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50">
                    <div className="min-w-0 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.category}
                          {d.createdAt ? ` · ${new Date(d.createdAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{d.mimeType || 'file'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
