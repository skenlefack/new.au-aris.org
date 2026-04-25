# Chantier F.1 -- Etat des schemas Prisma et migrations

Date: 2026-04-25
Validation Prisma: PASS ("The schemas at packages/db-schemas/prisma are valid")

## 1. Fichiers Prisma (34 fichiers)

| Fichier | Schema DB | Modeles | Enums |
|---------|-----------|---------|-------|
| `schema.prisma` | (config only) | 0 | 0 |
| `tenant.prisma` | public | Tenant | TenantLevel |
| `credential.prisma` | public | User, UserDevice, SessionLog | UserRole, SessionStatus |
| `settings.prisma` | public | Rec, Country, CountryRec, SystemConfig, Domain, SubDomain, ValueChainCode, UserDomain, AdminLevel, Function, UserFunction, Role, Permission, RolePermission, FunctionRole, UserRoleAssignment, BiToolConfig, BiDataAccessRule, BiDashboard, StatisticDefinition, CountryStatistic, KpiDefinition, CountryKpiScore | SubDomainType |
| `audit.prisma` | audit | AuditLog | - |
| `master-data.prisma` | public | GeoEntity, Species, Disease, Unit, Temporality, Identifier, Denominator, MasterDataAudit, FisheryReferential | GeoLevel, SpeciesCategory, DenominatorSource, IdentifierType, UnitCategory, AuditAction |
| `form-builder.prisma` | form_builder | FormTemplate, FormSubmission, FormOverlay, **FormTarget**, FormVersionHistory | FormTemplateStatus, FormType, FormSubmissionStatus |
| `collecte.prisma` | public | Campaign, **CampaignDomainTarget**, Submission, SyncLog, CollecteWorkflow, CollecteWorkflowStep, CollecteValidationChain, CollecteInstance, CollecteHistory, CollectionCampaign, **CampaignTarget**, CampaignAssignment | CampaignStatus, SubmissionStatus, ConflictStrategy, CollecteInstanceStatus, CollectePriority, CollectionCampaignStatus, CampaignAssignmentStatus |
| `workflow.prisma` | workflow | WorkflowInstance, WorkflowTransition, WorkflowDefinition, WorkflowStep, ValidationChain | WfLevel, WfStatus, WfAction |
| `data-quality.prisma` | public | QualityReport, QualityGateResult, QualityViolation, CorrectionTracker, CustomQualityRule | QualityOverallStatus, QualityGateName, QualityGateStatus, CorrectionStatus, ViolationSeverity |
| `data-contract.prisma` | data_contract | DataContract, ComplianceRecord | ContractStatus, OfficialityLevel, Frequency, ExchangeMechanism |
| `data-sharing.prisma` | data_sharing | DataShareAgreement, DataShareAccessLog | ShareStatus, ShareAccessAction |
| `animal-health.prisma` | animal_health | HealthEvent, LabResult, SurveillanceActivity, VaccinationCampaign, SVCapacity + 35 Ref* tables (RefSpeciesGroup, RefSpecies, RefAgeGroup, RefDisease, RefDiseaseSpecies, RefClinicalSign, RefControlMeasure, RefSeizureReason, RefSampleType, RefContaminationSource, RefAbattoir, RefMarket, RefCheckpoint, RefProductionSystem, RefBreed, RefVaccineType, RefTestType, RefLab, RefLivestockProduct, RefCensusMethodology, RefGearType, RefVesselType, RefAquacultureFarmType, RefLandingSite, RefConservationStatus, RefHabitatType, RefCrimeType, RefCommodity, RefHiveType, RefBeeDisease, RefFloralSource, RefLegalFrameworkType, RefStakeholderType, RefInfrastructure, RefDiagnosisBasis, RefBodyPart, RefCausalAgentType, RefOutbreakStatus, RefEpidemiologicalUnitType, RefNotificationReason, RefSourceOfInfection, RefTransportMode, RefAnimalSex, RefAnimalHusbandry, RefGeneticDiversity, RefDataSource, RefFishFamily) | - |
| `livestock-prod.prisma` | livestock_prod | LivestockCensus, ProductionRecord, SlaughterRecord, TranshumanceCorridor | - |
| `fisheries.prisma` | fisheries | FishCapture, FishingVessel, AquacultureFarm, AquacultureProduction, FishingEffort | - |
| `wildlife.prisma` | wildlife | WildlifeInventory, ProtectedArea, CitesPermit, WildlifeCrime | - |
| `apiculture.prisma` | apiculture | Apiary, HoneyProduction, ColonyHealth, BeekeeperTraining | - |
| `trade-sps.prisma` | trade_sps | TradeFlow, SpsCertificate, MarketPrice | - |
| `governance.prisma` | governance | LegalFramework, InstitutionalCapacity, **VetEvaluation** (@@map pvs_evaluations), StakeholderRegistry | - |
| `climate-env.prisma` | climate_env | WaterStressIndex, RangelandCondition, EnvironmentalHotspot, ClimateDataPoint | - |
| `knowledge-hub.prisma` | knowledge_hub | KnowledgeCategory, KnowledgePublication, KnowledgePublicationAttachment, KnowledgePublicationReview, KnowledgeCourse, KnowledgeCourseModule, KnowledgeEnrollment | - |
| `message.prisma` | public | Notification, NotificationPreference | NotificationChannel, NotificationStatus |
| `drive.prisma` | public | FileRecord | FileStatus |
| `geo-services.prisma` | geo_services | MapLayer, AdminBoundary, GeoEvent, RiskLayer | GeoLayerType, RiskLayerType, RiskSeverity |
| `interop-hub.prisma` | interop_hub | ExportRecord, FeedRecord, SyncRecord, ConnectorConfig | InteropStatus, ConnectorType, ExportFormat |
| `interop-v2.prisma` | interop_v2 | InteropConnection, InteropMapping, InteropTransaction | ExternalSystem, AuthType, MappingDirection, InteropV2Status |
| `datalake.prisma` | datalake | HistoricalDataset, DatasetColumn, DatasetAnalysis | - |
| `datalake-olap.prisma` | datalake | DataLakeEntry, DataLakePartition, DataExport | DatalakeSource, DatalakePartitionStatus, DatalakeExportFormat, DatalakeExportStatus |
| `analytics-worker.prisma` | analytics | AggregateMetric, WorkerState | MetricType, PeriodType |
| `offline.prisma` | offline | SyncSession, SyncDelta, DeviceRegistry | SyncStatus, DeltaOperation, ConflictStatus |
| `support.prisma` | support | Ticket, TicketComment, TicketSLA | TicketCategory, TicketPriority, TicketStatus |
| **`indicators.prisma`** | **analytics** | **IndicatorType, Indicator, IndicatorValue, IndicatorFormula, IndicatorFormulaDependency** | **IndicatorMeasurementMode, IndicatorAggregation, IndicatorPeriodicity, IndicatorScope** |
| **`dashboard-builder.prisma`** | **dashboard_builder** | **Dashboard, DashboardWidget, DashboardShare, UserDashboardPreference** | **DashboardOwnership, DashboardScope, WidgetType, WidgetDataSource, SharePermission** |
| **`reports.prisma`** | **reports** | **ReportTemplate, Report, ReportSection, ReportFile, FlashAlert, FlashStrategy, AiGenerationJob** | **ReportFormat, ReportFrequency, ReportScope, ReportType, ReportStatus, ReportSectionType, FlashAlertSeverity, FlashAlertStatus, AiJobStatus** |

