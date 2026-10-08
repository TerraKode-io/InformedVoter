# 14 — On-Prem Deployment (Proxmox)

> **Last Updated:** 2026-10-08
> **Status:** Prepared. Network/VM execution pending operator window.

This is the authoritative runbook for running InformedVoter on the self-hosted
Proxmox host `pve` (`10.10.10.100`). It replaces Vercel + Supabase.

The network/switch/OPNsense/Cloudflare details live in the network repo:
`S:\Network-config\03-SERVICES\informedvoter-civic.md`. This document covers the
application side.

---

## 1. Architecture

```
Internet
   │  DNS: knowyourgov.us on Cloudflare (proxied, Full strict)
   ▼
Cloudflare edge ──► 50.184.245.19:80/443
   │  OPNsense DNAT (source = cloudflare_ips alias)
   ▼  10.10.100.117
┌──────────────────── VM `iv-app` (VMID 264) ────────────────────┐
│  net0 VLAN 10  10.10.10.130   mgmt                             │
│  net1 VLAN 100 10.10.100.117  public DNAT origin               │
│  net2 VPC      10.39.112.19                                    │
│  Docker: Caddy (TLS) + Next.js app + Umami                     │
│  host crontab → curl localhost:3000/api/cron/*                 │
└───────────────────────────────┬────────────────────────────────┘
                                │ VPC 10.39.112.0/20 (isolated vmbr2)
┌───────────────────────────────▼──── VM `iv-data` (VMID 265) ───┐
│  net0 VLAN 10  10.10.10.131   mgmt                             │
│  net1 VPC      10.39.112.20                                    │
│  Docker: PostgreSQL 16  +  Redis 7                            │
└────────────────────────────────────────────────────────────────┘
```

- The app VM is the **only** public server. PostgreSQL and Redis are VPC-only and
  never on a routed/public segment.
- TLS at the origin is a **Cloudflare Origin CA certificate** (15-year), mounted
  at `docker/certs/` and terminated by Caddy. Cloudflare SSL mode is
  **Full (strict)**. (Let's Encrypt DNS-01 was attempted but the ACME
  propagation self-check is unreliable against the internal resolver, so the
  Origin CA cert is used instead. No ACME is in play.)

---

## 2. Hosts

| | `iv-app` (264) | `iv-data` (265) |
|---|---|---|
| Specs | 2 vCPU / 4 GB / 50 GB | 2 vCPU / 4 GB / 100 GB |
| NICs | VLAN10 `.130` · VLAN100 `.117` · VPC `.19` | VLAN10 `.131` · VPC `.20` |
| Runs | Caddy, Next.js, Umami | PostgreSQL 16, Redis 7 |
| Public | Yes (`50.184.245.19`) | No |

The app's VLAN 100 interface needs a **source policy route** (priority 100 →
table 100, default via `10.10.100.1`) so DNAT/Cloudflare replies egress the PROD
gateway, not MGMT — identical to TerraKode `prod-web`.

---

## 3. Repository layout (infra files)

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage standalone Next.js build |
| `docker-compose.app.yml` | `app` + `caddy` + `umami` (run on `iv-app`) |
| `docker-compose.data.yml` | `postgres` + `redis` (run on `iv-data`) |
| `docker/caddy/Dockerfile` | Caddy built with the Cloudflare DNS plugin |
| `docker/Caddyfile` | Site config + DNS-01 TLS |
| `scripts/deploy.sh` | Pull, rebuild, `prisma db push`, health check |
| `scripts/cron-setup.sh` | Installs all 13 host crontab jobs |
| `scripts/backup-db.sh` | Nightly `pg_dump` with rotation + offsite |
| `.env.example` / `.env.production` | App VM env template |
| `.env.data.example` | Data VM env template (`DB_PASSWORD`, `REDIS_PASSWORD`) |

---

## 4. Provisioning VMs

1. In Proxmox, create VMs 264 / 265 (Ubuntu 24.04, specs above).
2. Attach NICs per §2. `vmbr1` already carries VLAN 10 and 100; `vmbr2` is the
   isolated VPC. **No bridge changes needed.**
3. Harden each VM (UFW, fail2ban, unattended-upgrades, SSH keys-only) using the
   approach in `.deprecated/scripts/vps-setup.sh`.
4. On `iv-data`, UFW must allow `5432` and `6379` **from `10.39.112.19` only**,
   and SSH from VLAN 10.

---

## 5. Data tier (`iv-data`)

```bash
cd /opt/informedvoter
cp .env.data.example .env      # set DB_PASSWORD, REDIS_PASSWORD
docker compose -f docker-compose.data.yml up -d
```

