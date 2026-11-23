import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { reverseGeocode } from '../lib/geocode.js';
import { getEmployeeManagerUserId, isManagerOf } from '../lib/team.js';
import { notifyUserIds } from '../lib/notices-helper.js';

const router = Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function resolveLocation(opts: {
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
}): Promise<{ label: string | null; address: string | null }> {
  const lat = opts.latitude != null ? Number(opts.latitude) : NaN;
  const lng = opts.longitude != null ? Number(opts.longitude) : NaN;
  const clientLabel = opts.locationLabel?.trim() || null;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const address = await reverseGeocode(lat, lng);
    if (address) {
      return { label: clientLabel || address.slice(0, 120), address };
    }
    return { label: clientLabel || 'Location unavailable', address: null };
  }
  return { label: clientLabel, address: null };
}

async function syncAttendanceDay(
  userId: string,
  workDate: string,
  location?: { label: string | null; address: string | null },
) {
  const events = await query<{
    event_type: string;
    occurred_at: Date;
    location_label: string | null;
    location_address: string | null;
  }>(
    `SELECT event_type, occurred_at, location_label, location_address FROM attendance_events
     WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3 ORDER BY occurred_at`,
    [DEFAULT_TENANT, userId, workDate],
  );
  const checkIn = events.find((e) => e.event_type === 'check_in');
  const checkOut = [...events].reverse().find((e) => e.event_type === 'check_out');
  let hours = 0;
  if (checkIn && checkOut) {
    hours = Math.round(((checkOut.occurred_at.getTime() - checkIn.occurred_at.getTime()) / 3600000) * 100) / 100;
  }
  const locLabel = location?.label ?? checkIn?.location_label ?? checkOut?.location_label ?? null;
  const locAddress = location?.address ?? checkIn?.location_address ?? checkOut?.location_address ?? null;
  await query(
    `INSERT INTO attendance_days (tenant_id, user_id, work_date, check_in, check_out, status, hours, location, location_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = VALUES(check_out), hours = VALUES(hours),
       status = VALUES(status), location = COALESCE(VALUES(location), location),
       location_address = COALESCE(VALUES(location_address), location_address)`,
    [
      DEFAULT_TENANT,
      userId,
      workDate,
      checkIn?.occurred_at ?? null,
      checkOut?.occurred_at ?? null,
      checkOut ? 'Present' : checkIn ? 'In Progress' : 'Absent',
      hours,
      locLabel,
      locAddress,
    ],
  );
  return { checkIn, checkOut, hours, location: locLabel, locationAddress: locAddress };
}

async function notifyManagerOfPunch(employeeUserId: string, action: 'check-in' | 'check-out', workDate: string) {
  try {
    const managerId = await getEmployeeManagerUserId(employeeUserId);
    if (!managerId || managerId === employeeUserId) return;
    const emp = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [employeeUserId]);
    const name = emp?.name || 'Team member';
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const title = action === 'check-in' ? `${name} checked in` : `${name} checked out`;
    const body =
      action === 'check-in'
        ? `${name} checked in at ${time} on ${workDate}.`
        : `${name} checked out at ${time} on ${workDate}.`;
    // Deduped per employee+day+action so repeated punches don't spam
    await notifyUserIds(
      [managerId],
      title,
      body,
      'attendance',
      `att-${action === 'check-in' ? 'in' : 'out'}-${workDate}-${employeeUserId}`.slice(0, 28),
    );
  } catch {
    /* notification must not break punch */
  }
}

