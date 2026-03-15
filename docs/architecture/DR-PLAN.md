# ARIS 4.0 — Disaster Recovery Plan

AU-IBAR Animal Resources Information System — Business Continuity & Disaster Recovery.

---

## 1. Recovery Objectives

| Metric | Target | Justification |
|--------|--------|---------------|
| **RPO** (Recovery Point Objective) | **24 hours** | Daily backups; acceptable for statistical/surveillance data |
| **RTO** (Recovery Time Objective) | **4 hours** | Maximum downtime before full service restoration |
| **MTTR** (Mean Time to Repair) | **2 hours** | Target for common failure scenarios |

### Data Priority Classification

| Priority | Data | RPO | RTO |
|----------|------|-----|-----|
| **P1 Critical** | PostgreSQL (all 22 schemas), user credentials, audit logs | 24h | 2h |
| **P2 High** | Redis cache (sessions, read models), Kafka state | Ephemeral | 1h (rebuild) |
| **P3 Medium** | OpenSearch indices (search, analytics) | 24h | 4h (reindex) |
| **P4 Low** | MinIO documents, Grafana dashboards | 24h | 8h |

---

## 2. Backup Schedule

| Component | VM | Schedule | Retention | Script |
|-----------|----|----------|-----------|--------|
| PostgreSQL (pg_dump) | VM-DB | Daily 02:00 UTC | 7 daily + 4 weekly | `backup-postgres.sh` |
| Redis (BGSAVE + AOF) | VM-CACHE | Daily 02:30 UTC | 7 daily | `backup-redis.sh` |
| OpenSearch (snapshots) | VM-CACHE | Daily 03:00 UTC | 7 snapshots | `backup-opensearch.sh` |

### Backup Locations

| VM | Path | Content |
|----|------|---------|
| VM-DB | `/backups/postgres/daily/` | Daily pg_dump files (`.dump`) |
| VM-DB | `/backups/postgres/weekly/` | Sunday copies (4-week retention) |
| VM-CACHE | `/backups/redis/` | RDB dumps + AOF archives |
| VM-CACHE | `/backups/opensearch/` | Snapshot repository (filesystem) |

### Backup Verification

- **Automated**: GitHub Actions workflow `backup-check.yml` runs daily at 06:00 UTC
- **Manual**: `python deploy/scripts/_check_backups.py`
- **Thresholds**: PostgreSQL dump must be > 1 MB, Redis dump must be > 10 KB

---

## 3. Disaster Scenarios & Recovery Procedures

### Scenario 1: Single Service Failure

**Symptoms**: One service returns 5xx or health check fails.

**Recovery** (RTO: 5 minutes):
```bash
# 1. Check logs
ssh arisadmin@10.202.101.183
docker logs aris-<service> --tail 200

# 2. Restart the service
cd /opt/aris-deploy/vm-app
docker compose restart aris-<service>

# 3. If restart fails, rebuild
docker compose up -d --build --no-deps aris-<service>

# 4. Verify health
curl http://localhost:<port>/health
```

### Scenario 2: VM-APP Failure (All Services Down)

**Symptoms**: All 23 services unreachable, Traefik down.

**Recovery** (RTO: 30 minutes):
```bash
# 1. If VM is accessible but Docker is down:
ssh arisadmin@10.202.101.183
sudo systemctl restart docker
cd /opt/aris-deploy/vm-app && docker compose up -d

# 2. If VM needs rebuild from scratch:
#    a. Provision new Ubuntu 22.04 VM
#    b. Run setup script:
bash deploy/scripts/setup-vm-app.sh
#    c. Clone code:
cd /opt && git clone <repo-url> aris
#    d. Start services:
cd /opt/aris-deploy/vm-app && docker compose up -d --build
```

No data loss — VM-APP is stateless (all data is on VM-DB, VM-CACHE, VM-KAFKA).

### Scenario 3: PostgreSQL Failure (VM-DB)

