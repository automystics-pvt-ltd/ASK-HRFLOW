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
    api<{ balances: Record<string, { used: number; total: number; remaining?: number }>; year: number }>(
      userId ? `/api/leave/balances?userId=${encodeURIComponent(userId)}` : '/api/leave/balances',
    ),
  list: () => api<{ requests: Record<string, unknown>[] }>('/api/leave'),
  create: (payload: Record<string, unknown>) =>
    api<{ id: number; days?: number }>('/api/leave', { method: 'POST', body: JSON.stringify(payload) }),
  approve: (id: number, approve: boolean, comment?: string) =>
    api<{ ok: boolean }>(`/api/leave/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve, comment }) }),
  policySettings: () =>
    api<{
      settings: {
        autoApproveEnabled: boolean;
        autoApproveDays: number;
        countWeekends: boolean;
        countHolidays: boolean;
        requireApprovalComment: boolean;
      };
    }>('/api/leave/policy-settings'),
  updatePolicySettings: (payload: Record<string, unknown>) =>
    api<{ settings: Record<string, unknown> }>('/api/leave/policy-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  calculateDays: (startDate: string, endDate: string, halfDay?: boolean) =>
    api<{ days: number }>('/api/leave/calculate-days', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, halfDay }),
    }),
  previewDays: (start: string, end: string, halfDay?: boolean) =>
    api<{ days: number }>('/api/leave/calculate-days', {
      method: 'POST',
      body: JSON.stringify({ startDate: start, endDate: end, halfDay }),
    }),
  summary: (userId?: string, year?: number) => {
    const qs = new URLSearchParams();
    if (userId) qs.set('userId', userId);
    if (year) qs.set('year', String(year));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api<{ byType: Record<string, unknown>[]; rollups: Record<string, unknown> }>(`/api/leave/summary${suffix}`);
  },
  runAutoApprove: () =>
    api<{ processed: number; approved: number; skipped: number }>('/api/leave/run-auto-approve', {
      method: 'POST',
      body: '{}',
    }),
};

export const claimsApi = {
  categories: () => api<{ categories: Record<string, unknown>[] }>('/api/claims/categories'),
  createCategory: (payload: Record<string, unknown>) =>
    api<{ id: number }>('/api/claims/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id: number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/claims/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  list: () => api<{ claims: Record<string, unknown>[] }>('/api/claims'),
  create: async (payload: {
    categoryId: number | string;
    amount: number;
    expenseDate: string;
    description: string;
    receipt?: File | null;
  }) => {
    const fd = new FormData();
    fd.append('categoryId', String(payload.categoryId));
    fd.append('amount', String(payload.amount));
    fd.append('expenseDate', payload.expenseDate);
    fd.append('description', payload.description);
    if (payload.receipt) fd.append('receipt', payload.receipt);
    const res = await fetch('/api/claims', { method: 'POST', credentials: 'include', body: fd });
    const body = await parseJson(res);
    if (!res.ok) throw new ApiError(String((body as { error?: string })?.error ?? 'Claim failed'), res.status, body);
    return body as { id: number };
  },
  action: (id: number, action: 'approve' | 'reject' | 'clarification' | 'pay', comment: string, approvedAmount?: number) =>
    api<{ ok: boolean; status?: string }>(`/api/claims/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, comment, approvedAmount }),
    }),
};

export const activityApi = {
  employee: (userId: string, year?: number) =>
    api<Record<string, unknown>>(
      `/api/activity/employee/${encodeURIComponent(userId)}${year ? `?year=${year}` : ''}`,
    ),
  report: (params?: { department?: string; manager?: string; managerId?: string; dateFrom?: string; dateTo?: string }) => {
    const q = new URLSearchParams();
    if (params?.department) q.set('department', params.department);
    if (params?.manager) q.set('manager', params.manager);
    if (params?.managerId) q.set('manager', params.managerId);
    if (params?.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params?.dateTo) q.set('dateTo', params.dateTo);
    const qs = q.toString();
    return api<{ report: Record<string, unknown>[]; employees?: Record<string, unknown>[] }>(
      `/api/activity/report${qs ? `?${qs}` : ''}`,
    );
  },
};

