#!/usr/bin/env bash
set -euo pipefail

SPARS_USER="${SPARS_USER:-spars}"
SPARS_GROUP="${SPARS_GROUP:-$SPARS_USER}"
SPARS_APP_ROOT="${SPARS_APP_ROOT:-/opt/spars}"
SPARS_REPO="${SPARS_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SPARS_API_ENV="${SPARS_API_ENV:-/etc/spars/spars-api.env}"
SPARS_ADMIN_DIR="${SPARS_ADMIN_DIR:-/var/www/spars-admin}"
SPARS_COLLECT_DIR="${SPARS_COLLECT_DIR:-/var/www/spars-collect}"
SPARS_APACHE_SITE_NAME="${SPARS_APACHE_SITE_NAME:-spars.conf}"
SPARS_APACHE_CONF_SRC="${SPARS_APACHE_CONF_SRC:-$SPARS_REPO/docs/apache/spars.conf}"
SPARS_SYSTEMD_TEMPLATE="${SPARS_SYSTEMD_TEMPLATE:-$SPARS_REPO/deploy/systemd/spars-api.service}"
SPARS_SYSTEMD_DEST="${SPARS_SYSTEMD_DEST:-/etc/systemd/system/spars-api.service}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root (for example: sudo npm run deploy:first)." >&2
  exit 1
fi

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Required file not found: $path" >&2
    exit 1
  fi
}

run_as_spars() {
  sudo -u "$SPARS_USER" -H bash -lc "cd '$SPARS_REPO' && $*"
}

require_file "$SPARS_API_ENV"
require_file "$SPARS_APACHE_CONF_SRC"
require_file "$SPARS_SYSTEMD_TEMPLATE"
require_file "$SPARS_REPO/apps/admin/.env"
require_file "$SPARS_REPO/apps/collect/.env"

if ! id "$SPARS_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$SPARS_APP_ROOT" --shell /usr/sbin/nologin "$SPARS_USER"
fi

mkdir -p "$SPARS_APP_ROOT"
chown -R "$SPARS_USER:$SPARS_GROUP" "$SPARS_APP_ROOT"
chown -R "$SPARS_USER:$SPARS_GROUP" "$SPARS_REPO"

INSTALL_CMD="npm install"
if [[ -f "$SPARS_REPO/package-lock.json" ]]; then
  INSTALL_CMD="npm ci"
fi

run_as_spars "$INSTALL_CMD"
run_as_spars "npm run prisma:generate"
run_as_spars "npm run prisma:bootstrap"
run_as_spars "npm run build"

rm -rf "$SPARS_ADMIN_DIR" "$SPARS_COLLECT_DIR"
mkdir -p "$SPARS_ADMIN_DIR" "$SPARS_COLLECT_DIR"
cp -a "$SPARS_REPO/apps/admin/dist/." "$SPARS_ADMIN_DIR/"
cp -a "$SPARS_REPO/apps/collect/dist/." "$SPARS_COLLECT_DIR/"
chown -R www-data:www-data "$SPARS_ADMIN_DIR" "$SPARS_COLLECT_DIR"

sed \
  -e "s|__SPARS_USER__|$SPARS_USER|g" \
  -e "s|__SPARS_GROUP__|$SPARS_GROUP|g" \
  -e "s|__SPARS_REPO__|$SPARS_REPO|g" \
  -e "s|__SPARS_API_ENV__|$SPARS_API_ENV|g" \
  "$SPARS_SYSTEMD_TEMPLATE" > "$SPARS_SYSTEMD_DEST"

cp "$SPARS_APACHE_CONF_SRC" "/etc/apache2/sites-available/$SPARS_APACHE_SITE_NAME"
a2enmod proxy proxy_http rewrite headers >/dev/null
if [[ -f /etc/apache2/sites-enabled/000-default.conf ]]; then
  a2dissite 000-default.conf >/dev/null || true
fi
a2ensite "$SPARS_APACHE_SITE_NAME" >/dev/null

systemctl daemon-reload
systemctl enable --now spars-api
systemctl reload apache2

echo
echo "SPARS first deployment completed."
echo "- API service: systemctl status spars-api --no-pager"
echo "- Health check: curl -s http://127.0.0.1:3000/api/v1/health"
echo "- Apache check: apachectl configtest"