**Symptoms**: Database connection errors across all services.

**Recovery** (RTO: 2 hours):
```bash
# 1. If PostgreSQL container crashed:
ssh arisadmin@10.202.101.185
cd /opt/aris-deploy/vm-db && docker compose up -d aris-postgres
docker compose up -d aris-pgbouncer

# 2. If data volume is corrupted — RESTORE FROM BACKUP:
#    a. Stop PostgreSQL
docker compose down

#    b. Remove corrupted volume
docker volume rm vm-db_postgres-data

#    c. Start fresh PostgreSQL
docker compose up -d aris-postgres
#    Wait for it to be healthy

#    d. Restore the latest dump
LATEST=$(ls -t /backups/postgres/daily/*.dump | head -1)
echo "Restoring: $LATEST"
docker exec -i aris-postgres pg_restore \
  -U aris -d aris --clean --if-exists \
  < "$LATEST"

#    e. Start PgBouncer
docker compose up -d aris-pgbouncer

#    f. Restart all services on VM-APP (they need fresh DB connections)
ssh arisadmin@10.202.101.183
cd /opt/aris-deploy/vm-app && docker compose restart
```

### Scenario 4: Redis Failure (VM-CACHE)

**Symptoms**: Cache misses, session invalidation, slower responses.

**Recovery** (RTO: 15 minutes):
```bash
# 1. Redis is ephemeral cache — restart is usually sufficient:
ssh arisadmin@10.202.101.186
cd /opt/aris-deploy/vm-cache && docker compose restart aris-redis

# 2. If data needs restoration (sessions):
docker compose down aris-redis
LATEST=$(ls -t /backups/redis/redis_dump_*.rdb | head -1)
cp "$LATEST" /var/lib/docker/volumes/vm-cache_redis-data/_data/dump.rdb
docker compose up -d aris-redis
```

Services auto-reconnect to Redis. Cache rebuilds organically from database queries.

### Scenario 5: OpenSearch Failure (VM-CACHE)

**Symptoms**: Search features unavailable, dashboard queries fail.

**Recovery** (RTO: 1 hour):
```bash
# 1. Restart OpenSearch:
ssh arisadmin@10.202.101.186
cd /opt/aris-deploy/vm-cache && docker compose restart aris-opensearch

# 2. If index corruption — restore from snapshot:
#    List available snapshots:
curl -s http://localhost:9200/_snapshot/aris_backup/_all | python3 -m json.tool

#    Restore latest snapshot:
LATEST=$(curl -s http://localhost:9200/_snapshot/aris_backup/_all \
  | python3 -c "import sys,json; snaps=json.load(sys.stdin)['snapshots']; print(snaps[-1]['snapshot'])")

curl -X POST "http://localhost:9200/_snapshot/aris_backup/$LATEST/_restore" \
  -H 'Content-Type: application/json' \
  -d '{"indices": "*", "ignore_unavailable": true}'

# 3. If full reindex needed (no snapshot):
#    Trigger reindex from PostgreSQL via service APIs
#    Each domain service should have a /reindex endpoint or seed script
```

### Scenario 6: Kafka Failure (VM-KAFKA)

**Symptoms**: Event processing stops, consumer lag grows, real-time features fail.

**Recovery** (RTO: 30 minutes):
```bash
# 1. Check broker status:
ssh arisadmin@10.202.101.184
docker ps | grep kafka

# 2. Restart all brokers:
cd /opt/aris-deploy/vm-kafka
docker compose restart aris-kafka-1 aris-kafka-2 aris-kafka-3

# 3. Verify cluster health:
docker exec aris-kafka-1 kafka-metadata --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log \
  --cluster-id MkU3OEVBNTcwNTJENDM2Qk 2>/dev/null || echo "Check broker logs"

# 4. Verify topics:
docker exec aris-kafka-1 kafka-topics --bootstrap-server localhost:29092 --list
```

Kafka with KRaft mode and `replication.factor=3` tolerates 1 broker failure without data loss.

