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
- [x] Weekly timesheet UI (list/create week, add hours, submit; approve via `attendance` approve)
- [x] Dashboard stats from SQL (no hardcoded KPIs)
- [x] Access API (users, permissions, create/patch user, role template update)
- [x] Access Control role-template UI persists via `PUT /api/access/permissions/:role`
- [x] Documents list + upload UI in Settings (wired to `/api/documents`)
- [x] Shifts list + create dialog in Attendance (wired to `/api/shifts`)
- [x] Notices, audit logs; payroll/recruitment/performance/settings bound to MySQL
- [x] Swagger at `/api/docs`
- [x] Seed + `db:migrate` (schema_migrations)
- [x] Docker Compose (MySQL 8 + app image); Dockerfile; GitHub Actions CI
- [x] Unit tests (RBAC, working days, dates, geocode) + API RBAC integration tests + Playwright login e2e
- [x] Environments doc (`docs/ENVIRONMENTS.md`)
- [x] Branding API (`/api/branding`) — company, theme, logo upload; BrandProvider + CSS vars
- [x] HR document templates + generate (`/api/hr-documents`) with seeded HTML templates
- [x] Holidays CRUD (`/api/holidays`) + leave types admin POST/PUT
- [x] Approval workflows + inbox (`/api/approvals`); leave create spawns request when workflow active
- [x] Attendance reverse geocoding (Nominatim) → `location_address` (never invents place names)
- [x] Migration `002` with MySQL 8–safe column ensures via `information_schema` in `migrate.ts`
- [x] Migration `003` advanced leave / payroll / claims / cards + manager role ENUM
- [x] Leave policy settings + `calculateLeaveDays` (weekends/holidays); leave summary API
- [x] Leave create validates overlap, balance, advance notice, max consecutive; server-side day calc
- [x] Manager role + `manager_user_id` team routing; leave/claim approvals prefer manager then HR
- [x] Leave auto-approve job (`runLeaveAutoApprove`) hourly + boot; claims never auto-approved
- [x] Expense claims CRUD + receipt upload + mandatory comment on decide
- [x] Employee activity report + ID/business card generation
- [x] Payroll salary structures + statutory rates + payslip HTML
- [x] Manager dashboard; Claims/Activity tabs; Settings leave policy / categories / cards
- [x] Mandatory approval reason Dialog on dashboard, notifications, leave approve

## Verified locally

- `npm run db:seed` / `db:migrate` → MySQL
- `/api/health` → `{ ok: true, db: "mysql" }`
- Admin login + dashboard/employees; employee `403` on `/api/employees`
- Manager demo `ananya.manager@automystics.com` / `demo123`
- `npm run test:unit` · `npm run test:api` · `npm run build`

## Remaining / follow-up
- [x] Admin dashboard Pending Approvals Approve/Reject wired to `/api/approvals`
- [x] Quick Actions navigate to real modules
- [x] Recruitment Post New Job create API + dialog (no more 501 stub)
- [x] Payslip download + payroll report CSV export
- [x] Employee CSV import + row actions menu (status changes)


- [ ] Pagination UI for employee list
- [ ] Zod validation on all write endpoints
- [ ] Load/stress suite
- [ ] Shift edit/deactivate UI (create + list only today)
- [ ] Multi-level approval escalation timer job (schema + steps exist; scheduled escalate pending)
- [ ] Claims payment ledger / finance export beyond status `paid`
- [ ] Richer leave type policy editor UI (JSON fields exist on PUT)
- [x] HR document generate + employee-scoped view of own generated docs
- [x] Employee/HR dashboards wired to holidays, leave balances, notices, stats (no static mock KPIs)
- [x] Attendance UI never fabricates location labels when GPS/address missing
- [x] Redeployed VPS `https://hrflow.automystics.tech` on MySQL (`/api/health` → mysql)