**Nouveaux fichiers (chantiers A-D)** en gras.

## 2. Schemas DB declares dans le datasource

```
schemas = [
  "public", "audit", "datalake", "form_builder", "data_contract",
  "data_sharing", "workflow", "geo_services", "animal_health",
  "livestock_prod", "fisheries", "wildlife", "apiculture", "trade_sps",
  "governance", "climate_env", "knowledge_hub", "interop_hub",
  "interop_v2", "offline", "support", "analytics",
  "dashboard_builder", "reports"
]
```

Total : 24 schemas declares.

## 3. Coherence schemas <-> fichiers

| Schema DB | Fichiers utilisant | Coherent |
|-----------|--------------------|----------|
| public | tenant, credential, settings, master-data, collecte, data-quality, message, drive | OK |
| audit | audit | OK |
| datalake | datalake, datalake-olap | OK |
| form_builder | form-builder | OK |
| data_contract | data-contract | OK |
| data_sharing | data-sharing | OK |
| workflow | workflow | OK |
| geo_services | geo-services | OK |
| animal_health | animal-health | OK |
| livestock_prod | livestock-prod | OK |
| fisheries | fisheries | OK |
| wildlife | wildlife | OK |
| apiculture | apiculture | OK |
| trade_sps | trade-sps | OK |
| governance | governance | OK |
| climate_env | climate-env | OK |
| knowledge_hub | knowledge-hub | OK |
| interop_hub | interop-hub | OK |
| interop_v2 | interop-v2 | OK |
| offline | offline | OK |
| support | support | OK |
| analytics | analytics-worker, **indicators** | OK |
| **dashboard_builder** | **dashboard-builder** | OK |
| **reports** | **reports** | OK |

