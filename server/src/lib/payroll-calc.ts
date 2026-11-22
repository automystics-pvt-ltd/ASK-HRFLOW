import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { isoDate } from './dates.js';

export type SalaryBreakdown = {
  basic: number;
  earnings: { code: string; name: string; amount: number }[];
  deductions: { code: string; name: string; amount: number }[];
  gross: number;
  totalDeductions: number;
  net: number;
  daysPayable: number;
  workingDays: number;
  unpaidLeaveDays: number;
};

function monthWorkingDays(periodStart: string, periodEnd: string): number {
  let n = 0;
  for (let d = new Date(periodStart + 'T00:00'); d <= new Date(periodEnd + 'T00:00'); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return Math.max(n, 1);
}

export async function getEffectiveSalaryStructure(employeeId: number, asOf: string) {
  return queryOne(
    `SELECT * FROM employee_salary_structures
     WHERE tenant_id = $1 AND employee_id = $2 AND effective_from <= $3
     ORDER BY effective_from DESC LIMIT 1`,
    [DEFAULT_TENANT, employeeId, asOf],
  );
}

export async function getStatutoryRates(asOf: string) {
  const rows = await query(
    `SELECT * FROM statutory_rates WHERE tenant_id = $1 AND active = 1 AND effective_from <= $2
     ORDER BY code, effective_from DESC`,
    [DEFAULT_TENANT, asOf],
  );
  const seen = new Set<string>();
  const out: { code: string; name: string; rate_percent: number; flat_amount: number }[] = [];
  for (const r of rows) {
    const code = String(r.code);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      name: String(r.name),
      rate_percent: Number(r.rate_percent),
      flat_amount: Number(r.flat_amount),
    });
  }
  return out;
}

export async function calculateEmployeePayroll(opts: {
  employeeId: number;
  userId?: string | null;
  periodStart: string;
  periodEnd: string;
  annualSalaryFallback?: number;
}): Promise<SalaryBreakdown> {
  const asOf = opts.periodEnd;
  const structure = await getEffectiveSalaryStructure(opts.employeeId, asOf);
  let basic = structure ? Number(structure.basic) : 0;
  let components: { code: string; name?: string; kind?: string; amount?: number; isPercent?: boolean; value?: number }[] =
    [];
  if (structure?.components_json) {
    const raw = structure.components_json;
    components = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof components);
  }
  if (!basic && opts.annualSalaryFallback) {
    basic = Math.round((Number(opts.annualSalaryFallback) / 12) * 100) / 100;
  }

  const earnings: SalaryBreakdown['earnings'] = [{ code: 'basic', name: 'Basic', amount: basic }];
  const deductions: SalaryBreakdown['deductions'] = [];

  for (const c of components) {
    const amount =
      c.amount != null
        ? Number(c.amount)
        : c.isPercent
          ? Math.round(basic * (Number(c.value ?? 0) / 100) * 100) / 100
          : Number(c.value ?? 0);
    const kind = c.kind === 'deduction' ? 'deduction' : 'earning';
    if (kind === 'deduction') {
      deductions.push({ code: c.code, name: c.name || c.code, amount });
    } else if (c.code !== 'basic') {
      earnings.push({ code: c.code, name: c.name || c.code, amount });
    }
  }

  // Apply statutory rates from effective-dated config if not already in components
  const codesPresent = new Set([...earnings, ...deductions].map((x) => x.code));
  const rates = await getStatutoryRates(asOf);
  for (const r of rates) {
    if (codesPresent.has(r.code)) continue;
    const amount =
      r.flat_amount > 0
        ? r.flat_amount
        : Math.round(basic * (r.rate_percent / 100) * 100) / 100;
    if (amount > 0) {
      deductions.push({ code: r.code, name: r.name, amount });
    }
  }

  const workingDays = monthWorkingDays(opts.periodStart, opts.periodEnd);
  let unpaidLeaveDays = 0;
  if (opts.userId) {
    const unpaid = await query(
      `SELECT days FROM leave_requests
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'Approved'
         AND type LIKE '%Unpaid%'
         AND NOT (end_date < $3 OR start_date > $4)`,
      [DEFAULT_TENANT, opts.userId, opts.periodStart, opts.periodEnd],
    );
    unpaidLeaveDays = unpaid.reduce((s, r) => s + Number(r.days), 0);
  }

  const daysPayable = Math.max(0, workingDays - unpaidLeaveDays);
  const proration = daysPayable / workingDays;

  const grossFull = earnings.reduce((s, e) => s + e.amount, 0);
  const dedFull = deductions.reduce((s, d) => s + d.amount, 0);
  const gross = Math.round(grossFull * proration * 100) / 100;
  const totalDeductions = Math.round(dedFull * proration * 100) / 100;
  const net = Math.round((gross - totalDeductions) * 100) / 100;

  return {
    basic: Math.round(basic * proration * 100) / 100,
    earnings: earnings.map((e) => ({ ...e, amount: Math.round(e.amount * proration * 100) / 100 })),
    deductions: deductions.map((d) => ({ ...d, amount: Math.round(d.amount * proration * 100) / 100 })),
    gross,
    totalDeductions,
    net,
    daysPayable,
    workingDays,
    unpaidLeaveDays,
  };
}

export function payslipHtml(opts: {
  employeeName: string;
  periodLabel: string;
  companyName: string;
  breakdown: SalaryBreakdown;
  issuedAt?: string;
}) {
  const { breakdown: b } = opts;
  const earnRows = b.earnings.map((e) => `<tr><td>${e.name}</td><td style="text-align:right">${e.amount.toFixed(2)}</td></tr>`).join('');
  const dedRows = b.deductions.map((d) => `<tr><td>${d.name}</td><td style="text-align:right">${d.amount.toFixed(2)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip — ${opts.periodLabel}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{color:#1e3a5f}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:6px 8px;border-bottom:1px solid #e2e8f0}</style>
</head><body>
<h1>${opts.companyName}</h1>
<p><strong>Payslip</strong> — ${opts.periodLabel}</p>
<p>Employee: ${opts.employeeName}</p>
<p>Payable days: ${b.daysPayable} / ${b.workingDays}${b.unpaidLeaveDays ? ` (unpaid leave: ${b.unpaidLeaveDays})` : ''}</p>
<h3>Earnings</h3><table>${earnRows}</table>
<h3>Deductions</h3><table>${dedRows || '<tr><td colspan="2">None</td></tr>'}</table>
<p><strong>Gross:</strong> ${b.gross.toFixed(2)} · <strong>Deductions:</strong> ${b.totalDeductions.toFixed(2)} · <strong>Net:</strong> ${b.net.toFixed(2)}</p>
<p style="font-size:12px;color:#64748b">Issued ${opts.issuedAt || isoDate(new Date())}</p>
</body></html>`;
}
