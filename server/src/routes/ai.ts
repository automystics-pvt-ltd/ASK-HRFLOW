import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission } from '../middleware/rbac.js';
import { hasAction } from '../lib/permissions.js';
import { teamUserIds } from '../lib/team.js';

const router = Router();

type ChatCtx = {
  module?: string;
};

function suggestionsFor(role: string): string[] {
  if (role === 'admin' || role === 'hr') {
    return ['Team leave overview', 'Upcoming holidays', 'Pending approvals', 'How do I run payroll?'];
  }
  if (role === 'manager') {
    return ['My team leave', 'Pending team approvals', 'Upcoming holidays', 'How do timesheets work?'];
  }
  return ['My leave balance', 'Upcoming holidays', 'My attendance', 'How do I request leave?'];
}

async function leaveBalanceText(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await query<{ code: string; name: string; total: number; used: number }>(
    `SELECT lt.code, lt.name,
            COALESCE(lb.allocated, lt.default_days, 0) AS total,
            COALESCE(lb.used, 0) AS used
     FROM leave_types lt
     LEFT JOIN leave_balances lb
       ON lb.leave_type_id = lt.id AND lb.user_id = $1 AND lb.year = $2 AND lb.tenant_id = $3
     WHERE lt.tenant_id = $3 AND lt.active = 1
     ORDER BY lt.name`,
    [userId, year, DEFAULT_TENANT],
  );
  if (!rows.length) return 'I could not find leave balance records for your account yet.';
  const lines = rows.map((r) => {
    const remaining = Number(r.total) - Number(r.used);
    return `• ${r.name} (${r.code}): ${remaining} remaining of ${r.total} (used ${r.used})`;
  });
  return `Your leave balances for ${year}:\n${lines.join('\n')}`;
}

async function holidaysText(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await query<{ name: string; holiday_date: string }>(
    `SELECT name, holiday_date FROM holidays
     WHERE tenant_id = $1 AND YEAR(holiday_date) = $2
     ORDER BY holiday_date ASC LIMIT 12`,
    [DEFAULT_TENANT, year],
  );
  if (!rows.length) return `No holidays are configured for ${year} yet. Ask HR or Admin to add them under Settings.`;
  const lines = rows.map((r) => {
    const d = new Date(r.holiday_date);
    return `• ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${r.name}`;
  });
  return `Upcoming / configured holidays for ${year}:\n${lines.join('\n')}`;
}

async function attendanceText(userId: string): Promise<string> {
  const start = new Date();
  start.setDate(1);
  const startStr = start.toISOString().slice(0, 10);
  const rows = await query<{ work_date: string; status: string; hours: number | null }>(
    `SELECT work_date, status, hours FROM attendance_days
     WHERE tenant_id = $1 AND user_id = $2 AND work_date >= $3
     ORDER BY work_date DESC LIMIT 31`,
    [DEFAULT_TENANT, userId, startStr],
  );
  if (!rows.length) return 'No attendance records found for this month yet.';
  const present = rows.filter((r) => String(r.status).toLowerCase().includes('present') || Number(r.hours) > 0).length;
  const hours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  return `Your attendance this month:\n• Days recorded: ${rows.length}\n• Present / worked days: ${present}\n• Hours logged: ${hours.toFixed(1)}\n\nOpen Attendance for the full calendar and check-in tools.`;
}

async function pendingApprovalsText(actorId: string, role: string): Promise<string> {
  if (role === 'employee') {
    return 'Employees cannot view company-wide approval queues. You can track your own leave/claims under Attendance and Notifications.';
  }
  const leavePending = await queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM leave_requests WHERE tenant_id = $1 AND status = 'Pending'`,
    [DEFAULT_TENANT],
  );
  const claimPending = await queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM expense_claims WHERE tenant_id = $1 AND status IN ('pending','clarification')`,
    [DEFAULT_TENANT],
  ).catch(() => ({ c: 0 }));
  const leaveCount = Number(leavePending?.c || 0);
  const claimCount = Number(claimPending?.c || 0);
  if (role === 'manager') {
    const team = await teamUserIds(actorId);
    let teamLeaveCount = 0;
    if (team.length) {
      const placeholders = team.map((_, i) => `$${i + 2}`).join(',');
      const teamLeave = await queryOne<{ c: number }>(
        `SELECT COUNT(*) AS c FROM leave_requests
         WHERE tenant_id = $1 AND status = 'Pending' AND user_id IN (${placeholders})`,
        [DEFAULT_TENANT, ...team],
      );
      teamLeaveCount = Number(teamLeave?.c || 0);
    }
    return `Team approvals snapshot:\n• Pending team leave requests: ${teamLeaveCount}\n• Open claims queue (org): ${claimCount}\n\nOpen Dashboard or Attendance to review items that need your comment.`;
  }
  return `Approvals snapshot:\n• Pending leave requests: ${leaveCount}\n• Pending / clarification claims: ${claimCount}\n\nOpen Dashboard or Notifications to action them (approval comments are required).`;
}

