# Migration Room v9 → v10 — Validation

Date : 2026-04-27
Statut : CODE READY — en attente de validation device reel

## Schema changes (v9 → v10)

### New tables (9)
| Table | Chantier | FK parent | Indices |
|-------|----------|-----------|---------|
| campaign_targets | A | campaigns(id) CASCADE | campaignId, domainCode, subDomainCode |
| form_template_targets | A | form_templates(id) CASCADE | templateId, domainCode |
| indicators | C | — | code (UNIQUE), domainCode, subDomainCode, typeCode |
| indicator_values | C | indicators(id) CASCADE | indicatorId, year |
| dashboards | B | — | scope, domainCode, ownerUserId |
| dashboard_widgets | B | dashboards(id) CASCADE | dashboardId |
| reports | D | — | status, domainCode, publishedAt |
| flash_alerts | D | — | severity, detectedAt, isRead |
| user_dashboard_preferences | B | — | UNIQUE(userId, scope, domainCode, subDomainCode, valueChainCode) |

### Altered tables (1)
| Table | Change |
|-------|--------|
| photos | ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0 |

## Migration strategy
- Additive only: no DROP, no ALTER COLUMN, no data modification
- Legacy `domain` columns preserved on campaigns and form_templates
- `fallbackToDestructiveMigration()` kept as safety net AFTER explicit migration
- Migration order: v9 → MIGRATION_9_10 → v10

## Test coverage
- `Migration9To10Test` (3 tests):
  1. Legacy data preserved after migration (campaigns, templates, photos)
  2. Insert into all 9 new tables + FK cascade verification
  3. Unique index enforcement on indicator code

## Device validation procedure
1. Install APK v9 (current production)
2. Create test data (login, submissions, photos)
3. Install APK v10 (this build) WITHOUT uninstall
4. Verify app starts without crash
5. Verify legacy data still accessible
6. Verify new screens accessible (empty state)

### Validation result
- [ ] Emulator API 29: PENDING
- [ ] Real device (Android 8+): PENDING
- [ ] Real device (Android 14): PENDING
