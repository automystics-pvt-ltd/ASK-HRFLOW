import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import {
  activityApi,
  cardsApi,
  claimsApi,
  employeesApi,
  leaveApi,
  accessApi,
  ApiError,
} from '../lib/api';
import { useAccess } from '../lib/access';
import { toast } from 'sonner';
import { Download, IdCard, Receipt, Activity, Loader2 } from 'lucide-react';

export function ExpenseClaimsPanel() {
  const { can, role, user } = useAccess();
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [claims, setClaims] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({
    categoryId: '',
    amount: '',
    expenseDate: '',
    description: '',
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionComment, setActionComment] = useState<Record<number, string>>({});

  const load = () => {
    void claimsApi.categories().then(({ categories: c }) => setCategories(c ?? [])).catch(() => {});
    void claimsApi.list().then(({ claims: c }) => setClaims(c ?? [])).catch(() => {});
  };
  useEffect(load, []);

  const submit = async () => {
    if (!form.categoryId || !form.amount || !form.expenseDate || !form.description.trim()) {
      toast.error('Fill all claim fields');
      return;
    }
    setBusy(true);
    try {
      await claimsApi.create({
        categoryId: form.categoryId,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        description: form.description,
        receipt,
      });
      toast.success('Claim submitted');
      setForm({ categoryId: '', amount: '', expenseDate: '', description: '' });
      setReceipt(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: number, action: 'approve' | 'reject' | 'clarification' | 'pay') => {
    const comment = (actionComment[id] || '').trim();
    if (!comment) {
      toast.error('Reason/comment is required');
      return;
    }
    try {
      await claimsApi.action(id, action, comment);
      toast.success(`Claim ${action}d`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
    }
  };

  const canApprove = role === 'admin' || role === 'hr' || role === 'manager';

  return (
    <div className="space-y-4">
      {can('attendance', 'create') && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> Submit expense claim
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={String(c.id)} value={String(c.id)}>
                      {String(c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Expense date</Label>
              <Input
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Receipt
                {categories.find((c) => String(c.id) === form.categoryId)?.requireReceipt
                  ? ' (required)'
                  : ' (optional)'}
              </Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button onClick={() => void submit()} disabled={busy} className="sm:col-span-2 w-fit">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit claim
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle>Claims {role === 'employee' ? '(yours)' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {claims.length === 0 && <p className="text-sm text-muted-foreground">No claims yet.</p>}
          {claims.map((c) => {
            const id = Number(c.id);
            return (
              <div key={id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {String(c.categoryName)} · {String(c.employeeName || user?.name)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(c.expenseDate).slice(0, 10)} · {Number(c.amount).toFixed(2)} · {String(c.description)}
                    </p>
                  </div>
                  <Badge>{String(c.status)}</Badge>
                </div>
                {canApprove && ['pending', 'clarification', 'approved'].includes(String(c.status)) && c.userId !== user?.id && (
                  <div className="flex flex-wrap gap-2 items-end">
                    <Input
                      placeholder="Mandatory reason / comment"
                      value={actionComment[id] || ''}
                      onChange={(e) => setActionComment((m) => ({ ...m, [id]: e.target.value }))}
                      className="max-w-sm"
                    />
                    {String(c.status) !== 'approved' && (
                      <>
                        <Button size="sm" onClick={() => void act(id, 'approve')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void act(id, 'reject')}>
                          Reject
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => void act(id, 'clarification')}>
                          Clarify
                        </Button>
                      </>
                    )}
                    {(role === 'admin' || role === 'hr') && String(c.status) === 'approved' && (
                      <Button size="sm" onClick={() => void act(id, 'pay')}>
                        Mark paid
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmployeeActivityPanel() {
  const { role, user } = useAccess();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(user?.id || '');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (role === 'admin' || role === 'hr' || role === 'manager') {
      void accessApi
        .users()
        .then(({ users: list }) => setUsers(list.map((u) => ({ id: u.id, name: u.name }))))
        .catch(() => {});
      void activityApi
        .report()
        .then(({ report: r }) => setReport(r ?? []))
        .catch(() => {});
    } else if (user?.id) {
      setSelected(user.id);
    }
  }, [role, user?.id]);

  useEffect(() => {
    if (!selected) return;
    void activityApi
      .employee(selected)
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [selected]);

  const stats = (data?.leaveStats as Record<string, number>) || {};
  const balances = (data?.balances as Record<string, unknown>[]) || [];

  const exportCsv = () => {
    const rows = report.length
      ? report
      : [
          {
            name: (data?.user as { name?: string })?.name,
            leaveAllocated: stats.entitlement,
            leaveUsed: stats.used,
            leaveRemaining: stats.remaining,
          },
        ];
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map((r) => Object.values(r).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'employee-activity-report.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {(role === 'admin' || role === 'hr' || role === 'manager') && (
          <div className="space-y-2 min-w-[220px]">
            <Label>Employee</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Entitlement', stats.entitlement],
          ['Taken', stats.used],
          ['Remaining', stats.remaining],
          ['Pending', stats.pending],
        ].map(([label, value]) => (
          <Card key={String(label)} className="border border-border rounded-xl">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-medium">{value ?? '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Leave balances
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {balances.map((b) => (
            <div key={String(b.code)} className="border rounded-lg p-3">
              <p className="font-medium">{String(b.type)}</p>
              <p className="text-sm text-muted-foreground">
                Used {Number(b.used)} / {Number(b.allocated)} · Remaining {Number(b.remaining)}
              </p>
            </div>
          ))}
          {balances.length === 0 && <p className="text-sm text-muted-foreground">No balance data.</p>}
        </CardContent>
      </Card>

      {(role === 'admin' || role === 'hr' || role === 'manager') && report.length > 0 && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle>Team / department leave summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.map((r) => (
              <div key={String(r.userId)} className="flex justify-between text-sm border-b py-2">
                <span>
                  {String(r.name)} · {String(r.department)}
                </span>
                <span>
                  Remaining {Number(r.leaveRemaining)} · Pending {Number(r.pendingLeave)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function CardsPanel() {
  const { role } = useAccess();
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [cards, setCards] = useState<Record<string, unknown>[]>([]);
  const canGenerate = role === 'admin' || role === 'hr';

  const load = () => {
    void cardsApi.generated().then(({ cards: c }) => setCards(c ?? [])).catch(() => {});
  };
  useEffect(() => {
    load();
    if (canGenerate) {
      void employeesApi
        .list()
        .then(({ employees: e }) => setEmployees(e ?? []))
        .catch(() => {});
    }
  }, [canGenerate]);

  const generate = async (kind: 'id_card' | 'business_card') => {
    if (!employeeId) {
      toast.error('Select an employee');
      return;
    }
    try {
      const { id, title } = await cardsApi.generate(Number(employeeId), kind);
      toast.success(`Generated: ${title}`);
      window.open(cardsApi.viewUrl(id), '_blank');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Generation failed');
    }
  };

  const bulk = async (kind: 'id_card' | 'business_card') => {
    for (const e of employees.slice(0, 20)) {
      try {
        await cardsApi.generate(Number(e.id), kind);
      } catch {
        /* continue */
      }
    }
    toast.success('Bulk generation finished');
    load();
  };

  return (
    <div className="space-y-4">
      {canGenerate && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="w-5 h-5 text-primary" /> ID & business cards
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2 min-w-[220px]">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={String(e.id)} value={String(e.id)}>
                      {String(e.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void generate('id_card')}>Generate ID card</Button>
            <Button variant="secondary" onClick={() => void generate('business_card')}>
              Generate business card
            </Button>
            <Button variant="outline" onClick={() => void bulk('id_card')}>
              Bulk ID cards
            </Button>
          </CardContent>
        </Card>
      )}
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle>Generated cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cards.length === 0 && <p className="text-sm text-muted-foreground">No cards generated yet.</p>}
          {cards.map((c) => (
            <div key={String(c.id)} className="flex justify-between items-center border rounded-lg p-3">
              <div>
                <p className="font-medium">{String(c.title)}</p>
                <p className="text-xs text-muted-foreground">{String(c.card_kind || c.cardKind)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.open(cardsApi.viewUrl(String(c.id)), '_blank')}>
                Preview / Print
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LeavePolicyPanel() {
  const { role } = useAccess();
  const [settings, setSettings] = useState({
    autoApproveEnabled: true,
    autoApproveDays: 20,
    countWeekends: false,
    countHolidays: false,
    requireApprovalComment: true,
  });
  const canEdit = role === 'admin' || role === 'hr';

  useEffect(() => {
    void leaveApi
      .policySettings()
      .then(({ settings: s }) => setSettings((prev) => ({ ...prev, ...s })))
      .catch(() => {});
  }, []);

  const save = async () => {
    try {
      const { settings: s } = await leaveApi.updatePolicySettings(settings);
      setSettings((prev) => ({ ...prev, ...(s as typeof settings) }));
      toast.success('Leave policy saved');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    }
  };

  if (!canEdit) return null;

  return (
    <Card className="border border-border rounded-xl">
      <CardHeader>
        <CardTitle>Leave policy & auto-approval</CardTitle>
        <p className="text-sm text-muted-foreground">
          Expense claims are never auto-approved. Leave auto-approval only runs after validating balance and overlaps.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label>Auto-approve leave after waiting period</Label>
          <Switch
            checked={settings.autoApproveEnabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, autoApproveEnabled: v }))}
          />
        </div>
        <div className="space-y-2 max-w-xs">
          <Label>Days before auto-approve</Label>
          <Input
            type="number"
            value={settings.autoApproveDays}
            onChange={(e) => setSettings((s) => ({ ...s, autoApproveDays: Number(e.target.value) || 20 }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label>Count weekends as leave</Label>
          <Switch
            checked={settings.countWeekends}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, countWeekends: v }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label>Count public holidays as leave</Label>
          <Switch
            checked={settings.countHolidays}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, countHolidays: v }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label>Require approval/rejection reason</Label>
          <Switch
            checked={settings.requireApprovalComment}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, requireApprovalComment: v }))}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void save()}>Save policy</Button>
          <Button
            variant="outline"
            onClick={() =>
              void leaveApi
                .runAutoApprove()
                .then((r) => toast.success(`Processed ${r.processed}: approved ${r.approved}, skipped ${r.skipped}`))
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Run auto-approve now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvancedModulesTabs() {
  return (
    <Tabs defaultValue="claims" className="space-y-4">
      <TabsList>
        <TabsTrigger value="claims">Claims</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="cards">Cards</TabsTrigger>
        <TabsTrigger value="policy">Leave policy</TabsTrigger>
      </TabsList>
      <TabsContent value="claims">
        <ExpenseClaimsPanel />
      </TabsContent>
      <TabsContent value="activity">
        <EmployeeActivityPanel />
      </TabsContent>
      <TabsContent value="cards">
        <CardsPanel />
      </TabsContent>
      <TabsContent value="policy">
        <LeavePolicyPanel />
      </TabsContent>
    </Tabs>
  );
}
