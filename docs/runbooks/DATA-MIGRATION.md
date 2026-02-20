# Data Migration Runbook

> Schema migration procedures, data seeding, and backup/restore for ARIS 3.0.

## 1. Prisma Migration Overview

ARIS uses Prisma 5 with the `multiSchema` preview feature. Schemas are defined in `packages/db-schemas/prisma/` with one `.prisma` file per domain.

### Schema Files

| File | PostgreSQL Schema | Domain |
|------|------------------|--------|
| `schema.prisma` | (config) | Generator + datasource configuration |
| `tenant.prisma` | `public` | Multi-tenant hierarchy |
| `credential.prisma` | `public` | User authentication |
| `master-data.prisma` | `public` | Reference data, audit trail |
| `data-quality.prisma` | `public` | Quality gates, corrections |
| `message.prisma` | `public` | Notifications |
| `drive.prisma` | `public` | File storage metadata |
| `collecte.prisma` | `public` | Campaigns, submissions, sync |
| `form-builder.prisma` | `form_builder` | Form templates |
| `data-contract.prisma` | `data_contract` | Data contracts, compliance |
| `workflow.prisma` | `workflow` | Workflow instances, transitions |
| `geo-services.prisma` | `geo_services` | Map layers, boundaries, spatial events |
| `animal-health.prisma` | `animal_health` | Health events, lab, surveillance, vaccination |
| `knowledge-hub.prisma` | `knowledge_hub` | Publications, e-learning, FAQ |
| `interop-hub.prisma` | `interop_hub` | Export/feed/sync records, connectors |

### Database Schemas (17 total)

Created by `infra/init-databases.sql`:

```
public, tenant, credential, message, drive, realtime,
master_data, data_quality, data_contract, interop_hub,
form_builder, collecte, workflow,
animal_health, livestock_prod, fisheries, wildlife,
apiculture, trade_sps, governance, climate_env,
analytics, geo_services, knowledge_hub, audit
```

---

## 2. Creating a Migration

### Step 1: Modify Schema

Edit the relevant `.prisma` file in `packages/db-schemas/prisma/`.

```prisma
// Example: add a new field to HealthEvent
model HealthEvent {
  // ... existing fields
  analyticsReady Boolean @default(false) @map("analytics_ready")
}
```

### Step 2: Generate Migration

```bash
cd packages/db-schemas
npx prisma migrate dev --name add_analytics_ready_to_health_event
```

This creates a new migration file in `packages/db-schemas/prisma/migrations/`.

### Step 3: Review Generated SQL

Always review the generated SQL before applying:

```bash
cat prisma/migrations/20240601000000_add_analytics_ready_to_health_event/migration.sql
```

### Step 4: Apply Migration

**Development:**
```bash
pnpm db:migrate
# or
cd packages/db-schemas && npx prisma migrate deploy
```

**Production:**
```bash
# Generate migration SQL without applying
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql

# Review, then apply manually
psql -U aris -d aris_prod -f migration.sql
```

### Step 5: Regenerate Prisma Client

```bash
npx prisma generate
```

---

## 3. Migration Best Practices

### Do

- Always create reversible migrations (add columns as nullable first)
- Test migrations on a copy of production data
- Run migrations during low-traffic periods
- Back up the database before migrating
- Keep migrations small and focused

### Don't

- Never use `prisma migrate reset` in production (destroys all data)
- Don't modify existing migration files after they've been applied
- Don't combine schema changes with data migrations in one step
- Don't add NOT NULL constraints without a default value

### Handling Breaking Changes

For breaking changes (column rename, type change, drop column):

1. **Phase 1**: Add new column (nullable), deploy code that writes to both
2. **Phase 2**: Backfill data from old column to new column
3. **Phase 3**: Switch reads to new column, stop writing old column
4. **Phase 4**: Drop old column

---

## 4. Data Seeding

### Seed Master Data

```bash
pnpm db:seed
# or per-service
cd services/master-data && pnpm db:seed
```

### Seed Structure

Each service with seed data has a `src/seed.ts` file:

```typescript
// services/master-data/src/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed countries (ISO 3166)
  await prisma.geoEntity.createMany({ data: countries });
  // Seed WOAH species
  await prisma.species.createMany({ data: species });
  // Seed WOAH diseases
  await prisma.disease.createMany({ data: diseases });
}
```

