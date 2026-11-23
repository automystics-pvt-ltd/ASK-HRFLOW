/** Shared formatting for approval inbox / history cards — Who, What, When, Why. */

export type ApprovalLike = {
  requesterName?: string | null;
  typeLabel?: string | null;
  workflowName?: string | null;
  moduleKey?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  stepLabel?: string | null;
  status?: string | null;
  createdAt?: string | null;
  decidedAt?: string | null;
  lastActorName?: string | null;
  lastComment?: string | null;
  payload?: Record<string, unknown> | null;
};

export function formatApprovalWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** One-line "what + why" from module payload (leave / claim / timesheet). */
export function formatApprovalWhatWhy(item: ApprovalLike): string {
  const payload = (item.payload || {}) as Record<string, unknown>;
  const moduleKey = String(item.moduleKey || '');

  if (moduleKey === 'leave' || item.entityType === 'leave_request') {
    const type = String(payload.type || payload.leaveType || 'Leave');
    const days = payload.days != null ? `${payload.days} day(s)` : '';
    const range =
      payload.startDate || payload.endDate
        ? `${String(payload.startDate || '—')} → ${String(payload.endDate || '—')}`
        : '';
    const reason = String(payload.reason || payload.note || '').trim();
    return [type, days, range, reason ? `Why: ${reason}` : '']
      .filter(Boolean)
      .join(' · ');
  }

  if (moduleKey === 'claim' || item.entityType === 'expense_claim') {
    const amount = payload.amount != null ? `Amount ${payload.amount}` : '';
    const when = payload.expenseDate ? String(payload.expenseDate) : '';
    const why = String(payload.description || payload.categoryName || '').trim();
    return [amount, when, why ? `Why: ${why}` : ''].filter(Boolean).join(' · ');
  }

  if (moduleKey === 'timesheet') {
    const period = payload.periodStart
      ? `${String(payload.periodStart)} → ${String(payload.periodEnd || '')}`
      : '';
    const hours = payload.totalHours != null ? `${payload.totalHours} hrs` : '';
    return [period, hours].filter(Boolean).join(' · ') || String(item.stepLabel || 'Timesheet');
  }

  const fallback = String(item.stepLabel || item.typeLabel || item.workflowName || moduleKey || 'Request');
  const note = String(payload.reason || payload.note || payload.description || '').trim();
  return note ? `${fallback} · Why: ${note}` : fallback;
}

export function formatApprovalHeadline(item: ApprovalLike): string {
  const who = String(item.requesterName || 'Employee');
  const what = String(item.typeLabel || item.workflowName || item.moduleKey || 'Request');
  const ref =
    item.entityId != null && item.entityId !== ''
      ? ` · ${String(item.entityType || item.moduleKey || 'request')} #${String(item.entityId)}`
      : '';
  return `${who} · ${what}${ref}`;
}
