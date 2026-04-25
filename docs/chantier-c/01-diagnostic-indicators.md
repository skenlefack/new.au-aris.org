# Chantier C -- Diagnostic Indicateurs

> Rapport produit le 2026-04-25 -- lecture seule, aucune modification du code.

---

## 1. Modele actuel des indicateurs

Le systeme ARIS possede **trois mecanismes distincts** pour stocker et afficher des indicateurs/KPIs :

### 1.1 KPI Definitions + Country KPI Scores (schema `governance` / settings)

Fichier : `packages/db-schemas/prisma/settings.prisma` (lignes 488-536)

```
model KpiDefinition {
  id            String   @id @default(uuid()) @db.Uuid
  code          String   @unique @db.VarChar(50)
  name          Json     // { en, fr, pt, ar }
  description   Json?
  domainCode    String?  @map("domain_code") @db.VarChar(30)
  icon          String?  @db.VarChar(50)
  color         String?  @db.VarChar(20)
  unit          String   @default("percentage") @db.VarChar(20)
  targetValue   Float    @default(100) @map("target_value")
  thresholdGood Int      @default(75) @map("threshold_good")
  thresholdWarn Int      @default(50) @map("threshold_warn")
  scope         String   @default("both") @db.VarChar(20)   // country, rec, both
  isPreset      Boolean  @default(false) @map("is_preset")
  isActive      Boolean  @default(true) @map("is_active")
  sortOrder     Int      @default(0) @map("sort_order")
  // timestamps
  countryScores CountryKpiScore[]
  @@map("kpi_definitions")   @@schema("governance")
}

model CountryKpiScore {
  id         String   @id @default(uuid()) @db.Uuid
  countryId  String   @map("country_id") @db.Uuid
  kpiId      String   @map("kpi_id") @db.Uuid
  score      Float    // 0-100
  year       Int
  quarter    Int?
  source     String   @default("manual") @db.VarChar(20) // manual, computed
  notes      String?
  updatedBy  String?  @map("updated_by") @db.Uuid
  // timestamps + relations
  @@unique([countryId, kpiId, year, quarter])
  @@map("country_kpi_scores")   @@schema("governance")
}
```

**Relations** : `Country` 1..N `CountryKpiScore` N..1 `KpiDefinition`

**Service backend** : `services/tenant/src/services/settings.service.ts` -- methodes :
- `listKpiDefinitions(query)` (ligne ~2067)
- `createKpiDefinition(dto, user)` (ligne ~2088)
- `updateKpiDefinition(id, dto, user)` (ligne ~2118)
- `deleteKpiDefinition(id, user)` (ligne ~2147)
- `getCountryKpiScores(countryId, year?)` (ligne ~2160)
- `upsertCountryKpiScores(countryId, items, user)` (ligne ~2179)

**Routes** : `services/tenant/src/routes/settings.routes.ts`

**Kafka topics** :
- `sys.settings.kpi-definition.updated.v1`
- `sys.settings.country-kpi-score.updated.v1`

### 1.2 Statistic Definitions + Country Statistics (schema `governance` / settings)

Fichier : `packages/db-schemas/prisma/settings.prisma` (lignes 441-486)

```
model StatisticDefinition {
  id            String   @id
  code          String   @unique @db.VarChar(50)
  name          Json     // { en, fr, pt, ar }
  description   Json?
  domainCode    String   @map("domain_code") @db.VarChar(30)
  icon          String?
  color         String?
  unit          String   @default("count")     // count, percentage, currency, tonnes
  format        String   @default("number")    // number, currency, compact
  sourceType    String   @map("source_type")   // form_builder, manual
  sourceConfig  Json?    @map("source_config") // { templateId?, fieldCode?, aggregation }
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)
  countryStats  CountryStatistic[]
  @@map("statistic_definitions")   @@schema("governance")
}

model CountryStatistic {
  id            String   @id
  countryId     String   @map("country_id")
  statisticId   String   @map("statistic_id")
  isVisible     Boolean  @default(true)
  displayPeriod String   @default("current_year")
  periodStart   DateTime?
  periodEnd     DateTime?
  overrideValue Float?   @map("override_value")
  sortOrder     Int      @default(0)
  @@unique([countryId, statisticId])
  @@map("country_statistics")   @@schema("governance")
}
```

Ce mecanisme est lie aux pages pays/landing page. `sourceConfig` permet theoriquement de lier un `StatisticDefinition` a un template de formulaire (`form_builder`) mais la logique de calcul automatique n'est pas implementee -- les valeurs sont saisies manuellement ou via `overrideValue`.

### 1.3 Aggregate Metrics (schema `analytics`)

Fichier : `packages/db-schemas/prisma/analytics-worker.prisma`

```
enum MetricType { COUNT, SUM, AVG, MIN, MAX, RATE, RATIO }
enum PeriodType { DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY }

model AggregateMetric {
  id           String     @id
  tenant_id    String
  domain       String     @db.VarChar(50)
  metric_name  String     @db.VarChar(100)
  metric_type  MetricType
  period_type  PeriodType
  period_start DateTime
  period_end   DateTime
  value        Float
  dimensions   Json?
  metadata     Json?
  @@unique([tenant_id, domain, metric_name, metric_type, period_type, period_start])
  @@map("aggregate_metrics")   @@schema("analytics")
}
```

