# PgBouncer -- Connection Pooling

> PostgreSQL connection pooling proxy for ARIS 3.0 microservices.

---

## 1. Why PgBouncer?

ARIS consists of **22 NestJS microservices**, each running its own Prisma ORM connection pool. Without connection pooling, the total connection count grows rapidly:

```
22 services x 10 connections/pool = 220 connections (minimum)
22 services x 20 connections/pool = 440 connections (default)
```

PostgreSQL's default `max_connections` is 100, and even with tuning, each connection consumes ~5-10 MB of RAM. PgBouncer acts as a lightweight proxy that multiplexes hundreds of client connections onto a small pool of actual PostgreSQL connections.

### Benefits

| Benefit | Description |
|---------|-------------|
| **Connection reduction** | 500 client connections multiplexed onto 20 server connections |
| **Memory savings** | PostgreSQL maintains fewer backends, reducing shared memory usage |
| **Connection reuse** | Idle connections are recycled instead of closed/reopened |
| **Burst handling** | Accepts connection bursts without overwhelming PostgreSQL |
| **Zero-downtime restarts** | Clients hold connections to PgBouncer while PostgreSQL restarts |

---

## 2. Architecture

```
                    Client Connections (up to 500)
                              |
                    +---------v----------+
                    |     PgBouncer      |
                    |   :6432            |
                    |                    |
                    |  Transaction Pool  |
                    |  (20 server conns) |
                    +---------+----------+
                              |
                    +---------v----------+
                    |    PostgreSQL 16    |
                    |   + PostGIS 3.4    |
                    |   :5432            |
                    +--------------------+
```

### Connection Flow

1. NestJS service connects to PgBouncer on port **6432** (via `DATABASE_URL`)
2. PgBouncer authenticates the client using `userlist.txt` (MD5)
3. For each SQL transaction, PgBouncer assigns a real PostgreSQL connection from the pool
4. After the transaction completes, the PostgreSQL connection is returned to the pool
5. Prisma migrations connect directly to PostgreSQL on port **5432** (via `DIRECT_DATABASE_URL`)

---

## 3. Pooling Mode: Transaction

ARIS uses **transaction pooling mode**, which is the most efficient mode for connection reuse.

| Mode | Connection Assigned | Released | Use Case |
|------|-------------------|----------|----------|
| **Session** | On client connect | On client disconnect | Legacy apps needing session state |
| **Transaction** | On `BEGIN` | On `COMMIT`/`ROLLBACK` | Microservices, Prisma ORM |
| **Statement** | Per SQL statement | After statement | Read-only, simple queries |

Transaction pooling is ideal for Prisma because:
- Prisma wraps operations in transactions
- No session-level features are used (prepared statements, temp tables, LISTEN/NOTIFY)
- Maximum connection reuse across 22 services

### Limitations of Transaction Pooling

These PostgreSQL features are **not available** in transaction pooling mode:
- `SET` commands (session variables)
- `PREPARE` / `EXECUTE` (prepared statements)
- `LISTEN` / `NOTIFY`
- Temporary tables
- Advisory locks (session-level)
- `LOAD` statements

> Prisma sends `extra_float_digits` and `search_path` as startup parameters, which PgBouncer cannot forward. These are handled via `ignore_startup_parameters`.

---

## 4. Configuration

### `infrastructure/pgbouncer/pgbouncer.ini`

```ini
[databases]
aris = host=aris-postgres port=5432 dbname=aris

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode
pool_mode = transaction

; Connection limits
max_client_conn = 500       ; Max simultaneous client connections
default_pool_size = 20      ; Server connections per database
min_pool_size = 5           ; Minimum server connections kept open
reserve_pool_size = 5       ; Extra connections for burst handling
reserve_pool_timeout = 3    ; Seconds before using reserve pool

; Timeouts
server_lifetime = 3600      ; Close server conn after 1 hour
server_idle_timeout = 600   ; Close idle server conn after 10 min

; Logging
log_connections = 1
log_disconnections = 1
stats_period = 60           ; Stats refresh interval (seconds)

; Prisma compatibility
ignore_startup_parameters = extra_float_digits,search_path

; Admin access
admin_users = aris
stats_users = aris
```

