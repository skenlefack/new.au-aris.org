# ARIS 4.0 — Deployment Runbook

Production deployment procedures for the AU-IBAR Animal Resources Information System.

---

## Infrastructure Overview

| VM | Hostname | IP | Role |
|----|----------|:--:|------|
| VM-APP | nbo-aris04 | 10.202.101.183 | 23 NestJS services, Traefik, Next.js, MinIO, Superset, Metabase, Grafana |
| VM-KAFKA | nbo-brk01 | 10.202.101.184 | Kafka KRaft x3, Schema Registry, Kafka UI |
| VM-DB | nbo-dbms03 | 10.202.101.185 | PostgreSQL 16 + PostGIS 3.4 + PgBouncer |
| VM-CACHE | nbo-cch01 | 10.202.101.186 | Redis 7 + OpenSearch 2.17 + Dashboards |

- **SSH user**: `arisadmin`
- **Code path**: `/opt/aris` (git clone of `main` branch)
- **Docker Compose**: `/opt/aris-deploy/vm-{app,kafka,db,cache}/`

---

## 1. Prerequisites

### Local Machine

```bash
# Set SSH credentials (required for all deploy scripts)
export ARIS_DEPLOY_PASS='<ssh-password>'
# Or use key-based auth (preferred):
export ARIS_DEPLOY_KEY=/path/to/id_rsa
```

### GitHub Actions

Configure these secrets in **Settings > Secrets and variables > Actions**:

| Secret | Description |
|--------|-------------|
| `VM_APP_HOST` | `10.202.101.183` |
| `VM_DB_HOST` | `10.202.101.185` |
| `VM_CACHE_HOST` | `10.202.101.186` |
| `DEPLOY_SSH_USER` | `arisadmin` |
| `DEPLOY_SSH_PASS` | SSH password |

Run the setup script: `bash deploy/scripts/setup-github-secrets.sh`

---

## 2. Standard Deployment

### 2.1 Deploy All Services

```bash
python deploy/scripts/deploy.py --all
```

This performs: `git pull` → `docker compose up -d --build` → health checks on all 23 services.

### 2.2 Deploy Specific Services

```bash
python deploy/scripts/deploy.py credential message workflow
```

Only rebuilds and restarts the named services (no-deps).

### 2.3 Code-Only Pull (No Rebuild)

```bash
python deploy/scripts/deploy.py --pull-only
```

### 2.4 Health Checks Only

```bash
python deploy/scripts/deploy.py --health
```

### 2.5 Via GitHub Actions

1. Go to **Actions > Deploy > Run workflow**
2. Enter services (comma-separated) or `all`
3. Deployment also triggers automatically when CI passes on `main`

---

## 3. Service Health Verification

All 23 services expose `/health` endpoints:

| Service | Port | Endpoint |
|---------|------|----------|
| tenant | 3001 | `http://localhost:3001/health` |
| credential | 3002 | `http://localhost:3002/health` |
| master-data | 3003 | `http://localhost:3003/health` |
| data-quality | 3004 | `http://localhost:3004/health` |
| data-contract | 3005 | `http://localhost:3005/health` |
| message | 3006 | `http://localhost:3006/health` |
| drive | 3007 | `http://localhost:3007/health` |
| realtime | 3008 | `http://localhost:3008/health` |
| form-builder | 3010 | `http://localhost:3010/health` |
| collecte | 3011 | `http://localhost:3011/health` |
| workflow | 3012 | `http://localhost:3012/health` |
| animal-health | 3020 | `http://localhost:3020/health` |
| livestock-prod | 3021 | `http://localhost:3021/health` |
| fisheries | 3022 | `http://localhost:3022/health` |
| wildlife | 3023 | `http://localhost:3023/health` |
| apiculture | 3024 | `http://localhost:3024/health` |
| trade-sps | 3025 | `http://localhost:3025/health` |
| governance | 3026 | `http://localhost:3026/health` |
| climate-env | 3027 | `http://localhost:3027/health` |
| analytics | 3030 | `http://localhost:3030/health` |
| geo-services | 3031 | `http://localhost:3031/health` |
| interop-hub | 3032 | `http://localhost:3032/health` |
| knowledge-hub | 3033 | `http://localhost:3033/health` |