### Required Seed Order

Due to foreign key constraints, seed in this order:

1. `tenant` — AU-IBAR, RECs, sample Member States
2. `credential` — Admin users per tenant
3. `master-data` — Geography, species, diseases, units, identifiers
4. `data-contract` — Sample contracts per domain
5. `form-builder` — Sample form templates
6. Domain services — Sample domain data

---

## 5. Backup & Restore

### Full Database Backup

```bash
# Compressed backup
docker exec postgres pg_dump -U aris -d aris_dev \
  --format=custom --compress=9 \
  > backup_$(date +%Y%m%d_%H%M%S).dump

# SQL format (human-readable)
docker exec postgres pg_dump -U aris -d aris_dev \
  --format=plain --clean --if-exists \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Schema-Only Backup

```bash
docker exec postgres pg_dump -U aris -d aris_dev \
  --schema-only --format=plain \
  > schema_$(date +%Y%m%d_%H%M%S).sql
```

### Single Schema Backup

```bash
# Backup only animal_health schema
docker exec postgres pg_dump -U aris -d aris_dev \
  --schema=animal_health --format=custom \
  > animal_health_$(date +%Y%m%d_%H%M%S).dump
```

### Restore

```bash
# From custom format
docker exec -i postgres pg_restore -U aris -d aris_dev \
  --clean --if-exists \
  < backup_20240601_120000.dump

# From SQL format
docker exec -i postgres psql -U aris -d aris_dev \
  < backup_20240601_120000.sql
```

### Automated Backup Schedule (Production)

```bash
# Crontab entry: daily at 02:00 UTC, retain 30 days
0 2 * * * pg_dump -U aris -d aris_prod --format=custom --compress=9 \
  > /backups/aris_$(date +\%Y\%m\%d).dump \
  && find /backups -name "aris_*.dump" -mtime +30 -delete
```

---

## 6. Data Export / Import

### Export Table to CSV

```bash
docker exec postgres psql -U aris -d aris_dev -c "
  COPY (SELECT * FROM animal_health.health_event WHERE tenant_id = '<uuid>')
  TO STDOUT WITH CSV HEADER
" > health_events_export.csv
```

### Import CSV to Table

```bash
docker exec -i postgres psql -U aris -d aris_dev -c "
  COPY animal_health.health_event FROM STDIN WITH CSV HEADER
" < health_events_import.csv
```

### Cross-Environment Data Transfer

```bash
# Export from staging
pg_dump -U aris -h staging-db -d aris_staging \
  --schema=master_data --data-only --format=custom \
  > master_data_staging.dump

# Import to production
pg_restore -U aris -h prod-db -d aris_prod \
  --data-only --disable-triggers \
  < master_data_staging.dump
```

---

## 7. Schema Drift Detection

### Check for Drift

```bash
cd packages/db-schemas
npx prisma migrate status
```

Output:
- `Database schema is up to date` — no drift
- `Following migrations have not yet been applied` — pending migrations
- `The database schema is not in sync` — drift detected

### Resolve Drift

**If migration was applied manually:**
```bash
npx prisma migrate resolve --applied <migration_name>
```

**If database was modified outside of Prisma:**
```bash
# Generate a migration that captures the current state
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

---

## 8. Disaster Recovery

### Recovery Steps

1. **Assess damage**: Determine which schemas/tables are affected
2. **Stop services**: `docker compose stop` (prevent further writes)
3. **Restore from backup**: Use most recent backup (see section 5)
4. **Apply pending migrations**: `npx prisma migrate deploy`
5. **Verify data integrity**: Run quality checks on restored data
6. **Restart services**: `docker compose up -d`
7. **Monitor**: Watch for errors in service logs for 30 minutes
8. **Replay Kafka events**: If analytics/read models are stale, reset consumer offsets to re-materialize

### Recovery Time Objectives

| Component | RTO | RPO | Backup Frequency |
|-----------|-----|-----|-----------------|
| PostgreSQL | 1 hour | 24 hours | Daily + WAL archiving |
| Redis | 5 minutes | Rebuiltable | N/A (CQRS read model) |
| MinIO | 2 hours | 24 hours | Daily |
| Kafka | 30 minutes | 0 (replicated) | Built-in replication |
| Elasticsearch | 1 hour | Rebuiltable | N/A (re-indexable) |
