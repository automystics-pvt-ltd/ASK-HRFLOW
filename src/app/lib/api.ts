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
    api<{ user: import('./access').AppUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  me: () => api<{ user: import('./access').AppUser | null }>('/api/auth/me'),
};

export const employeesApi = {
  list: () => api<{ employees: Record<string, unknown>[] }>('/api/employees'),
  get: (id: string | number) => api<{ employee: Record<string, unknown> }>(`/api/employees/${id}`),
};

export const leaveApi = {
  list: () => api<{ requests: Record<string, unknown>[] }>('/api/leave'),
  create: (payload: Record<string, unknown>) =>
    api('/api/leave', { method: 'POST', body: JSON.stringify(payload) }),
  approve: (id: number, approve: boolean, comment?: string) =>
    api(`/api/leave/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve, comment }) }),
};

export const dashboardApi = {
  stats: () => api<{ stats: Record<string, number> }>('/api/dashboard/stats'),
};

export const accessApi = {
  users: () => api<{ users: import('./access').AppUser[] }>('/api/access/users'),
  permissions: () => api<{ roleTemplates: import('./access').PermissionSet }>('/api/access/permissions'),
};