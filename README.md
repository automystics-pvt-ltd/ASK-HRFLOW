# ASK HRFlow

HR operations dashboard for Automystics — attendance, leave, payroll, recruitment, performance, access control, and role-based workspaces. Built from the Figma Make **ASK HRFlow** export with a Vite + React + Tailwind 4 frontend and Express + **MySQL** API.

## Stack

- **Frontend:** Vite 6, React 18, TypeScript, Tailwind CSS 4, Radix/shadcn UI
- **Backend:** Express, MySQL 8 (`mysql2`), JWT httpOnly cookies, `bcryptjs`
- **Docs:** Swagger UI at `/api/docs`

## Prerequisites

- Node.js 20+
- MySQL 8 (or `docker compose up -d mysql`)

## Quick start

```bash
npm install
docker compose up -d mysql   # optional if MySQL already runs locally
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

- **App:** http://localhost:5173 (Vite proxies `/api` → `:3001`)
- **API health:** http://localhost:3001/api/health → `{ "ok": true, "db": "mysql" }`
- **Swagger:** http://localhost:3001/api/docs

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| alvi@automystics.com | Admin | demo123 |
| priya.nair@automystics.com | HR | demo123 |
| rahul.verma@automystics.com | Employee | demo123 |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Concurrent API + Vite |
| `npm run build` / `npm start` | Production frontend + API |
| `npm run db:migrate` | Apply MySQL schema migrations |
| `npm run db:seed` | Schema + demo data |
| `npm run test:unit` | Node unit tests |
| `npm run test:api` | API RBAC integration tests (API must be running) |
| `npm run test:e2e` | Playwright (Vite + API must be running) |

## Docker

```bash
docker compose up --build
# app :3001  ·  mysql :3306
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) builds the app, migrates/seeds MySQL service, runs unit + API + Playwright tests on every PR to `main`.

See `docs/ENVIRONMENTS.md` for Dev / Staging / Production.

## Project layout

```
├── src/app/             # React UI (Figma Make)
├── server/src/          # Express + MySQL TypeScript API
├── server/schema.sql
├── server/migrations/
├── tests/               # unit + API
├── e2e/                 # Playwright
├── Dockerfile
└── docker-compose.yml
```
