# Detailed deployment — spars.systemsdelight.com (Ubuntu 24.04, Apache, non-Docker)

This repo is a working scaffold. It will boot and serve:
- API: `/api/v1/health`, Swagger: `/api/docs`
- Admin: `/admin`
- Collector PWA: `/collect`

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
sudo apt-get install -y git curl ca-certificates build-essential
sudo apt-get install -y apache2 mysql-server
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
sudo mkdir -p /opt/spars
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

### 5.1 API environment: `/etc/spars/spars-api.env`
```bash
sudo mkdir -p /etc/spars
sudo nano /etc/spars/spars-api.env
```

Paste:
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

## 6) Install deps, migrate DB, seed, build

```bash
cd /opt/spars/repo
sudo -u spars npm install
sudo -u spars npm run prisma:generate
```

### 6.1 First-time migration
```bash
cd /opt/spars/repo/apps/api
sudo -u spars npx prisma migrate dev --name init
```

### 6.2 Seed (org + roles + permissions)
```bash
sudo -u spars node prisma/seed-runner.js
```

### 6.3 Build bundles
```bash
cd /opt/spars/repo
sudo -u spars npm run build
```

---

## 7) Install static sites into /var/www

```bash
sudo rm -rf /var/www/spars-admin /var/www/spars-collect
sudo mkdir -p /var/www/spars-admin /var/www/spars-collect

sudo cp -r /opt/spars/repo/apps/admin/dist/* /var/www/spars-admin/
sudo cp -r /opt/spars/repo/apps/collect/dist/* /var/www/spars-collect/

sudo chown -R www-data:www-data /var/www/spars-admin /var/www/spars-collect
```

---

## 8) systemd service for API

Create `/etc/systemd/system/spars-api.service`:

```ini
[Unit]
Description=SPARS API (NestJS)
After=network.target mysql.service

[Service]
Type=simple
User=spars
Group=spars
WorkingDirectory=/opt/spars/repo/apps/api
EnvironmentFile=/etc/spars/spars-api.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/spars/repo/apps/api

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spars-api
sudo systemctl status spars-api --no-pager
```

Test:
```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

---

## 9) Apache config (single domain)

Enable modules:
```bash
sudo a2enmod proxy proxy_http rewrite headers
sudo systemctl restart apache2
```

Create `/etc/apache2/sites-available/spars.conf` using the repo copy:
```bash
sudo cp /opt/spars/repo/docs/apache/spars.conf /etc/apache2/sites-available/spars.conf
```

Enable site:
```bash
sudo a2dissite 000-default.conf || true
sudo a2ensite spars.conf
sudo systemctl reload apache2
```

---

## 10) Reverse proxy mapping (IMPORTANT)
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

## 11) Looker Studio views
Create views:
```bash
sudo mysql spars < /opt/spars/repo/docs/sql/looker_views.sql
```

Grant:
```bash
sudo mysql
```

```sql
GRANT SELECT ON spars.vw_visits TO 'looker_ro'@'%';
GRANT SELECT ON spars.vw_visit_scores TO 'looker_ro'@'%';
GRANT SELECT ON spars.vw_visit_answers_flat TO 'looker_ro'@'%';
GRANT SELECT ON spars.vw_facility_indicator_trend TO 'looker_ro'@'%';
FLUSH PRIVILEGES;
exit
```

---

## 12) Smoke tests (end-to-end)
From your laptop:
- `https://spars.systemsdelight.com/api/v1/health`
- `https://spars.systemsdelight.com/api/docs`
- `https://spars.systemsdelight.com/admin`
- `https://spars.systemsdelight.com/collect`

---

## 13) Google SSO setup (minimum)
1) Create Google OAuth client ID (Web app) for `spars.systemsdelight.com`
2) Put the client ID in `/etc/spars/spars-api.env` as `GOOGLE_OIDC_CLIENT_ID=...`
3) Create an invited user entry in DB:
```sql
INSERT INTO spars.users(email, fullName, status) VALUES ('you@example.com','Admin','active');
INSERT INTO spars.organization_memberships(orgId, userId, status) VALUES (1, 1, 'active');
```
4) Use Google Sign-In on the frontend (next step). For now, the UIs allow pasting a JWT.

---

