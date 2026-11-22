import React, { useEffect, useState } from 'react';
import { CurrencyProvider, useCurrency, formatMoney, currencies } from './lib/currency';
import type { EmployeeRecord } from './components/EmployeeManagement';
import { employeesApi } from './lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useRole } from './lib/roles';
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

const SELF = { id: 'me', name: 'Alvi (you)', country: 'India', salary: 81600 };

function PayrollCurrencyAdmin() {
  const { role } = useRole();
  const { currencyFor, setCurrency, isOverridden } = useCurrency();
  const isAdmin = role === 'admin';
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  useEffect(() => {
    employeesApi.list().then(({ employees: rows }) => {
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
    }).catch(() => {});
  }, []);
  const rows = [SELF, ...employees];
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
                  {r.country} · Salary {formatMoney(r.salary, cur)}{isOverridden(r.id) ? ' · custom' : ''}
                </p>
              </div>
              {isAdmin ? (
                <Select value={cur.code} onValueChange={(v) => setCurrency(r.id, v)}>
                  <SelectTrigger className="w-full sm:w-44" aria-label={`Currency for ${r.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(currencies).map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
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
  const { currencyFor } = useCurrency();
  const myCur = currencyFor(SELF.id, SELF.country);
  if (role === 'employee') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">My Payslips</h1>
          <p className="text-muted-foreground">You can only view your own pay information</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([['Net Pay (Jun)', 5420], ['Gross Pay', 6800], ['Deductions', 1380]] as [string, number][]).map(([l, v]) => (
            <Card key={l} className="border border-border rounded-xl">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-2xl font-medium">{formatMoney(v, myCur)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Paid in {myCur.code}, set by Admin for your country ({SELF.country}).</p>
        <Button variant="outline" className="gap-2"><FileText className="w-4 h-4" />Download payslip</Button>
      </div>
    );
  }
  const mockPayrollData = { totalPayroll: 1240000, employeesProcessed: 247 };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Payroll Management</h1>
        <p className="text-muted-foreground">Manage employee compensation and benefits</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Payroll', value: formatMoney(mockPayrollData.totalPayroll, currencies.USD, { compact: true }), icon: DollarSign },
          { label: 'Employees Processed', value: String(mockPayrollData.employeesProcessed), icon: Users },
          { label: 'Next Payroll', value: 'Jan 31', icon: Calendar },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <PayrollCurrencyAdmin />
      <Card className="border border-border rounded-xl">
        <CardHeader><CardTitle>Payroll Actions</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {can.canProcessPayroll && <Button variant="outline" className="h-20 flex-col gap-2"><DollarSign className="w-6 h-6" />Process Payroll</Button>}
          <Button variant="outline" className="h-20 flex-col gap-2"><FileText className="w-6 h-6" />Generate Reports</Button>
          <Button variant="outline" className="h-20 flex-col gap-2"><Settings className="w-6 h-6" />Tax Settings</Button>
          <Button variant="outline" className="h-20 flex-col gap-2"><BarChart3 className="w-6 h-6" />Analytics</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecruitmentManagement() {
  const { can } = useRole();
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-medium">Recruitment</h1><p className="text-muted-foreground">Manage job openings and candidate pipeline</p></div>
        {can.canPostJobs && <Button className="gap-2"><UserPlus className="w-4 h-4" />Post New Job</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Open Positions', value: 12, icon: UserPlus },
          { label: 'Applications', value: 34, icon: FileText },
          { label: 'Interviews', value: 8, icon: Calendar },
          { label: 'Offers Extended', value: 3, icon: CheckCircle },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PerformanceManagement() {
  const { role } = useRole();
  if (role === 'employee') {
    const goals = [['Ship onboarding revamp', 70], ['Complete security certification', 45], ['Mentor two new joiners', 90]] as [string, number][];
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-medium">My Performance</h1><p className="text-muted-foreground">Your goals and review cycle</p></div>
        <Card className="border border-border rounded-xl">
          <CardHeader><CardTitle>Goals &amp; KPIs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {goals.map(([g, v]) => (<div key={g}><div className="flex justify-between text-sm mb-1"><span>{g}</span><span className="text-muted-foreground">{v}%</span></div><Progress value={v} /></div>))}
          </CardContent>
        </Card>
      </div>
    );
  }
  const data = { averageRating: 4.2, reviewsCompleted: 234, reviewsPending: 13, goalCompletionRate: 87 };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-medium">Performance Management</h1><p className="text-muted-foreground">Track employee performance and development</p></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[
        { label: 'Average Rating', value: `${data.averageRating}/5.0`, icon: Star },
        { label: 'Reviews Completed', value: String(data.reviewsCompleted), icon: CheckCircle },
        { label: 'Pending Reviews', value: String(data.reviewsPending), icon: AlertTriangle },
        { label: 'Goal Completion', value: `${data.goalCompletionRate}%`, icon: Target },
      ].map((s) => (
        <Card key={s.label} className="border border-border rounded-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
            <s.icon className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}

export function EmployeeEngagement() {
  const d = { overallScore: 87, surveyResponses: 234, recognitionsGiven: 45, activePrograms: 8 };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-medium">Employee Engagement</h1><p className="text-muted-foreground">Foster positive workplace culture and recognition</p></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Engagement Score', value: `${d.overallScore}%`, icon: TrendingUp },
          { label: 'Survey Responses', value: String(d.surveyResponses), icon: MessageSquare },
          { label: 'Recognitions', value: String(d.recognitionsGiven), icon: Award },
          { label: 'Active Programs', value: String(d.activePrograms), icon: Gift },
        ].map((s) => (
          <Card key={s.label} className="border border-border rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
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
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-medium">Settings</h1><p className="text-muted-foreground">Configure your HR system preferences</p></div>
      <Card className="border border-border rounded-xl">
        <CardHeader><CardTitle>Your access</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{role === 'hr' ? 'HR' : role === 'admin' ? 'Admin' : 'Employee'}</span>.
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {can.canManageCompany && <Card className="border border-border rounded-xl"><CardHeader><CardTitle>Company Settings</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Configure company-wide HR policies</p></CardContent></Card>}
        {can.canManageAccess && <Card className="border border-border rounded-xl"><CardHeader><CardTitle>User Permissions</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Manage user roles and access permissions</p></CardContent></Card>}
        <Card className="border border-border rounded-xl"><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Configure notification preferences</p></CardContent></Card>
      </div>
    </div>
  );
}
