import type { AppUser, PermissionSet, Notice, AuditEntry } from './access';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'error' in body && String((body as { error: string }).error)) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: AppUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  me: () => api<{ user: AppUser | null }>('/api/auth/me'),
};

export type EmployeeRow = Record<string, unknown>;

export const employeesApi = {
  list: (params?: { q?: string; department?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.department) qs.set('department', params.department);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api<{ employees: EmployeeRow[]; total: number; page: number }>(`/api/employees${suffix}`);
  },
  get: (id: string | number) => api<{ employee: EmployeeRow }>(`/api/employees/${id}`),
  create: (payload: Record<string, unknown>) =>
    api<{ id: number }>('/api/employees', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string | number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string | number) => api<{ ok: boolean }>(`/api/employees/${id}`, { method: 'DELETE' }),
};

export const leaveApi = {
  types: () => api<{ types: Record<string, unknown>[] }>('/api/leave/types'),
  balances: (userId?: string) =>
    api<{ balances: Record<string, { used: number; total: number }>; year: number }>(
      userId ? `/api/leave/balances?userId=${encodeURIComponent(userId)}` : '/api/leave/balances',
    ),
  list: () => api<{ requests: Record<string, unknown>[] }>('/api/leave'),
  create: (payload: Record<string, unknown>) =>
    api<{ id: number }>('/api/leave', { method: 'POST', body: JSON.stringify(payload) }),
  approve: (id: number, approve: boolean, comment?: string) =>
    api<{ ok: boolean }>(`/api/leave/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve, comment }) }),
};

export const attendanceApi = {
  list: (userId?: string) =>
    api<{ attendance: Record<string, unknown>[] }>(
      userId ? `/api/attendance?userId=${encodeURIComponent(userId)}` : '/api/attendance',
    ),
  today: () => api<{ today: Record<string, unknown> | null }>('/api/attendance/today'),
  checkIn: (payload?: { latitude?: number; longitude?: number; accuracy?: number; locationLabel?: string }) =>
    api<{ ok: boolean }>('/api/attendance/check-in', { method: 'POST', body: JSON.stringify(payload ?? {}) }),
  checkOut: (payload?: { latitude?: number; longitude?: number; accuracy?: number; locationLabel?: string }) =>
    api<{ ok: boolean }>('/api/attendance/check-out', { method: 'POST', body: JSON.stringify(payload ?? {}) }),
};

export const timesheetsApi = {
  list: () => api<{ timesheets: Record<string, unknown>[] }>('/api/timesheets'),
  get: (id: number) =>
    api<{ timesheet: Record<string, unknown>; entries: Record<string, unknown>[] }>(`/api/timesheets/${id}`),
  create: (weekStart?: string) =>
    api<{ id: number }>('/api/timesheets', { method: 'POST', body: JSON.stringify({ weekStart }) }),
  addEntry: (id: number, payload: { workDate: string; hours: number; notes?: string }) =>
    api<{ ok: boolean }>(`/api/timesheets/${id}/entries`, { method: 'POST', body: JSON.stringify(payload) }),
  submit: (id: number) => api<{ ok: boolean }>(`/api/timesheets/${id}/submit`, { method: 'POST', body: '{}' }),
  approve: (id: number, approve: boolean, comment?: string) =>
    api<{ ok: boolean }>(`/api/timesheets/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approve, comment }),
    }),
};

export const dashboardApi = {
  stats: () =>
    api<{
      stats: {
        totalEmployees: number;
        activeEmployees: number;
        onLeave: number;
        pendingLeave: number;
        pendingTimesheets: number;
        attendanceRate: number;
        monthlyPayroll: number;
        newHires: number;
      };
    }>('/api/dashboard/stats'),
};

export const accessApi = {
  users: () => api<{ users: AppUser[] }>('/api/access/users'),
  permissions: () => api<{ roleTemplates: Record<'admin' | 'hr' | 'employee', PermissionSet> }>('/api/access/permissions'),
  updateUser: (id: string, body: Record<string, unknown>) =>
    api<{ user: AppUser }>(`/api/access/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createUser: (body: { name: string; email: string; role: string; department: string; password?: string }) =>
    api<{ user: AppUser }>('/api/access/users', { method: 'POST', body: JSON.stringify(body) }),
};

export const noticesApi = {
  list: () => api<{ notices: (Notice & { isRead?: boolean })[] }>('/api/notices'),
  create: (body: { title: string; body: string; kind: string; userId?: string }) =>
    api<{ id: string }>('/api/notices', { method: 'POST', body: JSON.stringify(body) }),
  markRead: (id: string) => api<{ ok: boolean }>(`/api/notices/${id}/read`, { method: 'POST', body: '{}' }),
};

export const auditApi = {
  list: (limit = 100) => api<{ audit: AuditEntry[] }>(`/api/audit?limit=${limit}`),
};

export const payrollApi = {
  runs: () => api<{ runs: Record<string, unknown>[] }>('/api/payroll/runs'),
};

export const recruitmentApi = {
  jobs: () => api<{ items: Record<string, unknown>[] }>('/api/recruitment'),
  candidates: () => api<{ candidates: Record<string, unknown>[] }>('/api/recruitment/candidates'),
};

export const performanceApi = {
  reviews: () => api<{ reviews: Record<string, unknown>[] }>('/api/performance/reviews'),
  goals: () => api<{ goals: Record<string, unknown>[] }>('/api/performance/goals'),
};

export const documentsApi = {
  list: () => api<{ documents: Record<string, unknown>[] }>('/api/documents'),
  upload: async (file: File, meta?: { title?: string; category?: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (meta?.title) fd.append('title', meta.title);
    if (meta?.category) fd.append('category', meta.category);
    const res = await fetch('/api/documents/upload', { method: 'POST', credentials: 'include', body: fd });
    const body = await parseJson(res);
    if (!res.ok) throw new ApiError(String((body as { error?: string })?.error ?? 'Upload failed'), res.status, body);
    return body as { id: string };
  },
};

export const settingsApi = {
  get: () => api<{ settings: Record<string, unknown> }>('/api/settings'),
  set: (key: string, value: unknown) =>
    api<{ ok: boolean }>(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
};

export const reportsApi = {
  summary: () => api<{ report: Record<string, number> }>('/api/reports/summary'),
};

export const shiftsApi = {
  list: () => api<{ shifts: Record<string, unknown>[] }>('/api/shifts'),
};