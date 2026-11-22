# ASK HRFlow

HR operations dashboard for Automystics — attendance, leave, payroll, recruitment, performance, access control, and role-based workspaces. Built from the Figma Make **ASK HRFlow** export with a Vite + React + Tailwind 4 frontend and Express + MySQL API.

## Stack

- **Frontend:** Vite 6, React 18, TypeScript, Tailwind CSS 4, Radix/shadcn UI
- **Backend:** Express, MySQL 8 (`mysql2`), JWT httpOnly cookies, `bcryptjs`

## Prerequisites

- Node.js 20+
- Docker (optional, for local MySQL)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start MySQL (optional if you already have MySQL)
docker compose up -d

# 3. Configure environment
cp .env.example .env

# 4. Create schema & seed demo data
npm run db:seed

# 5. Run API + Vite dev server
npm run dev
```

- **App:** http://localhost:5173 (Vite proxies `/api` → `http://localhost:3001`)
- **API:** http://localhost:3001/api/health

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| alvi@automystics.com | Admin | demo123 |
| priya.nair@automystics.com | HR | demo123 |
| rahul.verma@automystics.com | Employee | demo123 |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Concurrent API + Vite dev |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Express with `--watch` |
| `npm run build` | Production frontend build → `dist/` |
| `npm start` | Serve API + static `dist/` |
| `npm run db:seed` | Apply `server/schema.sql` and seed data |

## Project layout

```
├── src/                 # React app (Figma Make UI)
│   ├── app/
│   └── styles/
├── server/              # Express API
│   ├── routes/
│   ├── schema.sql
│   └── seed.js
├── docker-compose.yml
└── vite.config.ts       # /api proxy → :3001
```

## API overview

- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/employees`
- `GET/POST /api/leave` · `POST /api/leave/:id/approve`
- `GET/POST /api/attendance`
- `GET /api/dashboard/stats`
- `GET /api/notices` · `GET /api/audit`
- `GET /api/access/users` · `GET /api/access/permissions`

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Set strong `JWT_SECRET` and production database credentials in `.env`. For Hostinger Node.js hosting use `DB_HOST=127.0.0.1` and set env vars via hPanel / Hostinger API (`hosting_nodejs_replace-environment-variables`).

## Hostinger deploy

An active Hostinger Web or Cloud hosting plan is required to provision a site and MySQL database. This account currently has no active hosting order — purchase a plan at https://www.hostinger.com/web-hosting, then ask to deploy again (free `*.hostingersite.com` subdomain + MySQL + Node.js deploy).