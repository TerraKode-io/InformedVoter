#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# InformedVoter — Cron Job Setup (on-prem, host crontab on iv-app)
# Installs all 13 scheduled jobs. Run once after the app is deployed.
#
#   CRON_SECRET=xxxx APP_URL=http://localhost:3000 ./scripts/cron-setup.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_FILE="${LOG_FILE:-/var/log/informedvoter-cron.log}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "${CRON_SECRET}" ]; then
    error "CRON_SECRET is not set. Set it as an environment variable first."
    error "Example: CRON_SECRET=your-secret ./scripts/cron-setup.sh"
    exit 1
fi

# Helper: one curl invocation per job. `curl -f` exits non-zero on HTTP >= 400,
# so failures are captured in the cron log.
job() {
    echo "$1 curl -fsS -H \"Authorization: Bearer \${CRON_SECRET}\" \${APP_URL}$2 >> ${LOG_FILE} 2>&1"
}

CRON_CONTENT="# InformedVoter Cron Jobs — host-level cron (on-prem)
# Generated: $(date -Iseconds)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
CRON_SECRET=${CRON_SECRET}
APP_URL=${APP_URL}

# ── Daily data sync jobs ──
$(job '0 4 * * *'  '/api/cron/sync-local-meetings')
$(job '0 5 * * *'  '/api/cron/sync-scotus')
$(job '0 6 * * *'  '/api/cron/sync-members')
$(job '0 7 * * *'  '/api/cron/sync-bills')
$(job '0 8 * * *'  '/api/cron/sync-votes')

# ── Weekly data sync jobs ──
$(job '0 9 * * 1'  '/api/cron/sync-campaign-finance')
$(job '0 10 * * 1' '/api/cron/sync-elections')
$(job '30 10 * * 5' '/api/cron/sync-social')
$(job '0 10 * * 3' '/api/cron/sync-pac-contributions')

# ── Monthly data sync job (1st of month) ──
$(job '0 11 1 * *' '/api/cron/sync-voter-info')

# ── Daily AI analysis jobs ──
$(job '0 12 * * *' '/api/cron/analyze-bills')
$(job '0 13 * * *' '/api/cron/analyze-candidates')
$(job '0 14 * * *' '/api/cron/analyze-cases')

# ── Daily email digest ──
$(job '0 15 * * *' '/api/cron/send-digest')
"

# Create log file with proper permissions
sudo touch "${LOG_FILE}"
sudo chmod 644 "${LOG_FILE}"

info "Installing cron jobs..."
echo "${CRON_CONTENT}" | crontab -

info "Cron jobs installed. Current crontab:"
crontab -l

info ""
info "Verify manually with:"
info "  curl -H \"Authorization: Bearer \${CRON_SECRET}\" \${APP_URL}/api/cron/sync-members"
