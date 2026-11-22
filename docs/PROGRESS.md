# ASK HRFlow — Implementation Progress

## Completed

- [x] MySQL schema (`server/schema.sql`) with tenants, RBAC, HR domain tables, indexes/FKs
- [x] TypeScript Express server (`server/src/`) via `tsx`
- [x] Auth (JWT cookie), login audit, `me` with computed permissions
- [x] RBAC middleware aligned with `access.tsx` module/action model
- [x] Employees CRUD with duplicate email guard, list filters, salary masking
- [x] Attendance check-in/out with event log + daily rollup
- [x] Leave types, balances, requests with overlap/balance checks + approval balance update
- [x] Timesheets lifecycle (entries, submit, approve/reject, lock)
- [x] Dashboard stats from SQL (no hardcoded KPIs)
- [x] Access API (users, permissions, create/patch user)
- [x] Notices list + mark read; audit log list
- [x] Stub routes: payroll, recruitment, performance, documents (multer → `uploads/`), settings, reports, shifts
- [x] Swagger at `/api/docs`
- [x] Seed script (`npm run db:seed`) — demo users + sample HR data
- [x] Docker Compose → MySQL 8; `.env.example` updated
- [x] Frontend API client (`src/app/lib/api.ts`) and wiring for dashboard, employees, attendance/leave/timesheet, access

## Verified locally

- `npm run db:seed`
- `curl` login, `/api/dashboard/stats`, `/api/employees`
- `npm run build` (Vite)

## Remaining / follow-up

- [ ] Wire Access Control UI mutations entirely through API (role template edits still client-local)
- [ ] Employee add/edit dialogs — form submit to `employeesApi.create/update`
- [ ] Leave approve/reject buttons in UI → `leaveApi.approve`
- [ ] HR pages (payroll, recruitment, performance) — replace placeholders with stub API data in UI
- [ ] Pagination UI for employee list (API supports `page`/`limit`)
- [ ] Zod validation on all write endpoints (partially implicit)
- [ ] Remove legacy MySQL files under `server/*.js` (kept for reference; not used by scripts)
- [ ] Production migrations tool instead of full schema replay on seed
- [ ] Tenant resolution middleware (currently fixed `t-default`)