### Scenario 7: Complete Data Center Failure

**Symptoms**: All 4 VMs unreachable.

**Recovery** (RTO: 4 hours):
```bash
# 1. Provision 4 new VMs (Ubuntu 22.04, same specs)

# 2. Run setup scripts:
bash deploy/scripts/setup-vm-db.sh     # VM-DB first (data layer)
bash deploy/scripts/setup-vm-cache.sh  # VM-CACHE second
bash deploy/scripts/setup-vm-kafka.sh  # VM-KAFKA third (if script exists)
bash deploy/scripts/setup-vm-app.sh    # VM-APP last (depends on all others)

# 3. Restore PostgreSQL from off-site backup:
#    (requires backup copies stored externally — see Section 5)

# 4. Restore Redis + OpenSearch from backups

# 5. Clone code and start services:
cd /opt && git clone <repo-url> aris
cd /opt/aris-deploy/vm-app && docker compose up -d --build

# 6. Run health checks:
python deploy/scripts/deploy.py --health

# 7. Reseed reference data if needed:
python deploy/scripts/reseed-ordered.py
```

---

## 4. Recovery Verification Checklist

After any recovery, verify:

- [ ] All 23 services return 200/204 on `/health`
- [ ] Login works (`admin@au-aris.org` / `Aris2024!`)
- [ ] Traefik routes are functioning (`http://<VM-APP>:4000/api/v1/...`)
- [ ] Kafka topics exist and consumers are active (Kafka UI)
- [ ] PostgreSQL accepts connections via PgBouncer (port 6432)
- [ ] Redis is responsive (`redis-cli ping` → PONG)
- [ ] OpenSearch cluster is green (`curl localhost:9200/_cluster/health`)
- [ ] Crontabs for backups are active on VM-DB and VM-CACHE

---

## 5. Off-Site Backup Strategy (Recommended)

Currently all backups reside on the same VMs as the data. For true DR protection:

### Recommended: Rsync to Secondary Location

```bash
# Add to crontab on VM-DB (after backup completes):
# 04:00 UTC — sync PostgreSQL backups to off-site
0 4 * * * rsync -avz /backups/postgres/ offsite-server:/backups/aris/postgres/

# Add to crontab on VM-CACHE:
# 04:30 UTC — sync Redis + OpenSearch backups
0 4 * * * rsync -avz /backups/ offsite-server:/backups/aris/cache/
```

### Alternative: S3-Compatible Object Storage

```bash
# Install MinIO client on backup VMs
mc alias set offsite https://s3.example.com ACCESS_KEY SECRET_KEY
mc mirror /backups/postgres/ offsite/aris-backups/postgres/
```

---

## 6. Communication Plan

| Event | Notify | Channel | Within |
|-------|--------|---------|--------|
| Single service failure | DevOps team | Grafana alert → email | Automatic |
| VM-APP failure | DevOps + PM | Email + phone | 15 min |
| Database failure | DevOps + PM + CTO | Email + phone | 15 min |
| Full data center failure | All stakeholders | Email + phone + AU-IBAR IT | 30 min |
| Recovery complete | All notified parties | Email | Immediate |

---

## 7. Testing Schedule

| Test | Frequency | Procedure |
|------|-----------|-----------|
| Backup verification | Daily (automated) | `backup-check.yml` workflow |
| Single service recovery | Monthly | Kill a non-critical service, verify auto-recovery |
| Database restore drill | Quarterly | Restore pg_dump to a test database, verify data integrity |
| Full DR simulation | Annually | Simulate VM-APP failure, rebuild from scratch |

---

## 8. Contacts

| Role | Responsibility |
|------|---------------|
| **DevOps Lead** | First responder for infrastructure incidents |
| **Database Admin** | PostgreSQL recovery, migration issues |
| **AU-IBAR IT** | VM provisioning, network, data center access |
| **Project Manager** | Stakeholder communication, incident coordination |