Ce modele est destine au traitement Kafka Streams (service `analytics`). Il stocke des metriques aggregees par domaine, type, et periode. Il n'a **pas de formule declarative** -- le calcul est code en dur dans `services/analytics/src/services/cross-domain.service.ts`.

---

## 2. Types d'indicateurs actuels

### 2.1 Pas d'enum "type d'indicateur" formel

Il n'existe **aucun enum IndicatorType** dans le code. Les distinctions sont implicites :

| Mecanisme | Type implicite | Stockage |
|-----------|---------------|----------|
| `KpiDefinition` | KPI avec seuils (bon/alerte/danger) | `governance.kpi_definitions` |
| `StatisticDefinition` | Statistique descriptive (comptage, pourcentage) | `governance.statistic_definitions` |
| `AggregateMetric` | Metrique calculee par domaine | `analytics.aggregate_metrics` |
| `MetricType` enum | COUNT, SUM, AVG, MIN, MAX, RATE, RATIO | analytics-worker.prisma |

### 2.2 Indicateurs codes en dur

Le service `analytics/src/services/cross-domain.service.ts` contient un **Composite Risk Score** (ligne ~237) avec 6 composantes ponderees :
- Animal Health risk (weight: 25%)
- Livestock risk (weight: 15%)
- Trade risk (weight: 15%)
- Fisheries risk (weight: 10%)
- Governance (inverse PVS, weight: 20%)
- Climate risk (weight: 15%)

Les poids et formules sont **codes en dur** dans le fichier TypeScript, pas dans la base de donnees.

### 2.3 KPI presets (seeds)

Le fichier `services/tenant/src/seed-kpis.ts` definit **6 presets CAADEP** :

| Code | Domaine | Description |
|------|---------|-------------|
| `vaccination-coverage` | animal-health | % du cheptel vaccine |
| `disease-notification` | animal-health | % events notifies dans les 24h |
| `livestock-census` | livestock-prod | % unites admin avec donnees a jour |
| `trade-certification` | trade-sps | % transactions avec certificats SPS |
| `fisheries-monitoring` | fisheries | % zones avec monitoring actif |
| `wildlife-conservation` | wildlife | Indice composite conservation |

Tous sont marques `isPreset: true` et ne peuvent pas etre supprimes (seulement desactives).

---

## 3. Volume

### 3.1 Seeds / fixtures

| Source | Nombre d'enregistrements |
|--------|--------------------------|
| KPI presets (`seed-kpis.ts`) | 6 definitions |
| Country KPI Scores | 0 en seed (saisie manuelle en production) |
| Statistic Definitions | Seeds via `seed-settings.ts` (lies aux domaines) |
| PVS Evaluations (`services/governance/src/seed.ts`) | 3 evaluations pour Kenya |
| Institutional Capacities (`services/governance/src/seed.ts`) | 5 enregistrements pour Kenya |
| AggregateMetric | 0 en seed (calcule par Kafka consumers) |

### 3.2 Volume historique estime

- Les KPI scores et statistiques sont saisis manuellement par pays. Avec 55 pays, 6 KPIs, et ~3 ans de donnees, on peut estimer **~1000 enregistrements** dans `country_kpi_scores`.
- Les `aggregate_metrics` dependent du volume d'evenements Kafka traites. Potentiellement **10k-100k** lignes en production.
- Les PVS evaluations : **3 seeds** (Kenya uniquement). En production, un ordre de grandeur de **100-300** evaluations (55 pays x quelques evaluations).

---

## 4. Endpoints existants

### 4.1 Service tenant (settings) -- KPI Definitions

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/settings/kpi-definitions` | Lister les definitions KPI |
| POST | `/api/v1/settings/kpi-definitions` | Creer une definition KPI |
| PATCH | `/api/v1/settings/kpi-definitions/:id` | Modifier une definition KPI |
| DELETE | `/api/v1/settings/kpi-definitions/:id` | Supprimer une definition KPI (non-preset) |
| GET | `/api/v1/settings/countries/:id/kpi-scores` | Scores KPI d'un pays |
| PUT | `/api/v1/settings/countries/:id/kpi-scores` | Upsert scores KPI d'un pays |

### 4.2 Service governance -- PVS Evaluations

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/governance/pvs-evaluations` | Creer evaluation PVS |
| GET | `/api/v1/governance/pvs-evaluations` | Lister evaluations PVS |
| GET | `/api/v1/governance/pvs-evaluations/:id` | Detail evaluation PVS |
| PATCH | `/api/v1/governance/pvs-evaluations/:id` | Modifier evaluation PVS |

### 4.3 Service analytics

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/analytics/governance/pvs-scores` | Scores PVS par pays |
| GET | `/api/v1/analytics/cross-domain/risk-score` | Score de risque composite |
| GET | `/api/v1/analytics/db-stats` | Statistiques globales (inclut pvs_eval count) |

### 4.4 Service datalake (historical)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/historical/dashboard-kpis` | KPIs historiques pre-calcules |