## 14) Updating / redeploying
```bash
cd /opt/spars/repo
sudo -u spars git pull
sudo -u spars npm install
sudo -u spars npm run prisma:generate
cd apps/api
sudo -u spars npx prisma migrate deploy
cd ../..
sudo -u spars npm run build

sudo rm -rf /var/www/spars-admin/* /var/www/spars-collect/*
sudo cp -r /opt/spars/repo/apps/admin/dist/* /var/www/spars-admin/
sudo cp -r /opt/spars/repo/apps/collect/dist/* /var/www/spars-collect/
sudo chown -R www-data:www-data /var/www/spars-admin /var/www/spars-collect

sudo systemctl restart spars-api
sudo systemctl reload apache2
```

---

## Next development steps (already scaffolded but not fully implemented)
- Builder UI for creating tools/versions/forms/questions
- Rule engine execution + NA-aware scoring computation on submit
- Proper Google Sign-In button in both UIs
- Role assignment / user management UI


## Step 15) Create your first admin user (IMPORTANT)
After seeding, you must create at least one user and grant them an org-wide admin role.

1) Create user + membership (invite):
```sql
INSERT INTO spars.users(email, fullName, status) VALUES ('you@example.com','Admin','active');
INSERT INTO spars.organization_memberships(orgId, userId, status) VALUES (1, 1, 'active');
```

2) Grant ORGADMIN role (org-wide):
```sql
-- find role id
SELECT id, code FROM spars.role WHERE orgId=1;
-- then insert assignment (replace roleId)
INSERT INTO spars.user_role_assignment(orgId,userId,roleId,toolId,scopeJson,createdAt)
VALUES (1,1,<ROLE_ID_FOR_ORGADMIN>,NULL,NULL,NOW());
```

Then login via Google and you can manage users in Admin UI at `/admin/users`.


## Step 16) Permissions required for Step 2 UI
To use `/admin/tools` features:
- Creating tools and draft versions requires `tool.write` (org-wide or scoped)
- Publishing versions requires `tool.publish`
Assign these by giving yourself `ORGADMIN` or `SUPERADMIN`.


## Step 17) Step 3 Builder permissions
Builder endpoints require `tool.write` and only edit **draft** tool versions.
Suggested workflow:
1) Create tool + draft version in `/admin/tools`
2) Add forms/sections/questions/options in `/admin/builder`
3) Publish the version in `/admin/tools`
4) Collector downloads the published package.


## Step 18) Step 4 logic rules
You can now create logic rules in `/admin/builder` for draft versions.

Supported rule expression operators:
- `eq`, `ne`, `and`, `or`, `not`

Supported actions:
- `setNA` on a `questionCode` or `sectionCode`
- `hide` on a `questionCode` or `sectionCode`
- `require` on a `questionCode`

Rules are applied server-side when a visit is submitted, and the resulting `isNa` / `isHidden` state is snapshotted back onto `visit_responses`.


## Step 19) Step 5 scoring + i18n
Step 5 adds:
- Calculated fields and indicators in the Builder
- Initial NA-aware scoring path on submit
- Translation API and Builder UI for populating the `translations` table
- Simple locale selectors in Admin and Collector

Current scoring implementation:
- `percentFromQuestions`
- `averageCalculatedFields`

Current i18n implementation:
- translation storage and retrieval
- UI locale selectors
- manual translation entry in Builder

Still pending for full multilingual runtime:
- resolving translated labels directly in Admin/Collector form rendering
- user-profile locale persistence in backend


## Step 20) Step 6 collector workflow
Collector now supports:
- `GET /api/v1/collector/assigned-tools`
- `GET /api/v1/collector/tool-versions/:versionId/package-localized?locale=fr`

Operational flow:
1) Assign a user a role scoped to a tool (or org-wide)
2) Publish a tool version
3) In `/collect`, open Assigned Tools and download the localized package
4) Open the package locally and fill the form
5) Save draft locally in the browser

Current limitation:
- Step 6 renders forms dynamically and saves local drafts, but it does not yet push the entire rendered form back through a full sync queue to server-generated visits/responses. That is the next enhancement layer.


## Step 22) Step 8 validation + retry queue
Collector now adds:
- section-by-section navigation
- required-field validation before moving forward or syncing/submitting
- NA reason validation
- local sync queue for failed response syncs or failed submit calls
- manual retry screen at `/collect/sync`

Operational improvement:
Users can continue working even if the submit or sync call fails; the failed operation is queued locally and can be retried later.


---

# Step 9 production deployment expansion

This section supplements the earlier guide and is written to be executable for a real Ubuntu 24.04 rollout behind a reverse proxy on `spars.systemsdelight.com`.

## 1) Recommended production topology