router.get('/', requireAuth, attachUser, requirePermission('attendance', 'read'), async (req, res) => {
  const role = req.user!.role;
  const canApprove = await userCan(req.user!.sub, role, 'attendance', 'approve');
  let userId = req.user!.sub;

  if (req.query.userId) {
    const requested = String(req.query.userId);
    if (role === 'admin' || role === 'hr') {
      userId = requested;
    } else if (canApprove && role === 'manager') {
      if (requested !== req.user!.sub && !(await isManagerOf(req.user!.sub, requested))) {
        return res.status(403).json({ error: 'You can only view attendance for your direct reports' });
      }
      userId = requested;
    } else if (requested !== req.user!.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const rows = await query(
    `SELECT work_date, check_in, check_out, status, hours, location, location_address
     FROM attendance_days WHERE tenant_id = $1 AND user_id = $2 ORDER BY work_date DESC LIMIT 60`,
    [DEFAULT_TENANT, userId],
  );

  res.json({
    attendance: rows.map((r) => ({
      date: String(r.work_date).slice(0, 10),
      workDate: r.work_date,
      checkIn: r.check_in ? new Date(r.check_in as Date).toISOString() : null,
      checkOut: r.check_out ? new Date(r.check_out as Date).toISOString() : null,
      status: r.status,
      hours: Number(r.hours),
      location: r.location,
      locationAddress: r.location_address ?? null,
    })),
  });
});

/** Manager/HR/Admin: team attendance status for today (and optional date). */
router.get('/team', requireAuth, attachUser, requirePermission('attendance', 'read'), async (req, res) => {
  const role = req.user!.role;
  if (role !== 'manager' && role !== 'admin' && role !== 'hr') {
    return res.status(403).json({ error: 'Managers, HR, and Admin only' });
  }
  const workDate = String(req.query.date || todayDate()).slice(0, 10);
  const params: unknown[] = [DEFAULT_TENANT, workDate];
  let scope = '';
  if (role === 'manager') {
    scope = 'AND e.manager_user_id = $3';
    params.push(req.user!.sub);
  }

  const rows = await query(
    `SELECT e.id AS employee_id, e.name, e.department, e.user_id,
            ad.check_in, ad.check_out, ad.status, ad.hours, ad.location
     FROM employees e
     LEFT JOIN attendance_days ad
       ON ad.tenant_id = e.tenant_id AND ad.user_id = e.user_id AND ad.work_date = $2
     WHERE e.tenant_id = $1 AND e.status = 'Active' AND e.user_id IS NOT NULL ${scope}
     ORDER BY e.name`,
    params,
  );

  res.json({
    date: workDate,
    team: rows.map((r) => ({
      employeeId: Number(r.employee_id),
      name: String(r.name),
      department: String(r.department || ''),
      userId: String(r.user_id),
      status: r.status ? String(r.status) : 'Not checked in',
      checkIn: r.check_in ? new Date(r.check_in as Date).toISOString() : null,
      checkOut: r.check_out ? new Date(r.check_out as Date).toISOString() : null,
      hours: r.hours != null ? Number(r.hours) : 0,
      location: r.location ?? null,
    })),
  });
});

router.post('/check-in', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const workDate = todayDate();
  const open = await queryOne(
    `SELECT id FROM attendance_events WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3 AND event_type = 'check_in'
     AND NOT EXISTS (
       SELECT 1 FROM attendance_events o WHERE o.tenant_id = $1 AND o.user_id = $2 AND o.work_date = $3
         AND o.event_type = 'check_out' AND o.occurred_at > attendance_events.occurred_at
     ) LIMIT 1`,
    [DEFAULT_TENANT, req.user!.sub, workDate],
  );
  if (open) return res.status(409).json({ error: 'Already checked in. Check out first.' });

  const { latitude, longitude, accuracy, locationLabel } = req.body || {};
  const loc = await resolveLocation({ latitude, longitude, locationLabel });
  await query(
    `INSERT INTO attendance_events (tenant_id, user_id, work_date, event_type, latitude, longitude, accuracy, location_label, location_address)
     VALUES ($1,$2,$3,'check_in',$4,$5,$6,$7,$8)`,
    [
      DEFAULT_TENANT,
      req.user!.sub,
      workDate,
      latitude ?? null,
      longitude ?? null,
      accuracy ?? null,
      loc.label,
      loc.address,
    ],
  );
  const day = await syncAttendanceDay(req.user!.sub, workDate, loc);
  await notifyManagerOfPunch(req.user!.sub, 'check-in', workDate);
  res.status(201).json({
    ok: true,
    checkIn: day.checkIn?.occurred_at,
    hours: day.hours,
    location: day.location,
    locationAddress: day.locationAddress,
  });
});

router.post('/check-out', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const workDate = todayDate();
  const checkIn = await queryOne<{ occurred_at: Date }>(
    `SELECT occurred_at FROM attendance_events WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3 AND event_type = 'check_in'
     ORDER BY occurred_at DESC LIMIT 1`,
    [DEFAULT_TENANT, req.user!.sub, workDate],
  );
  if (!checkIn) return res.status(400).json({ error: 'No check-in for today' });

  const lastOut = await queryOne(
    `SELECT id FROM attendance_events WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3 AND event_type = 'check_out'
     AND occurred_at > $4 LIMIT 1`,
    [DEFAULT_TENANT, req.user!.sub, workDate, checkIn.occurred_at],
  );
  if (lastOut) return res.status(409).json({ error: 'Already checked out today' });

  const { latitude, longitude, accuracy, locationLabel } = req.body || {};
  const loc = await resolveLocation({ latitude, longitude, locationLabel });
  await query(
    `INSERT INTO attendance_events (tenant_id, user_id, work_date, event_type, latitude, longitude, accuracy, location_label, location_address)
     VALUES ($1,$2,$3,'check_out',$4,$5,$6,$7,$8)`,
    [
      DEFAULT_TENANT,
      req.user!.sub,
      workDate,
      latitude ?? null,
      longitude ?? null,
      accuracy ?? null,
      loc.label,
      loc.address,
    ],
  );
  const day = await syncAttendanceDay(req.user!.sub, workDate, loc);
  await notifyManagerOfPunch(req.user!.sub, 'check-out', workDate);
  res.json({
    ok: true,
    hours: day.hours,
    checkOut: day.checkOut?.occurred_at,
    location: day.location,
    locationAddress: day.locationAddress,
  });
});

router.get('/today', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const workDate = todayDate();
  const row = await queryOne(
    `SELECT * FROM attendance_days WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3`,
    [DEFAULT_TENANT, req.user!.sub, workDate],
  );
  res.json({
    today: row
      ? {
          ...row,
          locationAddress: row.location_address ?? null,
        }
      : null,
  });
});

export default router;