### `infrastructure/pgbouncer/userlist.txt`

```
"aris" "aris_dev_2024"
```

> In production, use MD5-hashed passwords: `"aris" "md5<hash>"`. Generate with:
> `echo -n "aris_dev_2024aris" | md5sum` and prefix with `md5`.

### Key Parameters Explained

| Parameter | Value | Description |
|-----------|-------|-------------|
| `max_client_conn` | 500 | Maximum client connections PgBouncer accepts. 22 services x ~20 each + headroom. |
| `default_pool_size` | 20 | Number of actual PostgreSQL connections per database. Shared across all clients. |
| `min_pool_size` | 5 | Connections kept warm even when idle. Reduces latency on first request after quiet period. |
| `reserve_pool_size` | 5 | Additional connections available during burst periods. |
| `reserve_pool_timeout` | 3s | Wait time before dipping into reserve pool. |
| `server_lifetime` | 3600s | Server connections recycled after 1 hour (prevents stale connections). |
| `server_idle_timeout` | 600s | Idle server connections closed after 10 minutes. |
| `ignore_startup_parameters` | `extra_float_digits,search_path` | Prisma sends these; PgBouncer ignores them in transaction mode. |

---

## 5. Prisma Compatibility

Prisma requires special configuration to work with PgBouncer in transaction pooling mode.

### Dual Connection URLs

```env
# Application queries go through PgBouncer (port 6432)
DATABASE_URL=postgresql://aris:aris_dev_2024@localhost:6432/aris?pgbouncer=true

# Migrations and introspection connect directly to PostgreSQL (port 5432)
DIRECT_DATABASE_URL=postgresql://aris:aris_dev_2024@localhost:5432/aris
```

### Prisma Schema Configuration

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // PgBouncer (runtime)
  directUrl = env("DIRECT_DATABASE_URL") // Direct PG (migrations)
}
```

### Why Two URLs?

| Operation | URL | Reason |
|-----------|-----|--------|
| Runtime queries | `DATABASE_URL` (PgBouncer) | Connection pooling, performance |
| `prisma migrate deploy` | `DIRECT_DATABASE_URL` (direct) | Migrations use advisory locks, not supported in transaction pooling |
| `prisma db push` | `DIRECT_DATABASE_URL` (direct) | Schema introspection requires direct connection |
| `prisma studio` | `DIRECT_DATABASE_URL` (direct) | Interactive session needs session-level features |

### The `?pgbouncer=true` Flag

This Prisma query parameter:
- Disables prepared statements (not supported in transaction pooling)
- Uses simple protocol instead of extended protocol
- Avoids `SET` commands at connection start

---

## 6. Docker Compose Configuration

```yaml
pgbouncer:
  image: edoburu/pgbouncer:latest
  container_name: aris-pgbouncer
  restart: unless-stopped
  ports:
    - "6432:6432"
  volumes:
    - ./infrastructure/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
    - ./infrastructure/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
  depends_on:
    postgres:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - aris-network
```

### Docker Compose Service Dependencies

All 22 microservices depend on PgBouncer being healthy:

```yaml
x-service-common: &service-common
  depends_on:
    pgbouncer:
      condition: service_healthy
```

---

## 7. Monitoring

### Admin Console

Connect to PgBouncer's admin database to query statistics:

```bash
psql -h localhost -p 6432 -U aris pgbouncer
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `SHOW POOLS;` | Active pool stats per database |
| `SHOW STATS;` | Aggregated request/query statistics |
| `SHOW SERVERS;` | Active server (PostgreSQL) connections |
| `SHOW CLIENTS;` | Active client connections |
| `SHOW CONFIG;` | Current configuration |
| `SHOW DATABASES;` | Database routing configuration |
| `SHOW LISTS;` | Internal list sizes |
| `SHOW MEM;` | Memory usage |

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| `cl_active` | `SHOW POOLS` | Number of active client connections |
| `sv_active` | `SHOW POOLS` | Number of active server connections |
| `sv_idle` | `SHOW POOLS` | Idle server connections (should be > 0) |
| `cl_waiting` | `SHOW POOLS` | Clients waiting for a server connection (> 0 = pool exhaustion) |
| `maxwait` | `SHOW POOLS` | Max wait time for a connection (> 1s = investigate) |
| `total_xact_count` | `SHOW STATS` | Total transactions processed |
| `avg_xact_time` | `SHOW STATS` | Average transaction time (microseconds) |
| `total_query_count` | `SHOW STATS` | Total queries processed |

