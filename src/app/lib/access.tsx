import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accessApi, auditApi, authApi, noticesApi, ApiError } from './api';

export type Role = 'admin' | 'hr' | 'employee';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
export const actions: Action[] = ['create', 'read', 'update', 'delete', 'approve', 'export'];

export interface ModuleDef { id: string; label: string; description: string; adminOnly?: boolean }
export const modules: ModuleDef[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Role dashboards and KPIs' },
  { id: 'employees', label: 'Employees', description: 'Directory, profiles, onboarding' },
  { id: 'attendance', label: 'Attendance & Leave', description: 'Check-in, timesheets, leave workflows' },
  { id: 'payroll', label: 'Payroll', description: 'Salary structures, processing, payslips' },
  { id: 'recruitment', label: 'Recruitment', description: 'Openings, candidates, offers' },
  { id: 'performance', label: 'Performance', description: 'Goals, reviews, appraisals' },
  { id: 'engagement', label: 'Engagement', description: 'Announcements and recognition' },
  { id: 'ai-assistant', label: 'AI Assistant', description: 'HR assistant chatbot' },
  { id: 'notifications', label: 'Notifications', description: 'In-app alerts and approvals' },
  { id: 'reports', label: 'Reports', description: 'Analytics and exports' },
  { id: 'access', label: 'Access Control', description: 'Users, roles and permissions', adminOnly: true },
  { id: 'audit', label: 'Audit Logs', description: 'System activity trail', adminOnly: true },
  { id: 'settings', label: 'Organization Settings', description: 'Company, policies, configuration' },
];
export const moduleLabel = (id: string) => modules.find((m) => m.id === id)?.label ?? id;

export type PermissionSet = Record<string, Action[]>;
const all = (): Action[] => [...actions];
const empty = (): PermissionSet => Object.fromEntries(modules.map((m) => [m.id, [] as Action[]]));

export const defaultRolePermissions: Record<Role, PermissionSet> = {
  admin: Object.fromEntries(modules.map((m) => [m.id, all()])),
  hr: {
    ...empty(),
    dashboard: ['read'],
    employees: ['create', 'read', 'update', 'export'],
    attendance: ['create', 'read', 'update', 'approve', 'export'],
    recruitment: ['create', 'read', 'update'],
    performance: ['read'],
    engagement: ['create', 'read'],
    'ai-assistant': ['read'],
    notifications: ['read'],
    settings: ['read'],
  },
  employee: {
    ...empty(),
    dashboard: ['read'],
    attendance: ['create', 'read'],
    payroll: ['read'],
    performance: ['read'],
    engagement: ['read'],
    'ai-assistant': ['read'],
    notifications: ['read'],
    settings: ['read'],
  },
};

export const roleLabels: Record<Role, { label: string; description: string }> = {
  admin: { label: 'Admin', description: 'Full system control' },
  hr: { label: 'HR', description: 'Configurable administrative access' },
  employee: { label: 'Employee', description: 'Self-service access' },
};

export const departments = ['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance'];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  active: boolean;
  permissions?: PermissionSet;
  departmentAccess: string[];
  lastLogin?: string;
}
export interface AuditEntry { id: string; ts: string; actorId: string; actorName: string; event: string; targetId?: string; detail: string }
export interface Notice { id: string; ts: string; userId: string | 'all'; title: string; body: string; read: string[]; kind: 'approval' | 'access' | 'announcement' | 'alert' }

const seedNotices: Notice[] = [
  { id: 'n1', ts: new Date(Date.now() - 3600e3).toISOString(), userId: 'all', title: 'Company holiday', body: 'Offices are closed on the upcoming public holiday.', read: [], kind: 'announcement' },
  { id: 'n2', ts: new Date(Date.now() - 7200e3).toISOString(), userId: 'u-hr', title: 'Leave request pending', body: 'Sarah Johnson requested 3 days of annual leave.', read: [], kind: 'approval' },
  { id: 'n3', ts: new Date(Date.now() - 9000e3).toISOString(), userId: 'u-admin', title: '3 approvals pending', body: 'Timesheets and leave requests are waiting for review.', read: [], kind: 'approval' },
];