### Edge / Reverse Proxy
Your external reverse proxy should:
- terminate TLS
- forward traffic to the Ubuntu host running Apache
- preserve:
  - `Host`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`

### Ubuntu host
Runs:
- Apache2
- Node.js / NestJS API
- MySQL 8
- static files for `/admin` and `/collect`

### URL map
- `https://spars.systemsdelight.com/admin`
- `https://spars.systemsdelight.com/collect`
- `https://spars.systemsdelight.com/api`
- `https://spars.systemsdelight.com/api/docs`

## 2) Firewall and host hardening

Recommended:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Also:
- keep MySQL bound to `127.0.0.1`
- disable password SSH if you use keys only
- keep OS patched:
```bash
sudo apt-get update && sudo apt-get upgrade -y
```

## 3) MySQL operational settings

Edit:
`/etc/mysql/mysql.conf.d/mysqld.cnf`

Recommended:
- `bind-address = 127.0.0.1`
- keep InnoDB defaults
- ensure enough file descriptors if usage grows

Restart:
```bash
sudo systemctl restart mysql
```

Check:
```bash
sudo systemctl status mysql --no-pager
```

## 4) Node/NPM runtime verification

Check the runtime being used by systemd:
```bash
which node
node -v
npm -v
```

Ensure `/usr/bin/node` is valid because the service file uses that path.

## 5) Build and release discipline

Recommended release workflow:
1. test locally
2. commit to GitHub
3. SSH to server
4. pull latest
5. run migrations
6. rebuild
7. copy frontend assets
8. restart API
9. reload Apache
10. smoke test

Commands:
```bash
cd /opt/spars/repo
sudo -u spars git pull
sudo -u spars npm install
sudo -u spars npm run prisma:generate
cd apps/api
sudo -u spars npx prisma migrate deploy
cd ../..
sudo -u spars npm run build
sudo rm -rf /var/www/spars-admin/* /var/www/spars-collect/*
sudo cp -r /opt/spars/repo/apps/admin/dist/* /var/www/spars-admin/
sudo cp -r /opt/spars/repo/apps/collect/dist/* /var/www/spars-collect/
sudo chown -R www-data:www-data /var/www/spars-admin /var/www/spars-collect
sudo systemctl restart spars-api
sudo systemctl reload apache2
```

## 6) Apache operational notes

After changing config:
```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

Useful modules:
```bash
sudo a2enmod proxy proxy_http rewrite headers
sudo systemctl restart apache2
```

## 7) Systemd operational notes

Check service:
```bash
sudo systemctl status spars-api --no-pager
```

Live logs:
```bash
sudo journalctl -u spars-api -f
```

Restart:
```bash
sudo systemctl restart spars-api
```

## 8) Smoke test checklist after every deployment

From the server:
```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

From your browser:
- `/admin`
- `/collect`
- `/api/docs`

Functional checks:
1. Login with invited user
2. Load tools in admin
3. Download a localized package in collector
4. Open package
5. Save draft
6. Sync draft
7. Submit draft
8. Verify visit scores in DB

## 9) Database verification queries

### Check visits
```sql
SELECT id, orgId, toolVersionId, facilityId, visitDate, status, submittedAt
FROM supervision_visits
ORDER BY id DESC
LIMIT 20;
```

### Check responses
```sql
SELECT visitId, questionId, isNa, isHidden, updatedAt
FROM visit_responses
ORDER BY id DESC
LIMIT 50;
```

### Check scores
```sql
SELECT visitId, indicatorCode, valuePercent, valueScore, createdAt
FROM visit_scores
ORDER BY id DESC
LIMIT 50;
```

### Check translations
```sql
SELECT entityType, entityId, locale, field, value
FROM translations
ORDER BY id DESC
LIMIT 50;
```

## 10) Backup and restore

### Backup
```bash
mkdir -p /opt/spars/backups/db
mysqldump -u app_rw -p'CHANGE_ME_STRONG' spars | gzip > /opt/spars/backups/db/spars_$(date +%F_%H%M%S).sql.gz
```

### Restore
```bash
gunzip -c /opt/spars/backups/db/<backup>.sql.gz | mysql -u app_rw -p spars
```

## 11) Reverse proxy notes specific to collector sync

Because collector now does:
- batch response upload
- submit calls
- retry queue

Set generous upstream limits:
- request timeout: at least 120s
- body size: enough for large JSON payloads
- no response caching on `/api`

## 12) Known production gaps after Step 9

Still recommended before wide rollout:
- replace pasted JWT with real Google Sign-In
- add richer scoring formulas
- enforce backend-side completeness checks beyond UI validation
- add audit dashboards for sync failures
- add monitoring/alerting
