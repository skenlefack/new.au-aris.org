# Mobile Alignment — Completion Report

Date : 2026-04-27
Branche : `feature/mobile-alignment-extended`
Scope : ETENDU (tous les lots 1-9)

## Checklist

### Lot 1 — PVS Removal
- [x] 3 occurrences PVS renommees en "Vet Evaluation" dans DomainDashboardData.kt
- [x] Gradle task `checkNoPvsMention` liee au lifecycle `check`

### Lot 2 — Room Migration v9->v10
- [x] MIGRATION_9_10 avec 9 nouvelles tables + retryCount sur photos
- [x] 9 entites Room creees (CampaignTarget, FormTemplateTarget, Indicator, IndicatorValue, Dashboard, DashboardWidget, Report, FlashAlert, UserDashboardPreference)
- [x] PhotoEntity augmentee de retryCount
- [x] ArisDatabase v10 avec exportSchema=true
- [x] DatabaseModule avec migration explicite
- [x] Migration9To10Test (3 tests instrumentes)
- [ ] **Validation device reel** — EN ATTENTE (voir procedure dans 02-migration-validation.md)

### Lot 3 — Multi-Target (Chantier A)
- [x] CampaignTargetDao + FormTemplateTargetDao avec requetes JOIN
- [x] TargetDto ajoute aux DTOs (CampaignDto, CampaignDetailDto, FormTemplateDto)
- [x] TargetMapper avec fallback legacy domain
- [x] CampaignRepository persiste les targets (refresh + sync)
- [x] SyncRepository persiste campaign + template targets
- [x] TargetBadges composable (primary/secondary, overflow +N)
- [x] CampaignListScreen + CampaignDetailScreen avec badges
- [x] TargetMapperTest (5 tests unitaires)

### Lot 4 — Indicateurs (Chantier C)
- [x] IndicatorDao + IndicatorValueDao
- [x] IndicatorApi (Ktor)
- [x] IndicatorRepository avec refresh
- [x] IndicatorListScreen (tendance, formatage K/M)
- [x] IndicatorDetailScreen (valeur courante, LineChart, metadata)
- [x] IndicatorListViewModel + IndicatorDetailViewModel

### Lot 5 — Rapports (Chantier D)
- [x] ReportDao avec download status tracking
- [x] ReportApi avec download PDF (10MB cap)
- [x] ReportRepository (state machine NOT_DOWNLOADED -> DOWNLOADING -> DOWNLOADED)
- [x] ReportListScreen avec badges statut download
- [x] ReportDetailScreen avec OfflinePdfViewer (Android PdfRenderer natif)
- [x] ReportDetailViewModel

### Lot 6 — Dashboards (Chantier B)
- [x] DashboardDao + DashboardWidgetDao + UserDashboardPreferenceDao
- [x] DashboardMobileApi (list + render)
- [x] DashboardMobileRepository avec snapshot caching
- [x] DashboardListScreen
- [x] DashboardViewScreen (1 colonne, widgets empiles)
- [x] 7 widget renderers (KPI, LineChart, BarChart, Table, TextBlock, AlertFeed, Unsupported)

### Lot 7 — Flash Alerts (Chantier D)
- [x] FlashAlertDao avec unread tracking
- [x] FlashAlertRepository
- [x] FlashAlertListScreen (severite, indicateur non-lu)
- [x] FlashAlertListViewModel

### Lot 8 — Pagination Sync + Nettoyage
- [x] SyncRepository : batch submissions par chunks de 10
- [x] SyncRepository.cleanupOldSubmissions() : supprime SYNCED > 30 jours
- [x] CacheRefreshWorker appelle cleanup a chaque cycle 24h
- [x] PhotoDao : getPendingUpload() filtre retryCount < 3
- [x] PhotoDao : incrementRetry() + markAsAbandoned()
- [x] PhotoUploadWorker : increment retryCount avant chaque tentative
- [x] SubmissionDao : deleteSyncedOlderThan(cutoff)

### Lot 9 — CI + i18n
- [x] .github/workflows/mobile-ci.yml (build + tests + emulator)
- [x] 33 nouvelles strings EN/FR/AR/PT (indicators, reports, dashboards, flash alerts)

### Integration
- [x] ArisDatabase : 7 abstract DAO methods
- [x] DatabaseModule : 7 Hilt @Provides
- [x] NetworkModule : 3 API services (Indicator, Dashboard, Report)
- [x] ArisNavGraph : 7 routes (indicators, reports, dashboards, flash alerts)

## Statistiques

| Metrique | Valeur |
|----------|--------|
| Commits sur la branche | 10 (mobile) + 2 (dashboard fixes) |
| Fichiers Kotlin crees | 41 |
| Fichiers modifies | ~27 |
| Lignes ajoutees | ~4100 |
| Tests unitaires ajoutes | 5 (TargetMapperTest) |
| Tests instrumentes ajoutes | 3 (Migration9To10Test) |
| Nouvelles entites Room | 9 |
| Nouveaux DAOs | 10 |
| Nouveaux ecrans UI | 12 |
| Nouvelles API services | 3 |
| Nouvelles routes navigation | 7 |
| Nouvelles strings i18n | 33 x 4 locales = 132 |

## Risques mitiges

| Risque | Statut |
|--------|--------|
| C1 : Pas de migration Room | RESOLU — MIGRATION_9_10 |
| C2 : Multi-target invisible | RESOLU — TargetBadges UI |
| I1 : PVS residuel | RESOLU — renomme + gradle guard |
| I2 : DTOs ignorent targets[] | RESOLU — TargetDto parse |
| I3 : Sync non paginee | RESOLU — batch 10 |
| I4 : Pas de CI mobile | RESOLU — mobile-ci.yml |
| M2 : Photo retry infini | RESOLU — cap 3 retries |
| M3 : Pas de nettoyage synced | RESOLU — 30 jours auto |

## Prochaines etapes

1. **Validation device reel** de la migration v9->v10
2. **Build APK** : `cd apps/mobile && ./gradlew assembleDebug`
3. **Merge** vers main apres validation
4. **Distribution** APK aux testeurs terrain
5. **Phase ulterieure** : IA mobile (apres stabilisation desktop)
