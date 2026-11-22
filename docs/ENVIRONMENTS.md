# Environments

| Environment | Purpose | Database | Notes |
|-------------|---------|----------|--------|
| **Development** | Local agent / laptop | MySQL 8 via `docker compose` or local MariaDB | `.env` from `.env.example`; `npm run db:migrate && npm run db:seed` |
| **Staging** | Pre-prod validation | Dedicated MySQL schema | Same image as prod; seed optional; run migrations only |
| **Production** | `hrflow.automystics.tech` | Hostinger MySQL / VPS MySQL | Strong `JWT_SECRET`; no demo seed in prod |

## Deploy flow

1. `npm run db:migrate` — apply `schema.sql` once, then incremental `server/migrations/00N_*.sql`
2. `npm run build && npm start` (or `docker compose up --build app`)
3. Health: `GET /api/health` → `{ ok: true, db: "mysql" }`
4. Smoke: admin login, dashboard stats, employee list RBAC

## Rollback

- App: redeploy previous Git SHA / Docker image tag
- DB: restore MySQL dump taken before migration; avoid destructive down-migrations in prod