const K = { roles: 'hrflow.roles.v1', audit: 'hrflow.audit.v1', notices: 'hrflow.notices.v1' };
function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

interface Ctx {
  user: AppUser | null;
  role: Role;
  users: AppUser[];
  roleTemplates: Record<Role, PermissionSet>;
  audit: AuditEntry[];
  notices: Notice[];
  unread: number;
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  permissionsOf: (u: AppUser) => PermissionSet;
  can: (module: string, action: Action) => boolean;
  setUserPermission: (userId: string, module: string, action: Action, on: boolean) => string | null;
  resetUserPermissions: (userId: string) => string | null;
  setRoleTemplate: (role: Role, module: string, action: Action, on: boolean) => string | null;
  setUserRole: (userId: string, role: Role) => string | null;
  setUserActive: (userId: string, active: boolean) => string | null;
  setDepartmentAccess: (userId: string, dept: string, on: boolean) => string | null;
  createUser: (u: { name: string; email: string; role: Role; department: string }) => string | null;
  log: (event: string, detail: string, targetId?: string) => void;
  notify: (n: Omit<Notice, 'id' | 'ts' | 'read'>) => void;
  markRead: (id?: string) => void;
}
const AccessContext = createContext<Ctx | null>(null);
const uid = () => Math.random().toString(36).slice(2, 9);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<Record<Role, PermissionSet>>(() => load(K.roles, defaultRolePermissions));
  const [audit, setAudit] = useState<AuditEntry[]>(() => load(K.audit, []));
  const [notices, setNotices] = useState<Notice[]>(() => load(K.notices, seedNotices));

  useEffect(() => localStorage.setItem(K.roles, JSON.stringify(roleTemplates)), [roleTemplates]);
  useEffect(() => localStorage.setItem(K.audit, JSON.stringify(audit.slice(0, 500))), [audit]);
  useEffect(() => localStorage.setItem(K.notices, JSON.stringify(notices)), [notices]);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setSessionUser(user))
      .catch(() => setSessionUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    accessApi
      .permissions()
      .then(({ roleTemplates: rt }) => setRoleTemplates((prev) => ({ ...prev, ...rt })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    accessApi
      .users()
      .then(({ users: list }) => setUsers(list))
      .catch(() => setUsers([sessionUser]));
    noticesApi
      .list()
      .then(({ notices: list }) =>
        setNotices(
          list.map((n) => ({
            id: n.id,
            ts: n.ts,
            userId: n.userId,
            title: n.title,
            body: n.body,
            kind: n.kind,
            read: n.read ?? [],
          })),
        ),
      )
      .catch(() => {});
    if (sessionUser.role === 'admin' || sessionUser.permissions?.audit?.includes('read')) {
      auditApi
        .list(200)
        .then(({ audit: rows }) => setAudit(rows))
        .catch(() => {});
    }
  }, [sessionUser?.id]);

  const user = sessionUser;
  const permissionsOf = useCallback(
    (u: AppUser): PermissionSet =>
      u.role === 'admin' ? defaultRolePermissions.admin : u.permissions ?? roleTemplates[u.role] ?? defaultRolePermissions[u.role],
    [roleTemplates],
  );
  const can = useCallback(
    (module: string, action: Action) => !!user && (permissionsOf(user)[module] ?? []).includes(action),
    [user, permissionsOf],
  );

  const log = useCallback((event: string, detail: string, targetId?: string) => {
    setAudit((a) => [{ id: uid(), ts: new Date().toISOString(), actorId: user?.id ?? 'system', actorName: user?.name ?? 'System', event, detail, targetId }, ...a]);
  }, [user]);

  const notify = useCallback((n: Omit<Notice, 'id' | 'ts' | 'read'>) => {
    setNotices((a) => [{ ...n, id: uid(), ts: new Date().toISOString(), read: [] }, ...a]);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { user: u } = await authApi.login(email, password);
      setSessionUser(u);
      log('Login', `${u.name} signed in`, u.id);
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Sign in failed.';
      return { ok: false as const, error: msg };
    }
  }, [log]);

  const logout = useCallback(async () => {
    if (user) log('Logout', `${user.name} signed out`, user.id);
    try {
      await authApi.logout();
    } catch {
      /* cookie cleared client-side anyway */
    }
    setSessionUser(null);
    setUsers([]);
  }, [user, log]);

  const canManage = (target?: AppUser): string | null => {
    if (!user || !can('access', 'update')) return 'You do not have permission to manage access.';
    if (target?.role === 'admin' && user.role !== 'admin') return 'Only an Admin can change Admin accounts.';
    return null;
  };
  const grantable = (module: string, action: Action) => user?.role === 'admin' || can(module, action);
  const patchUser = (id: string, fn: (u: AppUser) => AppUser) => setUsers((all) => all.map((u) => (u.id === id ? fn(u) : u)));

  const setUserPermission: Ctx['setUserPermission'] = (id, module, action, on) => {
    const t = users.find((u) => u.id === id); const err = canManage(t); if (err || !t) return err ?? 'User not found.';
    if (t.role === 'admin') return 'Admin permissions are fixed.';
    if (on && !grantable(module, action)) return 'You cannot grant a permission you do not hold.';
    if (module === 'access' && user?.role !== 'admin') return 'Only an Admin can change Access Control permissions.';
  const base = { ...permissionsOf(t) };
    const set = new Set(base[module] ?? []); on ? set.add(action) : set.delete(action);
    const permissions = { ...base, [module]: actions.filter((a) => set.has(a)) };
    void accessApi.updateUser(id, { permissions }).then(({ user: nu }) => patchUser(id, () => nu)).catch(() => {
      patchUser(id, (u) => ({ ...u, permissions }));
    });
    log('Permission changed', `${on ? 'Granted' : 'Revoked'} ${action.toUpperCase()} on ${moduleLabel(module)} for ${t.name}`, id);
    notify({ userId: id, kind: 'access', title: 'Your access was updated', body: `${action.toUpperCase()} on ${moduleLabel(module)} was ${on ? 'enabled' : 'disabled'}.` });
    return null;
  };
  const resetUserPermissions: Ctx['resetUserPermissions'] = (id) => {
    const t = users.find((u) => u.id === id); const err = canManage(t); if (err || !t) return err ?? 'User not found.';
    patchUser(id, ({ permissions, ...u }) => u);
    log('Permissions reset', `${t.name} reset to ${roleLabels[t.role].label} defaults`, id);
    return null;
  };
  const setRoleTemplate: Ctx['setRoleTemplate'] = (role, module, action, on) => {
    if (user?.role !== 'admin') return 'Only an Admin can edit role templates.';
    if (role === 'admin') return 'Admin permissions are fixed.';
    setRoleTemplates((r) => {
      const set = new Set(r[role][module] ?? []); on ? set.add(action) : set.delete(action);
      return { ...r, [role]: { ...r[role], [module]: actions.filter((a) => set.has(a)) } };
    });
    log('Role template changed', `${on ? 'Granted' : 'Revoked'} ${action.toUpperCase()} on ${moduleLabel(module)} for role ${roleLabels[role].label}`);
    return null;
  };
  const setUserRole: Ctx['setUserRole'] = (id, role) => {
    const t = users.find((u) => u.id === id); const err = canManage(t); if (err || !t) return err ?? 'User not found.';
    if (role === 'admin' && user?.role !== 'admin') return 'Only an Admin can assign the Admin role.';
    if (id === user?.id) return 'You cannot change your own role.';
    void accessApi.updateUser(id, { role }).then(({ user: nu }) => patchUser(id, () => nu)).catch(() => patchUser(id, ({ permissions, ...u }) => ({ ...u, role })));
    log('Role assigned', `${t.name}: ${roleLabels[t.role].label} → ${roleLabels[role].label}`, id);
    notify({ userId: id, kind: 'access', title: 'Your role changed', body: `You are now ${roleLabels[role].label}.` });
    return null;
  };
  const setUserActive: Ctx['setUserActive'] = (id, active) => {
    const t = users.find((u) => u.id === id); const err = canManage(t); if (err || !t) return err ?? 'User not found.';
    if (id === user?.id) return 'You cannot deactivate your own account.';
    void accessApi.updateUser(id, { active }).then(({ user: nu }) => patchUser(id, () => nu)).catch(() => patchUser(id, (u) => ({ ...u, active })));
    log(active ? 'Account activated' : 'Account deactivated', `${t.name} was ${active ? 'activated' : 'deactivated'}`, id);
    return null;
  };
  const setDepartmentAccess: Ctx['setDepartmentAccess'] = (id, dept, on) => {
    const t = users.find((u) => u.id === id); const err = canManage(t); if (err || !t) return err ?? 'User not found.';
    patchUser(id, (u) => ({ ...u, departmentAccess: on ? Array.from(new Set([...u.departmentAccess, dept])) : u.departmentAccess.filter((d) => d !== dept) }));
    log('Department access', `${on ? 'Granted' : 'Removed'} ${dept} access for ${t.name}`, id);
    return null;
  };
  const createUser: Ctx['createUser'] = (n) => {
    const err = canManage(); if (err) return err;
    if (!can('access', 'create')) return 'You do not have permission to create users.';
    if (n.role === 'admin' && user?.role !== 'admin') return 'Only an Admin can create Admin accounts.';
    if (users.some((u) => u.email.toLowerCase() === n.email.trim().toLowerCase())) return 'A user with this email already exists.';
    void accessApi
      .createUser({ name: n.name, email: n.email, role: n.role, department: n.department })
      .then(({ user: nu }) => {
        setUsers((a) => [...a, nu]);
        log('User created', `${nu.name} created as ${roleLabels[nu.role].label}`, nu.id);
        notify({ userId: 'u-admin', kind: 'alert', title: 'New user onboarded', body: `${nu.name} (${roleLabels[nu.role].label}) joined ${nu.department}.` });
      })
      .catch(() => {
        const nu: AppUser = {
          id: 'u-' + uid(),
          name: n.name.trim(),
          email: n.email.trim(),
          role: n.role,
          department: n.department,
          active: true,
          departmentAccess: n.role === 'employee' ? [] : n.role === 'admin' ? departments : [n.department],
        };
        setUsers((a) => [...a, nu]);
      });
    return null;
  };

  const visible = (n: Notice) => !!user && (n.userId === 'all' || n.userId === user.id);
  const unread = notices.filter((n) => visible(n) && !n.read.includes(user?.id ?? '')).length;
  const markRead = (id?: string) => {
    if (id) void noticesApi.markRead(id).catch(() => {});
    setNotices((all) =>
      all.map((n) =>
        visible(n) && (!id || n.id === id) && user && !n.read.includes(user.id) ? { ...n, read: [...n.read, user.id] } : n,
      ),
    );
  };

  const value: Ctx = {
    user, role: user?.role ?? 'employee', users, roleTemplates, audit, notices: notices.filter(visible), unread, authReady,
    login, logout, permissionsOf, can, setUserPermission, resetUserPermissions, setRoleTemplate, setUserRole, setUserActive,
    setDepartmentAccess, createUser, log, notify, markRead,
  };
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const c = useContext(AccessContext);
  if (!c) throw new Error('useAccess must be used inside AccessProvider');
  return c;
}