- Postgres binds `10.39.112.20:5432`; Redis binds `10.39.112.20:6379`
  (`requirepass`, AOF).
- Backups: add to root crontab —
  `0 2 * * * /opt/informedvoter/scripts/backup-db.sh`.

### Migrate data from Supabase

```bash
# From a host that can reach Supabase's direct connection:
pg_dump --format=custom --no-owner --no-acl "<supabase-direct-url>" > iv.dump

# Restore into the on-prem database (run where the dump is, piped to the VM):
cat iv.dump | ssh iv-data \
  'docker exec -i iv-postgres pg_restore -U informedvoter -d informedvoter --no-owner'
```

Then, on `iv-app` (or from a dev machine pointed at the VPC):
```bash
npx prisma db push
npx tsx prisma/seed.ts
node prisma/seed-governors.mjs
node prisma/seed-elections.mjs
```

---

## 6. Application tier (`iv-app`)

```bash
cd /opt/informedvoter
git clone <repo> .            # or git pull
cp .env.example .env          # fill in secrets
mkdir -p docker/certs         # place Cloudflare Origin CA cert/key here:
#   docker/certs/knowyourgov.pem  (certificate)
#   docker/certs/knowyourgov.key  (private key, chmod 600)
docker compose -f docker-compose.app.yml up -d --build

# Install the 13 cron jobs:
sudo CRON_SECRET="<secret>" APP_URL="http://localhost:3000" ./scripts/cron-setup.sh
```

`.env` key values:
- `DATABASE_URL=postgresql://informedvoter:<DB_PASSWORD>@10.39.112.20:5432/informedvoter?schema=public`
- `REDIS_URL=redis://:<REDIS_PASSWORD>@10.39.112.20:6379`
- `UMAMI_DATABASE_URL=...5432/umami`, `UMAMI_APP_SECRET=<random>`
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://analytics.knowyourgov.us/script.js`,
  `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<from Umami>`
- `CF_API_TOKEN` is **not** required for TLS (Origin CA cert is used); keep blank
  unless you need Cloudflare API access from the app.

### TLS (Cloudflare Origin CA)

Generate a key + CSR and request the cert (valid 15 years):

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout knowyourgov.key -out knowyourgov.csr \
  -subj "/CN=knowyourgov.us" \
  -addext "subjectAltName=DNS:knowyourgov.us,DNS:*.knowyourgov.us"
# POST knowyourgov.csr to https://api.cloudflare.com/client/v4/certificates with
# the SSL-scoped token: {"csr":...,"hostnames":["knowyourgov.us","*.knowyourgov.us"],
# "requested_validity":5475,"request_type":"origin-rsa"} → result.certificate
```

Place the returned certificate + key in `docker/certs/` and set the Cloudflare
zone SSL mode to **Full (strict)**.

### Umami database

Create it once in Postgres (the Umami container manages its own tables):
```bash
docker exec -it iv-postgres createdb -U informedvoter umami
```

---

## 7. Data freshness after cutover

Once the app is live and pointed at the on-prem database, **run every cron job
once** to refresh all datasets (a lot has changed since the original data pull):

```bash
SECRET="<CRON_SECRET>"
for job in sync-scotus sync-members sync-bills sync-votes \
           sync-local-meetings sync-campaign-finance sync-elections \
           sync-pac-contributions sync-voter-info \
           analyze-bills analyze-candidates analyze-cases send-digest; do
  echo "== $job =="
  curl -fsS -H "Authorization: Bearer $SECRET" "http://localhost:3000/api/cron/$job"
  echo
done
```

Check the `DataSyncLog` table to confirm each job recorded a successful run. The
AI jobs (`analyze-*`) will only process a bounded batch per run, so let them run
daily to backfill.

---

## 8. Verification

| Check | Expected |
|---|---|
| `GET https://knowyourgov.us/api/health` | `{"status":"ok"}` |
| Homepage / state pages | render from on-prem DB |
| `https://analytics.knowyourgov.us` | Umami UI |
| Rate limiting | 429 after burst |
| `crontab -l` on `iv-app` | 13 jobs |
| `docker compose -f docker-compose.app.yml logs app` | no errors |

---

## 9. Rollback

1. Cloudflare: repoint `knowyourgov.us`/`www`/`analytics` to the prior origin.
2. `docker compose -f docker-compose.app.yml down` on `iv-app`.
3. Keep Supabase read-only until burn-in is complete, then decommission Vercel.

---

## See also

- Network repo `03-SERVICES/informedvoter-civic.md` — DNAT, Cloudflare, VMs
- `documentation/08_DEPLOYMENT.md`
- `documentation/13_VERCEL_SUPABASE_MIGRATION.md` — prior (now reversed) migration
