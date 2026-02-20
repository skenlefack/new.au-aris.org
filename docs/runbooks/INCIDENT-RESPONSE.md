# Incident Response Runbook

> Common issues, diagnostics, and resolution procedures for ARIS 3.0.

## Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|--------------|---------|
| **P1 - Critical** | System down, data loss risk | 15 min | Database unreachable, Kafka cluster down |
| **P2 - Major** | Key feature broken, workaround exists | 1 hour | Workflow approvals failing, quality gates offline |
| **P3 - Minor** | Non-critical feature degraded | 4 hours | Notifications delayed, analytics lag |
| **P4 - Low** | Cosmetic or minor inconvenience | Next sprint | UI alignment, slow non-critical query |

---

## 1. Service Health Checks

### Check All Services

```bash
# Check Docker containers
docker compose ps

# Check individual service health
curl -s http://localhost:3020/api/v1/health | jq
curl -s http://localhost:3030/health | jq
```

### Service Port Reference

| Service | Port | Health Endpoint |
|---------|------|----------------|
| tenant | 3001 | `/api/v1/health` |
| credential | 3002 | `/api/v1/health` |
| master-data | 3003 | `/api/v1/health` |
| data-quality | 3004 | `/api/v1/health` |
| data-contract | 3005 | `/api/v1/health` |
| message | 3006 | `/api/v1/health` |
| drive | 3007 | `/api/v1/health` |
| realtime | 3008 | `/api/v1/realtime/health` |
| form-builder | 3010 | `/api/v1/health` |
| collecte | 3011 | `/api/v1/health` |
| workflow | 3012 | `/api/v1/health` |
| animal-health | 3020 | `/api/v1/health` |
| analytics | 3030 | `/health` |

---

## 2. Database Issues

### PostgreSQL Connection Failure

**Symptoms:** Services fail to start, `ECONNREFUSED` on port 5432.

**Diagnosis:**
```bash
# Check PG container
docker compose logs postgres --tail 50

# Check connectivity
docker exec postgres pg_isready -U aris -d aris_dev

# Check active connections
docker exec postgres psql -U aris -d aris_dev -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution:**
1. Restart PostgreSQL: `docker compose restart postgres`
2. If connection pool exhausted: restart affected services
3. If data corruption: restore from backup (see DATA-MIGRATION.md)

### Slow Queries

**Symptoms:** API response time > 2s, high CPU on PostgreSQL.

**Diagnosis:**
```bash
# Find slow queries
docker exec postgres psql -U aris -d aris_dev -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY duration DESC
  LIMIT 10;
"

# Check missing indexes
docker exec postgres psql -U aris -d aris_dev -c "
  SELECT relname, seq_scan, idx_scan
  FROM pg_stat_user_tables
  WHERE seq_scan > idx_scan AND seq_scan > 1000
  ORDER BY seq_scan DESC;
"
```

**Resolution:**
1. Add missing indexes
2. Analyze tables: `ANALYZE <table_name>;`
3. Check for N+1 query patterns in Prisma calls
4. Consider adding `include` to batch-load relations

### Prisma Migration Failure

**Symptoms:** `pnpm db:migrate` fails, schema drift.

**Diagnosis:**
```bash
# Check migration status
cd packages/db-schemas && npx prisma migrate status
```

**Resolution:**
1. If drift: `npx prisma migrate resolve --applied <migration_name>`
2. If conflict: `npx prisma migrate reset` (DEV ONLY — destroys data)
3. In production: apply SQL manually, then mark as applied

---

## 3. Kafka Issues

### Kafka Broker Down

**Symptoms:** Services log `ECONNREFUSED` on Kafka ports, events not published.

**Diagnosis:**
```bash
# Check broker containers
docker compose logs kafka-1 --tail 50
docker compose logs kafka-2 --tail 50
docker compose logs kafka-3 --tail 50

# Check cluster metadata
docker exec kafka-1 kafka-metadata.sh \
  --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log
```

**Resolution:**
1. Restart failed broker: `docker compose restart kafka-2`
2. Wait for ISR catch-up (check under-replicated partitions)
3. If all brokers down: `docker compose restart kafka-1 kafka-2 kafka-3`
4. Services will auto-reconnect via `@aris/kafka-client` retry logic

### Consumer Lag Increasing

**Symptoms:** Analytics data stale, workflow auto-advance delayed.

**Diagnosis:**
```bash
# Check consumer group lag
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --describe --group analytics-health-consumer
```

**Resolution:**
1. Check consumer service is running: `docker compose logs analytics --tail 50`
2. If consumer crashed: restart service
3. If processing slow: check downstream dependencies (Redis, PostgreSQL)
4. If too much backlog: consider resetting to latest (data loss for skipped events)

### Message in DLQ

**Symptoms:** Failed events in `dlq.all.v1` topic.

**Diagnosis:**
```bash
# Inspect DLQ messages
docker exec kafka-1 kafka-console-consumer.sh \
  --bootstrap-server kafka-1:29092 \
  --topic dlq.all.v1 \
  --from-beginning \
  --property print.key=true \
  --property print.headers=true \
  --max-messages 5