async function teamLeaveText(actorId: string, role: string): Promise<string> {
  if (role === 'employee') {
    return 'You can only view your own leave. Ask: “What is my leave balance?”';
  }
  let userIds: string[] = [];
  if (role === 'manager') {
    userIds = await teamUserIds(actorId);
  } else {
    const all = await query<{ id: string }>('SELECT id FROM users WHERE tenant_id = $1 AND active = 1', [DEFAULT_TENANT]);
    userIds = all.map((u) => String(u.id));
  }
  if (!userIds.length) return 'No team members found for your scope.';
  const placeholders = userIds.map((_, i) => `$${i + 2}`).join(',');
  const rows = await query<{ name: string; status: string; start_date: string; end_date: string }>(
    `SELECT u.name, lr.status, lr.start_date, lr.end_date
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE lr.tenant_id = $1 AND lr.user_id IN (${placeholders})
     ORDER BY lr.created_at DESC LIMIT 10`,
    [DEFAULT_TENANT, ...userIds],
  );
  if (!rows.length) return 'No recent leave requests in your authorized scope.';
  const lines = rows.map((r) => {
    const s = new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = new Date(r.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `• ${r.name}: ${r.status} (${s} – ${e})`;
  });
  return `Recent leave in your scope:\n${lines.join('\n')}`;
}

async function employeeLookupText(
  q: string,
  actorId: string,
  role: string,
  canReadEmployees: boolean,
  canSeeSalary: boolean,
): Promise<string> {
  if (!canReadEmployees) {
    return 'You do not have permission to search the employee directory. You can ask about your own leave, attendance, holidays, or payroll self-service.';
  }
  const needle = q.replace(/find|contact|employee|directory|who is|info|information|for/gi, ' ').trim();
  const like = `%${needle.split(/\s+/).filter(Boolean).slice(0, 3).join('%')}%`;
  let sql = `SELECT e.name, e.email, e.phone, e.department, e.position, e.location, e.country, e.salary, e.user_id
             FROM employees e WHERE e.tenant_id = $1 AND (e.name LIKE $2 OR e.email LIKE $2)`;
  const params: unknown[] = [DEFAULT_TENANT, like];
  if (role === 'manager') {
    const team = await teamUserIds(actorId);
    if (!team.length) return 'No employees are in your team scope.';
    sql += ` AND e.user_id IN (${team.map((_, i) => `$${i + 3}`).join(',')})`;
    params.push(...team);
  }
  sql += ' ORDER BY e.name LIMIT 5';
  const rows = await query<Record<string, unknown>>(sql, params);
  if (!rows.length) return `I could not find an employee matching “${needle || q}” in your authorized scope.`;
  const lines = rows.map((r) => {
    const base = `• ${r.name} — ${r.position || '—'} (${r.department || '—'})\n  Email: ${r.email}${r.phone ? `\n  Phone: ${r.phone}` : ''}${r.location ? `\n  Location: ${r.location}` : ''}`;
    if (canSeeSalary && r.salary != null) return `${base}\n  Salary: ${r.salary}`;
    return base;
  });
  return `Employee directory (authorized results only):\n${lines.join('\n\n')}`;
}

function helpText(role: string, module?: string): string {
  const moduleHint = module ? `\nYou are currently in the “${module}” area of ASK HRFlow.` : '';
  return `I can help with HRMS questions based on your ${role} permissions.${moduleHint}

Try asking about:
• Leave balances and how to request leave
• Holidays and attendance / timesheets
• Payroll self-service (payslips) if you have access
• Policies and navigation tips
${role === 'employee' ? '' : '• Team leave and pending approvals (within your scope)'}

I will never reveal unauthorized salary or confidential employee data.`;
}

async function buildChatReply(
  me: { id: string; role: string; permissions?: Record<string, string[]> },
  message: string,
  ctx: ChatCtx,
): Promise<{ reply: string; suggestions: string[] }> {
  const lower = message.toLowerCase();
  const perms = me.permissions ?? {};
  const canEmployees = hasAction(perms, 'employees', 'read');
  const canSalary = hasAction(perms, 'employees', 'update') || me.role === 'admin';
  const canPayroll = hasAction(perms, 'payroll', 'read');

  let reply = '';
  let suggestions = suggestionsFor(me.role);

  if (/leave balance|my leave|vacation|pto|remaining leave/.test(lower)) {
    reply = await leaveBalanceText(me.id);
    suggestions = ['How do I request leave?', 'Upcoming holidays', 'My attendance'];
  } else if (/holiday|public holiday|office closed/.test(lower)) {
    reply = await holidaysText();
  } else if (/attendance|check[- ]?in|hours worked|present/.test(lower) && !/team/.test(lower)) {
    reply = await attendanceText(me.id);
    suggestions = ['My leave balance', 'How do timesheets work?', 'Upcoming holidays'];
  } else if (/pending approval|approvals? waiting|what needs approval/.test(lower)) {
    reply = await pendingApprovalsText(me.id, me.role);
  } else if (/team leave|leave overview|who is on leave/.test(lower)) {
    reply = await teamLeaveText(me.id, me.role);
  } else if (/payroll|payslip|salary|next pay/.test(lower)) {
    if (!canPayroll) {
      reply = 'You do not have payroll access. Contact HR if you need a payslip.';
    } else if (me.role === 'employee' || (!canSalary && me.role !== 'admin' && me.role !== 'hr')) {
      reply =
        'Payroll self-service: open Payroll to view your payslips when available.\n• Pay runs and salary structures are managed by Admin/HR.\n• I will not disclose other employees’ compensation.\n\nTip: use the Payroll module in the side navigation.';
    } else {
      reply =
        'Payroll guidance (Admin/HR):\n• Configure salary structures and statutory rates under Payroll.\n• Process a pay run from Payroll → Process.\n• HR has read access; updates require Admin.\n• Employees only see their own payslips.\n\nI will not list other employees’ salaries in chat.';
    }
    suggestions = ['Pending approvals', 'My leave balance', 'How do I navigate Settings?'];
  } else if (/find |contact |directory|who is |employee info/.test(lower)) {
    reply = await employeeLookupText(message, me.id, me.role, canEmployees, canSalary);
  } else if (/request leave|apply leave|how (do|to).*(leave|timesheet|claim|payroll|navigate)/.test(lower)) {
    if (/leave/.test(lower)) {
      reply =
        'To request leave:\n1. Open Attendance\n2. Choose Request Leave\n3. Pick dates (policy-aware day count)\n4. Submit — your manager/HR must approve with a comment\n\nTip: ask “What is my leave balance?” for remaining days.';
    } else if (/timesheet/.test(lower)) {
      reply =
        'Timesheets: open Attendance → Timesheets, create/add hours for the week, then Submit. Locked timesheets need manager/HR review.';
    } else if (/claim|expense/.test(lower)) {
      reply =
        'Expense claims: open Attendance or Claims panels (where available), submit category + amount + receipt. Claims never auto-approve and require reviewer comments.';
    } else if (/payroll/.test(lower)) {
      reply = canPayroll
        ? 'Open Payroll from the side menu for payslips or (Admin) pay runs and structures.'
        : 'You do not have Payroll module access.';
    } else {
      reply = helpText(me.role, ctx.module);
    }
  } else if (/policy|remote work|help|what can you|capabilities/.test(lower)) {
    reply = `${helpText(me.role, ctx.module)}\n\nFor full written policies, check Settings / HR documents when your role allows access.`;
  } else {
    reply = helpText(me.role, ctx.module);
  }

  return { reply, suggestions };
}

router.post('/chat', requireAuth, attachUser, requirePermission('ai-assistant', 'read'), async (req, res) => {
  const me = await ensureAppUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const message = String(req.body?.message || '').trim();
  const ctx = (req.body?.context || {}) as ChatCtx;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

  try {
    const { reply, suggestions } = await buildChatReply(me, message, ctx);
    res.json({
      reply,
      suggestions,
      role: me.role,
      module: ctx.module ?? null,
    });
  } catch (e) {
    console.error('[ai/chat]', e);
    res.json({
      reply: 'I hit a temporary issue loading that data. Please try again, or open the related module directly.',
      suggestions: suggestionsFor(me.role),
      role: me.role,
      module: ctx.module ?? null,
    });
  }
});

/** SSE stream of the authorized reply (chunked for real-time UX). */
router.post('/chat/stream', requireAuth, attachUser, requirePermission('ai-assistant', 'read'), async (req, res) => {
  const me = await ensureAppUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const message = String(req.body?.message || '').trim();
  const ctx = (req.body?.context || {}) as ChatCtx;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('status', { state: 'thinking' });
    const { reply, suggestions } = await buildChatReply(me, message, ctx);
    const chunks = reply.match(/[\s\S]{1,24}/g) ?? [reply];
    for (const chunk of chunks) {
      send('token', { text: chunk });
      await new Promise((r) => setTimeout(r, 12));
    }
    send('done', { suggestions, role: me.role, module: ctx.module ?? null });
  } catch (e) {
    console.error('[ai/chat/stream]', e);
    send('error', { message: 'Temporary issue loading that data.' });
  }
  res.end();
});

export default router;