export const cardsApi = {
  templates: () => api<{ templates: Record<string, unknown>[] }>('/api/cards/templates'),
  generate: (employeeIdOrPayload: number | { employeeId: number; cardKind: 'id_card' | 'business_card'; templateId?: string }, cardKind?: 'id_card' | 'business_card') => {
    const payload =
      typeof employeeIdOrPayload === 'object'
        ? employeeIdOrPayload
        : { employeeId: employeeIdOrPayload, cardKind: cardKind || 'id_card' };
    return api<{ id: string; title: string; html?: string }>('/api/cards/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  generated: () => api<{ cards: Record<string, unknown>[] }>('/api/cards/generated'),
  get: (id: string) => api<{ card: Record<string, unknown> }>(`/api/cards/generated/${id}`),
  viewUrl: (id: string) => `/api/cards/generated/${id}?format=html`,
};

export const attendanceApi = {
  list: (userId?: string) =>
    api<{ attendance: Record<string, unknown>[] }>(
      userId ? `/api/attendance?userId=${encodeURIComponent(userId)}` : '/api/attendance',
    ),
  today: () => api<{ today: Record<string, unknown> | null }>('/api/attendance/today'),
  checkIn: (payload?: { latitude?: number; longitude?: number; accuracy?: number; locationLabel?: string }) =>
    api<{
      ok: boolean;
      checkIn?: string;
      location?: string | null;
      locationAddress?: string | null;
    }>('/api/attendance/check-in', { method: 'POST', body: JSON.stringify(payload ?? {}) }),
  checkOut: (payload?: { latitude?: number; longitude?: number; accuracy?: number; locationLabel?: string }) =>
    api<{
      ok: boolean;
      checkOut?: string;
      location?: string | null;
      locationAddress?: string | null;
    }>('/api/attendance/check-out', { method: 'POST', body: JSON.stringify(payload ?? {}) }),
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
  permissions: () =>
    api<{ roleTemplates: Record<'admin' | 'hr' | 'employee' | 'manager', PermissionSet> }>('/api/access/permissions'),
  updateRoleTemplate: (role: 'admin' | 'hr' | 'employee' | 'manager', permissions: PermissionSet) =>
    api<{ ok: boolean }>(`/api/access/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
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
  payslips: () => api<{ payslips: Record<string, unknown>[] }>('/api/payroll/payslips'),
  process: (payload: {
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    previewOnly?: boolean;
    lock?: boolean;
  }) =>
    api<{ id?: number; total: number; employeesProcessed?: number; preview?: boolean; employees?: unknown[] }>(
      '/api/payroll/runs',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  components: () => api<{ components: Record<string, unknown>[] }>('/api/payroll/components'),
  salaryStructure: (employeeId: number) =>
    api<{ structures: Record<string, unknown>[] }>(`/api/payroll/salary-structure/${employeeId}`),
  saveSalaryStructure: (
    employeeId: number,
    payload: { effectiveFrom: string; basic: number; components?: unknown; notes?: string },
  ) =>
    api<{ id: number }>(`/api/payroll/salary-structure/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  payslipHtmlUrl: (id: number | string) => `/api/payroll/payslips/${id}/html`,
};

export const recruitmentApi = {
  jobs: () => api<{ items: Record<string, unknown>[] }>('/api/recruitment'),
  createJob: (payload: {
    title: string;
    department: string;
    location?: string;
    status?: string;
    description?: string;
  }) => api<{ id: number }>('/api/recruitment', { method: 'POST', body: JSON.stringify(payload) }),
  updateJob: (id: number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/recruitment/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  candidates: () => api<{ candidates: Record<string, unknown>[] }>('/api/recruitment/candidates'),
  createCandidate: (payload: { jobOpeningId: number; name: string; email: string; stage?: string }) =>
    api<{ id: number }>('/api/recruitment/candidates', { method: 'POST', body: JSON.stringify(payload) }),
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
  create: (payload: { name: string; startTime: string; endTime: string; graceMinutes?: number }) =>
    api<{ id: number }>('/api/shifts', { method: 'POST', body: JSON.stringify(payload) }),
};

export type BrandingCompany = {
  name?: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone?: string;
  currency?: string;
};

export type BrandingTheme = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mode?: 'system' | 'light' | 'dark';
};

export const brandingApi = {
  get: () =>
    api<{ company: BrandingCompany; theme: BrandingTheme; logoUrl: string | null }>('/api/branding'),
  updateCompany: (company: BrandingCompany) =>
    api<{ company: BrandingCompany }>('/api/branding/company', {
      method: 'PUT',
      body: JSON.stringify(company),
    }),
  updateTheme: (theme: BrandingTheme) =>
    api<{ theme: BrandingTheme }>('/api/branding/theme', {
      method: 'PUT',
      body: JSON.stringify(theme),
    }),
  uploadLogo: async (file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch('/api/branding/logo', { method: 'POST', credentials: 'include', body: fd });
    const body = await parseJson(res);
    if (!res.ok) throw new ApiError(String((body as { error?: string })?.error ?? 'Upload failed'), res.status, body);
    return body as { logoUrl: string };
  },
  removeLogo: () => api<{ ok: boolean; logoUrl: null }>('/api/branding/logo', { method: 'DELETE' }),
};

export const hrDocumentsApi = {
  templates: () => api<{ templates: Record<string, unknown>[] }>('/api/hr-documents/templates'),
  activateTemplate: (id: string, active: boolean) =>
    api<{ ok: boolean }>(`/api/hr-documents/templates/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ active }),
    }),
  generate: (payload: { employeeId: number; docType: string; fields?: Record<string, string> }) =>
    api<{ id: string; title: string }>('/api/hr-documents/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  generated: () => api<{ documents: Record<string, unknown>[] }>('/api/hr-documents/generated'),
  viewUrl: (id: string) => `/api/hr-documents/generated/${id}`,
};

export const holidaysApi = {
  list: (year?: number) =>
    api<{ holidays: Record<string, unknown>[] }>(
      year ? `/api/holidays?year=${year}` : '/api/holidays',
    ),
  create: (payload: {
    name: string;
    holidayDate: string;
    kind?: string;
    location?: string;
    active?: boolean;
  }) => api<{ id: number }>('/api/holidays', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/holidays/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: number) => api<{ ok: boolean }>(`/api/holidays/${id}`, { method: 'DELETE' }),
};

export const leaveTypesApi = {
  list: () => api<{ types: Record<string, unknown>[] }>('/api/leave/types'),
  create: (payload: Record<string, unknown>) =>
    api<{ id: number }>('/api/leave/types', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/leave/types/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
};

export const approvalsApi = {
  workflows: () => api<{ workflows: Record<string, unknown>[] }>('/api/approvals/workflows'),
  updateWorkflow: (id: number, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/api/approvals/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  inbox: () => api<{ inbox: Record<string, unknown>[] }>('/api/approvals/inbox'),
  action: (id: number, action: 'approve' | 'reject' | 'request_changes', comment?: string) =>
    api<{ ok: boolean }>(`/api/approvals/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, comment }),
    }),
  runAutoApprove: () =>
    api<{ processed: number; approved: number; skipped: number }>('/api/approvals/run-auto-approve'),
};