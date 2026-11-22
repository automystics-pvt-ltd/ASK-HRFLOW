# ASK HRFlow — Implementation Progress

## Completed

- [x] MySQL schema (`server/schema.sql`) with tenants, RBAC, HR domain tables, indexes/FKs
- [x] TypeScript Express server (`server/src/`) via `tsx` + `mysql2`
- [x] Auth (JWT cookie), login audit, `me` with computed permissions
- [x] RBAC middleware aligned with `access.tsx` module/action model
- [x] Employees CRUD with duplicate email guard, list filters, salary masking
- [x] Attendance check-in/out with event log + daily rollup
- [x] Leave types, balances, requests with overlap/balance checks + approval balance update
- [x] Timesheets lifecycle (entries, submit, approve/reject, lock)
- [x] Dashboard stats from SQL (no hardcoded KPIs)
- [x] Access API (users, permissions, create/patch user, role template update)
- [x] Notices list + mark read; audit log list
- [x] Stub routes: payroll (runs + process), recruitment, performance, documents (multer → `uploads/`), settings, reports, shifts
- [x] Swagger at `/api/docs`
- [x] Seed script (`npm run db:seed`) — demo users + sample HR data
- [x] Docker Compose → MySQL 8; `.env.example` updated
- [x] Frontend API client (`src/app/lib/api.ts`) and wiring for dashboard, employees, attendance/leave/timesheet, access
- [x] Employee **Add** dialog submits to `employeesApi.create`
- [x] Leave approve/reject actions in Attendance UI
- [x] Removed legacy CommonJS MySQL server files under `server/*.js`

## Verified locally

- `npm run db:seed` → MySQL
- `/api/health` → `{ ok: true, db: "mysql" }`
- Admin login + `/api/dashboard/stats` + `/api/employees`
- Employee role gets `403` on `/api/employees`

## Remaining / follow-up

- [ ] Access Control role-template UI → `PUT /api/access/permissions/:role` (API exists; UI still partly client-local)
- [ ] Employee edit dialog → `employeesApi.update`
- [x] HR pages (payroll, recruitment, performance, settings) bound to MySQL APIs / seed data
- [ ] Timesheet weekly submit/approve UI (check-in uses API; weekly sheets still partial)
- [ ] Pagination UI for employee list (API supports `page`/`limit`)
- [ ] Zod validation on all write endpoints
- [ ] Playwright + API integration tests
- [ ] Production migrations tool instead of full schema replay on seed
- [ ] Tenant resolution middleware (currently fixed `t-default`)
- [ ] Redeploy VPS (`hrflow.automystics.tech`) on MySQL with this stack