Expected response: HTTP 200 or 204.

---

## 4. Rollback Procedures

### 4.1 Rollback a Service to Previous Image

```bash
# SSH to VM-APP
ssh arisadmin@10.202.101.183

# Find previous image
docker images | grep aris-credential

# Revert git to previous commit
cd /opt/aris
git log --oneline -5
git checkout <previous-commit-hash>

# Rebuild only the affected service
cd /opt/aris-deploy/vm-app
docker compose up -d --build --no-deps aris-credential
```

### 4.2 Rollback All Services

```bash
ssh arisadmin@10.202.101.183
cd /opt/aris && git revert HEAD --no-edit
cd /opt/aris-deploy/vm-app && docker compose up -d --build
```

### 4.3 Emergency: Restart Without Rebuild

```bash
ssh arisadmin@10.202.101.183
cd /opt/aris-deploy/vm-app
docker compose restart aris-credential aris-message
```

---

## 5. Database Migrations

### 5.1 Run Migrations on Production

```bash
# From VM-APP, target a specific service
docker exec -e DATABASE_URL="postgresql://aris:<password>@10.202.101.185:5432/aris" \
  aris-credential npx prisma migrate deploy --schema=prisma
```

### 5.2 Seed Reference Data

```bash
docker exec -e DATABASE_URL="postgresql://aris:<password>@10.202.101.185:5432/aris" \
  aris-master-data npx tsx src/seed.ts
```

### 5.3 Migration Safety Rules

- **Always** use `prisma migrate deploy` (not `prisma migrate dev`) in production
- **Always** backup the database before running migrations
- **Test** migrations on a staging copy first if they involve data transformation
- Migrations connect **directly** to PostgreSQL (port 5432), not through PgBouncer

---

## 6. Log Inspection

### Service Logs

```bash
# On VM-APP
docker logs aris-credential --tail 100 -f
docker logs aris-workflow --since 1h
```

### Traefik Access Logs

```bash
docker logs aris-traefik --tail 200 | jq .
```

### Kafka Logs

```bash
# On VM-KAFKA
docker logs aris-kafka-1 --tail 100
docker logs aris-kafka-2 --tail 100
docker logs aris-kafka-3 --tail 100
```

### PostgreSQL Logs

```bash
# On VM-DB
docker logs aris-postgres --tail 100
```

---

## 7. Common Issues & Fixes

### Service won't start (port conflict)

```bash
docker ps -a | grep :3002
docker stop <conflicting-container>
docker compose up -d --no-deps aris-credential
```

### Kafka consumer lag building up

```bash
# Check via Kafka UI at http://10.202.101.184:8080
# Or via CLI on VM-KAFKA:
docker exec aris-kafka-1 kafka-consumer-groups --bootstrap-server localhost:29092 \
  --describe --all-groups
```

### PgBouncer connection exhaustion

```bash
# On VM-DB: check active connections
docker exec aris-pgbouncer psql -p 6432 -U aris pgbouncer -c "SHOW POOLS"
docker exec aris-pgbouncer psql -p 6432 -U aris pgbouncer -c "SHOW CLIENTS"
```

### Disk space low

```bash
# On any VM
df -h
docker system prune -f          # Remove dangling images/containers
docker volume prune -f           # Remove unused volumes (CAUTION)
```

---

## 8. Monitoring URLs

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | `http://10.202.101.183:3100` | Dashboards, alerts |
| Prometheus | `http://10.202.101.183:9090` | Metrics queries |
| Kafka UI | `http://10.202.101.184:8080` | Kafka cluster monitoring |
| Traefik | `http://10.202.101.183:8090` | API gateway routes |
| Superset | `http://10.202.101.183:8088` | BI dashboards |
| Metabase | `http://10.202.101.183:3100` | Embedded analytics |