---

## 5. UI existante

### 5.1 Pages frontend KPI/indicateurs

| Page | Fichier | Description |
|------|---------|-------------|
| Settings > KPIs | `apps/web/src/app/(dashboard)/settings/kpis/page.tsx` | CRUD des definitions KPI (admin) |
| Settings > Countries > [id] | `apps/web/src/app/(dashboard)/settings/countries/[id]/page.tsx` | Scores KPI par pays |
| Governance | `apps/web/src/app/(dashboard)/governance/page.tsx` | Dashboard avec KPI cards |
| Governance > PVS | `apps/web/src/app/(dashboard)/governance/pvs/page.tsx` | Liste evaluations PVS |
| Governance > Capacity | `apps/web/src/app/(dashboard)/governance/capacity/page.tsx` | Capacites (inclut pvs_score) |
| PVS Scores Chart | `apps/web/src/app/(dashboard)/governance/PvsScoresChart.tsx` | Graphique scores PVS (recharts) |
| Analytics | `apps/web/src/app/(dashboard)/analytics/page.tsx` | Dashboard analytique |
| Historical Dashboard | `apps/web/src/app/(dashboard)/historical/dashboard/page.tsx` | KPIs historiques |
| Country Page (landing) | `apps/web/src/app/(public)/country/[countryCode]/page.tsx` | KPIs pays (public) |
| Continental Stats | `apps/web/src/components/landing/ContinentalStats.tsx` | Stats continentales |
| Domain Statistics | `apps/web/src/components/domain/DomainStatisticsSection.tsx` | Section stats par domaine |
| Dashboard Synthetic | `apps/web/src/components/dashboard/DashboardSynthetic.tsx` | Synthese dashboard |

### 5.2 Composants UI reutilisables

| Composant | Fichier | Description |
|-----------|---------|-------------|
| QualityIndicator | `packages/ui-components/src/components/QualityIndicator/` | Indicateur de qualite (jauge) |
| ConnectionIndicator | `apps/web/src/components/realtime/ConnectionIndicator.tsx` | Indicateur connexion (non KPI) |

### 5.3 Hooks frontend lies aux KPIs

| Hook | Fichier | Description |
|------|---------|-------------|
| `useKpiDefinitions` | `apps/web/src/lib/api/settings-hooks.ts` | CRUD definitions KPI |
| `useCreateKpiDefinition` | idem | Creation |
| `useUpdateKpiDefinition` | idem | Modification |
| `useDeleteKpiDefinition` | idem | Suppression |
| `useGovernanceKpis` | `apps/web/src/lib/api/hooks.ts` | KPIs governance (fallback hardcode) |
| `usePvsEvaluations` | `apps/web/src/lib/api/hooks.ts` | Evaluations PVS |

---

## 6. Formules existantes

### 6.1 Aucun moteur de formules declaratif

Il n'existe **aucun concept de formule stockee en base** ou de moteur d'evaluation d'expressions. Les "calculs" sont :

1. **Seuils statiques** : `KpiDefinition.thresholdGood` et `thresholdWarn` definissent des zones vert/orange/rouge, mais ne calculent pas de valeur.

2. **Source config** (StatisticDefinition) : Le champ `sourceConfig` (JSON) supporte theoriquement `{ templateId, fieldCode, aggregation: "count"|"sum"|"avg" }`, mais **la logique d'evaluation automatique n'est pas implementee**. Les valeurs sont saisies manuellement.

3. **Score composite de risque** : Dans `services/analytics/src/services/cross-domain.service.ts`, un score composite est calcule avec des poids codes en dur. Ce n'est pas parametre.

4. **KPI `source` field** : `CountryKpiScore.source` accepte `"manual"` ou `"computed"`, mais aucun mecanisme automatique ne renseigne les valeurs `"computed"`.

### 6.2 Implication pour le Chantier C

Pour introduire des indicateurs composites avec formules parametrables, il faudra :
- Ajouter un champ `formula` (expression ou JSON) a `KpiDefinition` ou un nouveau modele
- Creer un moteur d'evaluation (safe expression evaluator, pas `eval()`)
- Definir les variables disponibles (autres KPIs, statistiques, metriques)
- Gerer le recalcul (event-driven via Kafka ou batch)

---

## Resume

| Aspect | Etat actuel |
|--------|-------------|
| Modele de donnees | 3 systemes disjoints (KpiDefinition, StatisticDefinition, AggregateMetric) |
| Types | Pas d'enum formel, distinction implicite |
| Formules | Aucun moteur declaratif, tout est code en dur |
| Volume | ~6 presets, 3 seeds PVS, potentiel ~1000 scores en prod |
| Backend | 2 services (tenant/settings, governance), routes CRUD completes |
| Frontend | ~12 pages/composants lies, hooks React Query |
| Problemes | Pas de composabilite, pas de formules, 3 systemes non unifies |
