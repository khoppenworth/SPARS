# SPARS Platform (Builder + Mobile/PWA Collector + API)

Single-domain layout:
- Admin UI: `/admin`
- Collector PWA: `/collect`
- API: `/api` (NestJS; `/api/v1`)

Stack:
- **NestJS + Prisma + MySQL**
- **React (Vite)** for Admin and Collector
- **Apache2** reverse proxy + static hosting (Ubuntu 24.04, non-Docker)
- Google SSO (OIDC ID token exchange)
- Multi-tool + versions + tool-scoped RBAC
- i18n support via `translations` table
- Looker Studio views (MySQL)

## What’s in this repo
- `apps/api` — NestJS API
- `apps/admin` — Admin UI scaffold
- `apps/collect` — Collector PWA scaffold (offline storage stub via IndexedDB)
- `docs/deployment_ubuntu24_apache.md` — detailed deployment guide for `spars.systemsdelight.com`
- `docs/sql/looker_views.sql` — curated views for Looker Studio

## Local dev quickstart
Prereqs: Node.js 20+, MySQL 8

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/collect/.env.example apps/collect/.env

npm install
npm run prisma:generate

# first time only (creates tables)
cd apps/api
npx prisma migrate dev --name init
node prisma/seed-runner.js

# back to root
cd ../..
npm run dev
```

API health: `http://localhost:3000/api/v1/health`
