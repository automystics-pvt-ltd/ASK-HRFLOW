export type Role = 'admin' | 'hr' | 'employee' | 'manager';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export const ALL_ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'approve', 'export'];

export const MODULES = [
  'dashboard',
  'employees',
  'attendance',
  'payroll',
  'recruitment',
  'performance',
  'engagement',
  'ai-assistant',
  'notifications',
  'reports',
  'access',
  'audit',
  'login-activity',
  'settings',
] as const;

export type PermissionSet = Record<string, Action[]>;

const all = (): Action[] => [...ALL_ACTIONS];
const empty = (): PermissionSet =>
  Object.fromEntries(MODULES.map((m) => [m, [] as Action[]]));

export const defaultRolePermissions: Record<Role, PermissionSet> = {
  admin: Object.fromEntries(MODULES.map((m) => [m, all()])),
  hr: {
    ...empty(),
    dashboard: ['read'],
    employees: ['create', 'read', 'update', 'export'],
    attendance: ['create', 'read', 'update', 'approve', 'export'],
    payroll: ['read'],
    recruitment: ['create', 'read', 'update'],
    performance: ['read'],
    engagement: ['create', 'read'],
    'ai-assistant': ['read'],
    notifications: ['read'],
    reports: ['read', 'export'],
    'login-activity': ['read', 'export'],
    settings: ['read'],
  },
  manager: {
    ...empty(),
    dashboard: ['read'],
    employees: ['read'],
    attendance: ['create', 'read', 'approve'],
    payroll: ['read'],
    notifications: ['read'],
    performance: ['read'],
    engagement: ['read'],
    'ai-assistant': ['read'],
    reports: ['read', 'export'],
    'login-activity': ['read', 'export'],
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

export function hasAction(perms: PermissionSet, module: string, action: Action): boolean {
  return (perms[module] ?? []).includes(action);
}