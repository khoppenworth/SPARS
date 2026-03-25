# Detailed deployment — spars.systemsdelight.com (Ubuntu 24.04, Apache, non-Docker)

This repo is a working scaffold. It will boot and serve:
- API: `/api/v1/health`, Swagger: `/api/docs`
- Admin: `/admin`
- Collector PWA: `/collect`

## The simplest first-deploy path
The repo now includes `scripts/deploy/first-deploy.sh`, which automates the repetitive install/build/publish steps for an initial Ubuntu 24.04 deployment.

Use it after completing the package install, MySQL setup, and environment file steps below:

```bash
cd /opt/spars/repo
sudo npm run deploy:first
```

The helper will:
- install workspace dependencies
- run `npm run prisma:generate`
- bootstrap the database with `npm run prisma:bootstrap` (`prisma db push` + seed)
- build the API, admin UI, and collector UI
- copy frontend bundles into `/var/www`
- install the Apache site config
- render/install the `systemd` unit and start `spars-api`

> Important: this bootstrap flow intentionally uses `prisma db push` because the repository does not currently include committed Prisma migration files. For future revisioned deployments, add migrations and switch to `npm run prisma:migrate`.

## 0) Decide your edge/TLS model
You said the server is already behind a reverse proxy on `spars.systemsdelight.com`.

### Model A — TLS ends at the reverse proxy (most common)
- Your reverse proxy terminates HTTPS and forwards HTTP to this server (Apache on :80).
- Use the provided Apache `:80` vhost.
- Ensure reverse proxy forwards `/admin`, `/collect`, `/api`, `/api/docs`.

### Model B — TLS ends on this server
- You install certs on Apache here.
- Add an SSL VirtualHost (you can copy/paste from your existing approach).

This guide covers **Model A** (TLS at reverse proxy). If you want Model B, tell me and I’ll include the SSL vhost.

---

## 1) Install base packages

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential apache2 mysql-server
```

### Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

---

## 2) MySQL: create DB and users

Run:
```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS spars CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'app_rw'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME_STRONG';
GRANT ALL PRIVILEGES ON spars.* TO 'app_rw'@'127.0.0.1';

CREATE USER IF NOT EXISTS 'looker_ro'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG';
-- we'll grant SELECT on views after creating them

FLUSH PRIVILEGES;
exit
```

Lock MySQL to localhost (recommended):
Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:
- set `bind-address = 127.0.0.1`
Then:
```bash
sudo systemctl restart mysql
```

---

## 3) Create service user and directories

```bash
sudo useradd --system --create-home --home-dir /opt/spars --shell /usr/sbin/nologin spars || true
sudo mkdir -p /opt/spars /etc/spars
sudo chown -R spars:spars /opt/spars
```

---

## 4) Deploy code from GitHub

```bash
cd /opt/spars
sudo -u spars git clone https://github.com/<you>/spars-platform.git repo
```

---

## 5) Configure environment

### 5.1 API runtime environment: `/etc/spars/spars-api.env`
```bash
sudo cp /opt/spars/repo/apps/api/.env.example /etc/spars/spars-api.env
sudo nano /etc/spars/spars-api.env
```

Set real values for:
```env
NODE_ENV=production
PORT=3000
BASE_URL=https://spars.systemsdelight.com
CORS_ORIGINS=https://spars.systemsdelight.com

JWT_SECRET=CHANGE_ME_LONG_RANDOM
GOOGLE_OIDC_CLIENT_ID=CHANGE_ME.apps.googleusercontent.com

DATABASE_URL="mysql://app_rw:CHANGE_ME_STRONG@127.0.0.1:3306/spars"
```

Secure it:
```bash
sudo chown root:root /etc/spars/spars-api.env
sudo chmod 600 /etc/spars/spars-api.env
```

### 5.2 Frontend build env
Create:
- `/opt/spars/repo/apps/admin/.env`
- `/opt/spars/repo/apps/collect/.env`

```bash
cp /opt/spars/repo/apps/admin/.env.example /opt/spars/repo/apps/admin/.env
cp /opt/spars/repo/apps/collect/.env.example /opt/spars/repo/apps/collect/.env
```

Admin `.env`:
```env
VITE_API_BASE=https://spars.systemsdelight.com/api/v1
VITE_BASE_PATH=/admin
```

Collector `.env`:
```env
VITE_API_BASE=https://spars.systemsdelight.com/api/v1
VITE_BASE_PATH=/collect
```

---

## 6) Run the first-deploy helper

```bash
cd /opt/spars/repo
sudo npm run deploy:first
```

The script is safe to re-run for iterative setup changes. It expects:
- `/etc/spars/spars-api.env`
- `apps/admin/.env`
- `apps/collect/.env`

You can override defaults when needed:

```bash
sudo SPARS_REPO=/opt/spars/repo \
     SPARS_API_ENV=/etc/spars/spars-api.env \
     SPARS_ADMIN_DIR=/var/www/spars-admin \
     SPARS_COLLECT_DIR=/var/www/spars-collect \
     npm run deploy:first
```

---

## 7) Validate services

```bash
systemctl status spars-api --no-pager
curl -s http://127.0.0.1:3000/api/v1/health
apachectl configtest
```

---

## 8) Reverse proxy mapping (IMPORTANT)
Your upstream reverse proxy must forward these paths to this server:
- `/admin/*`
- `/collect/*`
- `/api/*`
- `/api/docs`

Also forward headers:
- `Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

---

## 9) Looker Studio views
Create views:
```bash
sudo mysql spars < /opt/spars/repo/docs/sql/looker_views.sql
```

Grant read-only access:
```sql
GRANT SELECT ON spars.* TO 'looker_ro'@'%';
FLUSH PRIVILEGES;
```
