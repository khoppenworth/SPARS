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
- `scripts/deploy/first-deploy.sh` — idempotent first-deploy helper for Ubuntu 24.04 + Apache
- `deploy/systemd/spars-api.service` — systemd service template rendered by the deploy helper
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

# first time only (creates tables + seeds reference data)
npm run prisma:bootstrap

npm run dev
```

API health: `http://localhost:3000/api/v1/health`

## First server deployment quickstart
The repo now includes a single helper for the repetitive first-deploy steps:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/collect/.env.example apps/collect/.env

sudo mkdir -p /etc/spars
sudo cp apps/api/.env.example /etc/spars/spars-api.env
sudoedit /etc/spars/spars-api.env
sudoedit apps/admin/.env
sudoedit apps/collect/.env

sudo npm run deploy:first
```

What `npm run deploy:first` does:
- installs workspace dependencies
- generates the Prisma client
- bootstraps the schema with `prisma db push`
- seeds default organization / RBAC data
- builds the API and both frontends
- publishes static files to `/var/www/spars-admin` and `/var/www/spars-collect`
- renders and installs the `systemd` unit from `deploy/systemd/spars-api.service`
- enables the Apache site and starts `spars-api`

> Why `db push` for first deploy? This repo does not currently include checked-in Prisma migrations, so the quickest reliable bootstrap path is schema sync plus seed data. Once migrations are added, the helper can switch to `prisma migrate deploy`.

## Step 5 status
This repo now includes:
- conditional rules
- calculated fields and indicators
- initial scoring engine
- translation endpoints and basic UI locale selectors

It is now i18n-capable in implementation, but not yet fully locale-resolved at render time across all Builder/Collector views.

## Step 6 status
Collector now supports:
- assigned tool listing from RBAC assignments
- localized published package download
- local package storage
- local draft visit storage
- dynamic questionnaire rendering from the downloaded package

## Step 8 status
Collector now includes:
- section-by-section form navigation
- required/NA validation
- local retry queue for failed sync/submit operations
- date question rendering

## Step 9 status
Collector now includes:
- client-side conditional hiding based on logic rules
- multi-select rendering
- grid/table rendering
- progress indicator
- expanded deployment guide for production rollout