### Prometheus Integration

Use [pgbouncer_exporter](https://github.com/prometheus-community/pgbouncer_exporter) to expose PgBouncer metrics to Prometheus:

```yaml
pgbouncer-exporter:
  image: prometheuscommunity/pgbouncer-exporter
  environment:
    PGBOUNCER_EXPORTER_HOST: pgbouncer
    PGBOUNCER_EXPORTER_PORT: 6432
    PGBOUNCER_EXPORTER_USER: aris
    PGBOUNCER_EXPORTER_PASS: aris_dev_2024
  ports:
    - "9127:9127"
```

---

## 8. Sizing Guide

### Development Environment

```ini
max_client_conn = 500
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

Sufficient for a single developer running all 22 services locally.

### Production Environment (Recommended)

```ini
max_client_conn = 2000      ; Multiple replicas per service
default_pool_size = 50       ; Higher concurrency
min_pool_size = 10           ; More warm connections
reserve_pool_size = 10       ; Larger burst buffer
server_lifetime = 1800       ; Recycle more frequently
server_idle_timeout = 300    ; Release idle connections faster
```

### Formula

```
default_pool_size >= (concurrent_queries / num_databases)
max_client_conn >= (num_services x replicas x pool_size_per_service) + headroom
PostgreSQL max_connections >= default_pool_size + reserve_pool_size + admin_connections
```

---

## 9. Troubleshooting

### "Too many clients" Error

**Symptom**: `FATAL: too many clients already` from PgBouncer.

**Cause**: Client connections exceed `max_client_conn`.

**Fix**: Increase `max_client_conn` in `pgbouncer.ini`, or reduce connection pool sizes in Prisma schema.

### Prisma Migration Fails

**Symptom**: `prisma migrate deploy` fails with timeout or advisory lock errors.

**Cause**: Running migrations through PgBouncer (transaction pooling doesn't support advisory locks).

**Fix**: Ensure migrations use `DIRECT_DATABASE_URL` (direct PostgreSQL connection):

```prisma
datasource db {
  url       = env("DATABASE_URL")        // PgBouncer
  directUrl = env("DIRECT_DATABASE_URL") // Direct (for migrations)
}
```

### "Unsupported startup parameter" Warning

**Symptom**: PgBouncer logs `unsupported startup parameter: extra_float_digits`.

**Cause**: Prisma sends startup parameters incompatible with transaction pooling.

**Fix**: Add to `pgbouncer.ini`:

```ini
ignore_startup_parameters = extra_float_digits,search_path
```

### Connections Stuck in `cl_waiting`

**Symptom**: `SHOW POOLS` shows increasing `cl_waiting` count.

**Cause**: All server connections are busy; clients are waiting in queue.

**Fix**:
1. Increase `default_pool_size` (more server connections)
2. Increase `reserve_pool_size` (burst capacity)
3. Optimize slow queries (check `avg_xact_time`)
4. Scale PostgreSQL (add read replicas for read-heavy workloads)

### Health Check Failures

**Symptom**: PgBouncer container marked unhealthy.

**Cause**: PgBouncer cannot connect to PostgreSQL, or PostgreSQL is not ready.

**Fix**: Ensure `depends_on: postgres: condition: service_healthy` is set in Docker Compose.

---

## Related Documentation

- [CACHE-STRATEGY.md](./CACHE-STRATEGY.md) -- Redis cache architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) -- Full deployment guide
- [SECURITY.md](./SECURITY.md) -- Security architecture
