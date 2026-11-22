# ASK HRFlow — Implementation Progress

## Completed

- [x] MySQL schema (`server/schema.sql`) with tenants, RBAC, HR domain tables, indexes/FKs
- [x] TypeScript Express server (`server/src/`) via `tsx` + `mysql2`
- [x] Auth (JWT cookie), login audit, `me` with computed permissions
- [x] RBAC middleware aligned with `access.tsx` module/action model
- [x] Employees CRUD + Add/Edit dialogs wired to API; salary masking
- [x] Attendance check-in/out with event log + daily rollup
- [x] Leave types, balances, requests with overlap/balance checks + approve/reject UI
- [x] Timesheets lifecycle APIs (entries, submit, approve/reject, lock)
- [x] Dashboard stats from SQL (no hardcoded KPIs)
- [x] Access API (users, permissions, create/patch user, role template update)
- [x] Notices, audit logs; payroll/recruitment/performance/settings bound to MySQL
- [x] Swagger at `/api/docs`
- [x] Seed + `db:migrate` (schema_migrations)
- [x] Docker Compose (MySQL 8 + app image); Dockerfile; GitHub Actions CI
- [x] Unit tests (RBAC, working days, dates) + API RBAC integration tests + Playwright login e2e
- [x] Environments doc (`docs/ENVIRONMENTS.md`)

## Verified locally

- `npm run db:seed` / `db:migrate` → MySQL
- `/api/health` → `{ ok: true, db: "mysql" }`
- Admin login + dashboard/employees; employee `403` on `/api/employees`
- `npm run test:unit` · `npm run test:api` · `npm run build`

## Remaining / follow-up

- [ ] Access Control role-template UI → `PUT /api/access/permissions/:role`
- [ ] Weekly timesheet submit/approve UI (check-in API works; weekly sheets partial)
- [ ] Documents UI upload/list screens
- [ ] Shift management UI
- [ ] Pagination UI for employee list
- [ ] Zod validation on all write endpoints
- [ ] Load/stress suite
- [x] Redeployed VPS `https://hrflow.automystics.tech` on MySQL (`/api/health` → mysql)