```

**Resolution:**
1. Identify the original topic from message headers
2. Fix the processing bug in the consumer
3. Replay the message to the original topic
4. Monitor for recurrence

---

## 4. Service-Specific Issues

### Quality Validation Failing

**Symptoms:** All submissions rejected, quality reports show FAILED.

**Diagnosis:**
```bash
# Check data-quality service logs
docker compose logs data-quality --tail 100

# Check quality rules
curl -s http://localhost:3004/api/v1/data-quality/rules \
  -H "Authorization: Bearer <token>" | jq
```

**Resolution:**
1. Check if master-data referentials are loaded (species, diseases, geo)
2. Verify custom quality rules haven't been misconfigured
3. Check data-quality service connectivity to PostgreSQL

### Workflow Stuck

**Symptoms:** Workflow instances not advancing, SLA breaches increasing.

**Diagnosis:**
```bash
# Check pending workflows
curl -s "http://localhost:3012/api/v1/workflow/dashboard" \
  -H "Authorization: Bearer <token>" | jq

# Check workflow service logs
docker compose logs workflow --tail 100
```

**Resolution:**
1. Check if quality event consumer is running (auto-advance L1)
2. Verify RBAC — correct user role for the current workflow level
3. Check for stuck transactions in PostgreSQL
4. Manual escalation: call `POST /instances/:id/approve` with appropriate role

### Inter-Service HTTP Call Failure

**Symptoms:** `ServiceClientError` or `CircuitBreakerOpenError` in logs.

**Diagnosis:**
```bash
# Check target service is running
curl -s http://localhost:<port>/api/v1/health

# Check circuit breaker state (in logs)
grep "circuit breaker" /path/to/service.log
```

**Resolution:**
1. Restart the target service
2. Circuit breaker will auto-recover after 30s (`HALF_OPEN` → test request → `CLOSED`)
3. If persistent: check network between services, verify env variables

---

## 5. Redis Issues

### Redis Connection Failure

**Symptoms:** Analytics KPIs stale, sessions lost.

**Diagnosis:**
```bash
docker compose logs redis --tail 50
docker exec redis redis-cli ping
docker exec redis redis-cli info memory
```

**Resolution:**
1. Restart Redis: `docker compose restart redis`
2. KPIs will be rebuilt from Kafka events (CQRS pattern)
3. Sessions will require re-login

### Redis Memory Full

**Symptoms:** `OOM command not allowed` errors.

**Diagnosis:**
```bash
docker exec redis redis-cli info memory | grep used_memory_human
docker exec redis redis-cli dbsize
```

**Resolution:**
1. Increase `maxmemory` in Redis config
2. Set appropriate TTL on KPI keys
3. Flush stale data: `redis-cli FLUSHDB` (DEV ONLY)

---

## 6. MinIO / File Storage Issues

### Upload Failure

**Symptoms:** `POST /api/v1/drive/upload` returns 500.

**Diagnosis:**
```bash
docker compose logs minio --tail 50
docker exec minio mc ls local/aris-documents/
```

**Resolution:**
1. Check MinIO is running and accessible on port 9000
2. Verify bucket exists: `docker exec minio mc mb local/aris-documents`
3. Check disk space: `docker exec minio df -h`

---

## 7. Elasticsearch Issues

### Search Not Returning Results

**Symptoms:** Knowledge hub search returns empty, publication search broken.

**Diagnosis:**
```bash
# Check ES health
curl -s http://localhost:9200/_cluster/health | jq

# Check indices
curl -s http://localhost:9200/_cat/indices?v
```

**Resolution:**
1. If cluster RED: `docker compose restart elasticsearch`
2. Re-index: trigger re-indexing from the knowledge-hub service
3. Check disk space (ES requires 5% free disk minimum)

---

## 8. Escalation Matrix

| Tier | Scope | Contact |
|------|-------|---------|
| L1 | Service restarts, log analysis | On-call engineer |
| L2 | Database issues, Kafka operations | Platform team (CC-1) |
| L3 | Architecture changes, data recovery | Technical architect |
| L4 | Security incidents, data breaches | CISO + AU-IBAR management |

## 9. Post-Incident Checklist

- [ ] Incident documented with timeline
- [ ] Root cause identified
- [ ] Fix applied and verified
- [ ] Monitoring/alerting gap addressed
- [ ] Runbook updated if new issue type
- [ ] Stakeholders notified (if P1/P2)
