import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { isoDate } from './dates.js';

export type LeavePolicySettings = {
  autoApproveEnabled: boolean;
  autoApproveDays: number;
  countWeekends: boolean;
  countHolidays: boolean;
  requireApprovalComment: boolean;
};

export type LeaveTypePolicy = {
  maxConsecutiveDays?: number | null;
  minConsecutiveDays?: number | null;
  advanceNoticeDays?: number | null;
  requireDocument?: boolean;
  probationMonths?: number | null;
  allowHalfDay?: boolean;
  maxAnnualDays?: number | null;
  departments?: string[] | null;
  designations?: string[] | null;
};

const DEFAULT_SETTINGS: LeavePolicySettings = {
  autoApproveEnabled: true,
  autoApproveDays: 20,
  countWeekends: false,
  countHolidays: false,
  requireApprovalComment: true,
};

export async function getLeavePolicySettings(): Promise<LeavePolicySettings> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM leave_policy_settings WHERE tenant_id = $1',
    [DEFAULT_TENANT],
  );
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    autoApproveEnabled: Boolean(Number(row.auto_approve_enabled ?? 1)),
    autoApproveDays: Number(row.auto_approve_days ?? 20),
    countWeekends: Boolean(Number(row.count_weekends ?? 0)),
    countHolidays: Boolean(Number(row.count_holidays ?? 0)),
    requireApprovalComment: Boolean(Number(row.require_approval_comment ?? 1)),
  };
}

export async function upsertLeavePolicySettings(partial: Partial<LeavePolicySettings>) {
  const cur = await getLeavePolicySettings();
  const next = { ...cur, ...partial };
  await query(
    `INSERT INTO leave_policy_settings
     (tenant_id, auto_approve_enabled, auto_approve_days, count_weekends, count_holidays, require_approval_comment)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON DUPLICATE KEY UPDATE
       auto_approve_enabled = VALUES(auto_approve_enabled),
       auto_approve_days = VALUES(auto_approve_days),
       count_weekends = VALUES(count_weekends),
       count_holidays = VALUES(count_holidays),
       require_approval_comment = VALUES(require_approval_comment)`,
    [
      DEFAULT_TENANT,
      next.autoApproveEnabled ? 1 : 0,
      next.autoApproveDays,
      next.countWeekends ? 1 : 0,
      next.countHolidays ? 1 : 0,
      next.requireApprovalComment ? 1 : 0,
    ],
  );
  return next;
}

export function parseTypePolicy(raw: unknown): LeaveTypePolicy {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as LeaveTypePolicy;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as LeaveTypePolicy;
    } catch {
      return {};
    }
  }
  return {};
}

/** Pure day counter — used by calculateLeaveDays and unit tests. */
export function countLeaveCalendarDays(
  start: string,
  end: string,
  opts: { countWeekends: boolean; countHolidays: boolean; holidays: Set<string> | string[] },
): number {
  const holidays = opts.holidays instanceof Set ? opts.holidays : new Set(opts.holidays);
  let n = 0;
  for (let d = new Date(start + 'T00:00'); d <= new Date(end + 'T00:00'); d.setDate(d.getDate() + 1)) {
    const key = isoDate(d);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.has(key);
    if (!opts.countWeekends && isWeekend) continue;
    if (!opts.countHolidays && isHoliday) continue;
    n += 1;
  }
  return n;
}

/** Count leave days between inclusive dates using policy + holiday calendar. */
export async function calculateLeaveDays(
  start: string,
  end: string,
  opts?: {
    halfDay?: boolean;
    countWeekends?: boolean;
    countHolidays?: boolean;
    holidayDates?: string[];
  },
): Promise<number> {
  if (opts?.halfDay) return 0.5;
  const settings = opts?.countWeekends != null && opts?.countHolidays != null ? null : await getLeavePolicySettings();
  const countWeekends = opts?.countWeekends ?? settings!.countWeekends;
  const countHolidays = opts?.countHolidays ?? settings!.countHolidays;

  let holidays: Set<string>;
  if (opts?.holidayDates) {
    holidays = new Set(opts.holidayDates);
  } else {
    const holidayRows = await query<{ holiday_date: Date | string }>(
      `SELECT holiday_date FROM holidays
       WHERE tenant_id = $1 AND active = 1 AND holiday_date BETWEEN $2 AND $3`,
      [DEFAULT_TENANT, start, end],
    );
    holidays = new Set(holidayRows.map((h) => isoDate(h.holiday_date)));
  }

  return countLeaveCalendarDays(start, end, { countWeekends, countHolidays, holidays });
}
