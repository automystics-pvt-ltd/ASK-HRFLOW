import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  FileText,
  KeyRound,
  Loader2,
  MapPin,
  Palette,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAccess, roleLabels, type Role } from '../lib/access';
import { useRole } from '../lib/roles';
import { useBranding } from '../lib/branding';
import {
  authApi,
  brandingApi,
  claimsApi,
  documentsApi,
  employeesApi,
  holidaysApi,
  hrDocumentsApi,
  leaveTypesApi,
  preferencesApi,
  settingsApi,
  ApiError,
  type BrandingCompany,
  type BrandingTheme,
  type UserPreferences,
} from '../lib/api';
import { LeavePolicyPanel, CardsPanel } from './AdvancedHRPanels';
import { LocationMasterPanel } from './LocationMasterPanel';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
type DocRow = { id: string; title: string; category: string; mimeType: string; createdAt: string };

type SectionId =
  | 'account'
  | 'notifications'
  | 'company'
  | 'branding'
  | 'locations'
  | 'leave'
  | 'holidays'
  | 'documents'
  | 'hr-templates'
  | 'approvals'
  | 'payroll'
  | 'security'
  | 'team'
  | 'people';

const SECTIONS_BY_ROLE: Record<Role, SectionId[]> = {
  admin: [
    'company',
    'branding',
    'locations',
    'leave',
    'holidays',
    'payroll',
    'approvals',
    'hr-templates',
    'documents',
    'security',
    'notifications',
    'account',
  ],
  hr: ['people', 'leave', 'holidays', 'hr-templates', 'documents', 'payroll', 'notifications', 'account'],
  manager: ['team', 'approvals', 'notifications', 'account'],
  employee: ['account', 'notifications'],
};

const SECTION_META: Record<SectionId, { label: string; description: string; icon: React.ElementType }> = {
  account: { label: 'Account', description: 'Profile and password', icon: UserCircle },
  notifications: { label: 'Notifications', description: 'Alerts and digests', icon: Bell },
  company: { label: 'Company', description: 'Organization details', icon: Building2 },
  branding: { label: 'Branding', description: 'Logo and theme colors', icon: Palette },
  locations: { label: 'Locations', description: 'Country, district, city master', icon: MapPin },
  leave: { label: 'Leave', description: 'Leave types and policies', icon: Calendar },
  holidays: { label: 'Holidays', description: 'Public and company holidays', icon: Calendar },
  documents: { label: 'Documents', description: 'Uploaded HR files', icon: FileText },
  'hr-templates': { label: 'Templates', description: 'Offer and HR letter templates', icon: FileText },
  approvals: { label: 'Approvals', description: 'Workflows and team approvals', icon: ShieldCheck },
  payroll: { label: 'Payroll & claims', description: 'Expense categories and payroll notes', icon: Wallet },
  security: { label: 'Security & access', description: 'Users, roles, audit', icon: KeyRound },
  team: { label: 'Team', description: 'Manager team preferences', icon: Users },
  people: { label: 'People', description: 'Employees, onboarding, recruitment', icon: Users },
};

function ExpenseCategoriesAdmin({ canEdit }: { canEdit: boolean }) {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ code: '', name: '', maxAmount: '' });
  const load = () => {
    void claimsApi.categories().then(({ categories: c }) => setCategories(c ?? [])).catch(() => {});
  };
  useEffect(load, []);
  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Max amount</Label>
            <Input
              type="number"
              value={form.maxAmount}
              onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
            />
          </div>
          <Button
            onClick={() => {
              void claimsApi
                .createCategory({
                  code: form.code,
                  name: form.name,
                  maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
                })
                .then(() => {
                  toast.success('Category added');
                  setForm({ code: '', name: '', maxAmount: '' });
                  load();
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">View only — Admin manages claim category limits.</p>
      )}
      {categories.map((c) => (
        <div key={String(c.id)} className="flex justify-between items-center border rounded-lg p-3 text-sm">
          <span>
            {String(c.name)} <span className="text-muted-foreground">({String(c.code)})</span>
          </span>
          <span className="text-muted-foreground">{c.maxAmount != null ? `Max ${c.maxAmount}` : 'No max'}</span>
        </div>
      ))}
    </div>
  );
}