Resultat : tous les schemas utilises dans les @@schema() sont declares dans le datasource. Aucun orphelin.

## 4. Nouveaux schemas a creer en DB

Les schemas suivants doivent exister dans PostgreSQL avant `prisma db push` :

| Schema | Nouveau? | Action |
|--------|----------|--------|
| `dashboard_builder` | OUI (chantier C) | `CREATE SCHEMA IF NOT EXISTS dashboard_builder;` |
| `reports` | OUI (chantier D) | `CREATE SCHEMA IF NOT EXISTS reports;` |
| `analytics` | Existant | Nouvelles tables (indicators) a ajouter |

Note : `prisma db push` cree automatiquement les schemas manquants lorsque le flag `multiSchema` est actif. Cependant, il est recommande de les creer manuellement avant pour eviter les erreurs de permissions.

## 5. Tables nouvelles a creer (chantiers A-D)

### Chantier A -- Sub-domains & Value Chains
- `form_builder.form_targets` (FormTarget) -- NOUVEAU
- `public.campaign_domain_targets` (CampaignDomainTarget) -- NOUVEAU
- `public.campaign_targets` (CampaignTarget) -- NOUVEAU

### Chantier B -- Indicators
- `analytics.indicator_types` (IndicatorType) -- NOUVEAU
- `analytics.indicators` (Indicator) -- NOUVEAU
- `analytics.indicator_values` (IndicatorValue) -- NOUVEAU
- `analytics.indicator_formulas` (IndicatorFormula) -- NOUVEAU
- `analytics.indicator_formula_dependencies` (IndicatorFormulaDependency) -- NOUVEAU

### Chantier C -- Dashboard Builder
- `dashboard_builder.dashboards` (Dashboard) -- NOUVEAU
- `dashboard_builder.dashboard_widgets` (DashboardWidget) -- NOUVEAU
- `dashboard_builder.dashboard_shares` (DashboardShare) -- NOUVEAU
- `dashboard_builder.user_dashboard_preferences` (UserDashboardPreference) -- NOUVEAU

### Chantier D -- Reports & Flash Alerts
- `reports.report_templates` (ReportTemplate) -- NOUVEAU
- `reports.reports` (Report) -- NOUVEAU
- `reports.report_sections` (ReportSection) -- NOUVEAU
- `reports.report_files` (ReportFile) -- NOUVEAU
- `reports.flash_alerts` (FlashAlert) -- NOUVEAU
- `reports.flash_strategies` (FlashStrategy) -- NOUVEAU
- `reports.ai_generation_jobs` (AiGenerationJob) -- NOUVEAU

Total : 20 nouvelles tables, 2 nouveaux schemas DB.