function AccountPanel() {
  const { user, setSessionUser, role } = useAccess();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { user: next } = await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      setSessionUser(next);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Role</p>
            <Badge variant="secondary">{roleLabels[role].label}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Department</p>
            <p className="font-medium">{user?.department || '—'}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Profile identity is managed by Admin/HR. Use Access Control or Employees to update directory details.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => void savePassword(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="cur-pass">Current password</Label>
              <Input
                id="cur-pass"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">New password</Label>
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Confirm password</Label>
              <Input
                id="confirm-pass"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <p className="text-xs text-muted-foreground">At least 8 characters with a letter and a number.</p>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsPanel({ role }: { role: Role }) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    preferencesApi
      .get()
      .then(({ preferences }) => setPrefs(preferences))
      .catch(() =>
        setPrefs({
          emailNotifications: true,
          inAppNotifications: true,
          leaveUpdates: true,
          approvalReminders: role !== 'employee',
          payrollAlerts: true,
          weeklyDigest: false,
          quietHours: false,
        }),
      );
  }, [role]);

  const save = async (next: UserPreferences) => {
    setPrefs(next);
    setSaving(true);
    try {
      const res = await preferencesApi.update(next);
      setPrefs(res.preferences);
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <Card className="border border-border rounded-xl">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const rows: { key: keyof UserPreferences; label: string; hint: string; show: boolean }[] = [
    { key: 'inAppNotifications', label: 'In-app notifications', hint: 'Show alerts in the Notifications module', show: true },
    { key: 'emailNotifications', label: 'Email notifications', hint: 'Send important updates to your email', show: true },
    { key: 'leaveUpdates', label: 'Leave updates', hint: 'Status changes on leave requests', show: true },
    {
      key: 'approvalReminders',
      label: 'Approval reminders',
      hint: 'Reminders for pending team/org approvals',
      show: role === 'admin' || role === 'hr' || role === 'manager',
    },
    { key: 'payrollAlerts', label: 'Payroll alerts', hint: 'Payslip availability and payroll notices', show: true },
    { key: 'weeklyDigest', label: 'Weekly digest', hint: 'Summary of activity once a week', show: true },
    { key: 'quietHours', label: 'Quiet hours', hint: 'Reduce non-urgent alerts outside work hours', show: true },
  ];

  return (
    <Card className="border border-border rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification preferences
          {saving ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows
          .filter((r) => r.show)
          .map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <Switch
                checked={Boolean(prefs[r.key])}
                onCheckedChange={(v) => void save({ ...prefs, [r.key]: v })}
                aria-label={r.label}
              />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

export function RoleSettings({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { can, role } = useRole();
  const acc = useAccess();
  const branding = useBranding();
  const sections = useMemo(() => SECTIONS_BY_ROLE[role] ?? SECTIONS_BY_ROLE.employee, [role]);
  const [tab, setTab] = useState<SectionId>(sections[0]);

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

  const canManageOrg = can.canManageCompany;
  const canManageLeave = canManageOrg || acc.can('attendance', 'update');
  const canManageHolidays = canManageOrg || acc.can('attendance', 'update');
  const canManageDocs = acc.can('employees', 'read');
  const canUploadDocs = acc.can('employees', 'create');
  const canSeeTemplates = (role === 'admin' || role === 'hr') && acc.can('settings', 'read');
  const canManageTemplates = canManageOrg || (role === 'hr' && acc.can('employees', 'update'));

  const visibleSections = useMemo(() => {
    return sections.filter((id) => {
      if (id === 'company' || id === 'branding' || id === 'locations' || id === 'security') return canManageOrg;
      if (id === 'leave' || id === 'holidays') return acc.can('attendance', 'read');
      if (id === 'documents' || id === 'people') return canManageDocs || acc.can('recruitment', 'read');
      if (id === 'hr-templates') return canSeeTemplates;
      if (id === 'payroll') return acc.can('payroll', 'read') || canManageOrg;
      if (id === 'approvals') return role === 'admin' || role === 'manager';
      if (id === 'team') return role === 'manager';
      return true;
    });
  }, [sections, canManageOrg, acc, canManageDocs, canSeeTemplates, role]);

  useEffect(() => {
    if (!visibleSections.includes(tab)) setTab(visibleSections[0] ?? 'account');
  }, [visibleSections, tab]);

  const loadDocuments = () => {
    if (!canManageDocs) return;
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
    if (canManageLeave) {
      leaveTypesApi.list().then(({ types }) => setLeaveTypes(types ?? [])).catch(() => {});
    }
    if (acc.can('attendance', 'read')) {
      holidaysApi.list().then(({ holidays: rows }) => setHolidays(rows ?? [])).catch(() => {});
    }
    if (canSeeTemplates) {
      hrDocumentsApi.templates().then(({ templates: rows }) => setTemplates(rows ?? [])).catch(() => {});
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

  const go = (id: string) => {
    if (onNavigate) onNavigate(id);
    else window.location.hash = `#/${id}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="text-muted-foreground">
          {roleLabels[role].label} · {SECTION_META[tab]?.description || 'Preferences for your role'}
        </p>
      </div>

      <Card className="border border-border rounded-xl">
        <CardContent className="py-4 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
          <Settings className="w-4 h-4" />
          Signed in as <span className="font-medium text-foreground">{roleLabels[role].label}</span>
          {company.name ? (
            <>
              · Organization <span className="font-medium text-foreground">{company.name}</span>
            </>
          ) : null}
          <span className="text-xs">· Only modules you can manage are listed below.</span>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SectionId)} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-accent/40 p-1">
          {visibleSections.map((id) => {
            const Icon = SECTION_META[id].icon;
            return (
              <TabsTrigger key={id} value={id} className="gap-1.5 data-[state=active]:bg-card">
                <Icon className="w-3.5 h-3.5" />
                {SECTION_META[id].label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <AccountPanel />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationsPanel role={role} />
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          {canManageOrg ? (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-w-xl">
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
                <Button
                  disabled={savingCompany}
                  onClick={() => {
                    setSavingCompany(true);
                    void brandingApi
                      .updateCompany(company)
                      .then(() => branding.refresh())
                      .then(() => toast.success('Company info saved'))
                      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'))
                      .finally(() => setSavingCompany(false));
                  }}
                >
                  {savingCompany ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save company
                </Button>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">You do not have permission to edit company details.</p>
          )}
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          {canManageOrg ? (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding & theme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <div className="flex items-center gap-4">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="h-12 max-w-[160px] object-contain" />
                  ) : (
                    <p className="text-sm text-muted-foreground">No custom logo</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void brandingApi
                        .uploadLogo(file)
                        .then(() => branding.refresh())
                        .then(() => toast.success('Logo uploaded'))
                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Logo upload failed'));
                    }}
                  />
                  {branding.logoUrl && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        void brandingApi
                          .removeLogo()
                          .then(() => branding.refresh())
                          .then(() => toast.success('Logo removed'))
                          .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'));
                      }}
                    >
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
                        value={String(
                          theme[key] ?? (key === 'primary' ? '#0b57f0' : key === 'secondary' ? '#0a2a7a' : '#1d6bff'),
                        )}
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
                <Button
                  onClick={() => {
                    void brandingApi
                      .updateTheme(theme)
                      .then(() => branding.refresh())
                      .then(() => toast.success('Theme saved'))
                      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'));
                  }}
                >
                  Save theme
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          {canManageOrg ? <LocationMasterPanel /> : null}
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          {(role === 'admin' || role === 'hr') && (
            <>
              <LeavePolicyPanel />
              {canManageLeave && (
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
                              setLtForm({
                                code: '',
                                name: '',
                                defaultDays: '10',
                                carryForward: false,
                                allowHalfDay: true,
                              });
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
                        <div
                          key={String(t.id)}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border/50"
                        >
                          <div>
                            <p className="font-medium">
                              {String(t.name)}{' '}
                              <span className="text-muted-foreground text-xs">({String(t.code)})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Number(t.defaultDays ?? 0)} days · half-day {t.allowHalfDay ? 'yes' : 'no'} ·
                              carry-forward {t.carryForward ? 'yes' : 'no'}
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
            </>
          )}
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          {canManageHolidays || acc.can('attendance', 'read') ? (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Holidays
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canManageHolidays && (
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
                      <Select
                        value={holidayForm.kind}
                        onValueChange={(v) => setHolidayForm({ ...holidayForm, kind: v })}
                      >
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
                )}
                <div className="space-y-2">
                  {holidays.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No holidays configured.</p>
                  ) : (
                    holidays.map((h) => (
                      <div
                        key={String(h.id)}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/50"
                      >
                        <div>
                          <p className="font-medium">{String(h.name)}</p>
                          <p className="text-xs text-muted-foreground">
                            {String(h.holidayDate)} · {String(h.kind)}
                          </p>
                        </div>
                        {canManageHolidays && (
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
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="hr-templates" className="space-y-4">
          {canSeeTemplates ? (
            <Card className="border border-border rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  HR document templates
                </CardTitle>
                {canUploadDocs && (
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
                          <Select
                            value={genForm.docType}
                            onValueChange={(v) => setGenForm({ ...genForm, docType: v })}
                          >
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
                    <div
                      key={String(t.id)}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/50"
                    >
                      <div>
                        <p className="font-medium">{String(t.name)}</p>
                        <p className="text-xs text-muted-foreground">
                          {String(t.docType)} · v{Number(t.version)}
                        </p>
                      </div>
                      {canManageTemplates ? (
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
                      ) : (
                        <Badge variant={t.active ? 'default' : 'secondary'}>
                          {t.active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {canManageDocs ? (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canUploadDocs && (
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
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (!file) return;
                          setUploading(true);
                          void documentsApi
                            .upload(file, { title: docTitle.trim() || file.name, category: 'general' })
                            .then(() => {
                              toast.success('Document uploaded');
                              setDocTitle('');
                              loadDocuments();
                            })
                            .catch((err) => toast.error(err instanceof Error ? err.message : 'Upload failed'))
                            .finally(() => setUploading(false));
                        }}
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
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50"
                      >
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
          ) : null}
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
          {(role === 'hr' || role === 'admin') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {acc.can('employees', 'read') && (
                <Card className="border border-border rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base">Employee management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Directory, onboarding fields, departments, and profiles.</p>
                    <Button onClick={() => go('employees')}>Open Employees</Button>
                  </CardContent>
                </Card>
              )}
              {acc.can('attendance', 'read') && (
                <Card className="border border-border rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base">Attendance & leave ops</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Daily attendance, timesheets, and leave requests.</p>
                    <Button variant="outline" onClick={() => go('attendance')}>
                      Open Attendance
                    </Button>
                  </CardContent>
                </Card>
              )}
              {acc.can('recruitment', 'read') && (
                <Card className="border border-border rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base">Recruitment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Job openings and candidate pipeline settings live in Recruitment.</p>
                    <Button variant="outline" onClick={() => go('recruitment')}>
                      Open Recruitment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          {(role === 'admin' || role === 'hr') && (
            <>
              {role === 'admin' && <CardsPanel />}
              <Card className="border border-border rounded-xl">
                <CardHeader>
                  <CardTitle>Expense categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpenseCategoriesAdmin canEdit={canManageOrg} />
                </CardContent>
              </Card>
              <Card className="border border-border rounded-xl">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  Payroll structures and pay runs are managed in the{' '}
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => go('payroll')}>
                    Payroll
                  </button>{' '}
                  module. HR has read access; Admin can process pay runs.
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          {(role === 'admin' || role === 'manager') && (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Approval preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {role === 'admin' ? (
                  <p>
                    Configure leave auto-approval and workflows under the Leave tab. Open{' '}
                    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => go('notifications')}>
                      Notifications
                    </button>{' '}
                    for the approval inbox.
                  </p>
                ) : (
                  <p>
                    As a manager you approve team leave and claims with a required comment. Turn on approval reminders under
                    the Notifications tab, then open the{' '}
                    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => go('notifications')}>
                      Notifications
                    </button>{' '}
                    inbox to action pending items.
                  </p>
                )}
                <Button type="button" variant="outline" onClick={() => setTab('notifications')}>
                  Edit notification preferences
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {role === 'manager' && (
            <Card className="border border-border rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Review your team directory and attendance from{' '}
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => go('employees')}>
                    Employees
                  </button>{' '}
                  and{' '}
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => go('attendance')}>
                    Attendance
                  </button>
                  . Approval reminders are controlled in the Notifications tab.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {role === 'admin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border border-border rounded-xl">
                <CardHeader>
                  <CardTitle>Users, roles & permissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Manage roles, user permissions, password recovery, and demo accounts.</p>
                  <Button onClick={() => go('access')}>Open Access Control</Button>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-xl">
                <CardHeader>
                  <CardTitle>Departments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Departments are maintained on employee records. Use Employees to assign and filter by department.</p>
                  <Button variant="outline" onClick={() => go('employees')}>
                    Open Employees
                  </Button>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-xl">
                <CardHeader>
                  <CardTitle>Audit trail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Review system activity and security-relevant events.</p>
                  <Button variant="outline" onClick={() => go('audit')}>
                    Open Audit Logs
                  </Button>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-xl">
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>ASK AI assistant, branding assets, and MySQL are configured for this deployment.</p>
                  <p className="text-xs">External payroll/SSO connectors can be added without changing role Settings tabs.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
