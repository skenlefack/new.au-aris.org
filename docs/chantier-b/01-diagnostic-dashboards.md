# Chantier B.1 -- Diagnostic DashboardBuilder

Date: 2026-04-25

---

## 1. Module dashboard custom existant ?

**Pas de module DashboardBuilder generique.** Aucun systeme de dashboards personnalisables par l'utilisateur n'existe.

Fichiers lies au concept "dashboard" trouves :

| Fichier | Description |
|---------|-------------|
| `services/analytics/src/services/db-stats.service.ts` | KPIs live (counts SQL cross-domain) caches Redis 2 min. Interface `DashboardDbStats` |
| `services/analytics/src/routes/analytics.routes.ts` | Routes `/stats`, expose les KPIs continentaux |
| `services/data-sharing/src/services/dashboard.service.ts` | Dashboard specifique Data Sharing (stats accords par statut/domaine) |
| `services/data-sharing/src/routes/dashboard.routes.ts` | Route `/dashboard` pour data-sharing uniquement |
| `services/tenant/src/seed-kpis.ts` | Seeds de presets KPI CAADEP (vaccination, census, trade, fisheries, governance) |
| `apps/web/src/components/domain/CampaignDataDashboard.tsx` | Composant React affichant Map + Stats + Courbe par domaine |
| `tests/e2e/pages/dashboard.page.ts` | Page object E2E pour la page dashboard |

**Conclusion** : Chaque page domaine construit ses propres KPIs en dur (hardcoded). Pas de grille configurable, pas de persistance de layout, pas de partage.

---

## 2. Services exposant des KPIs / metriques

| Service | Fichier(s) | Type de metriques |
|---------|-----------|-------------------|
| **analytics** | `indicators/indicator.service.ts` | CRUD complet IndicatorType + Indicator + IndicatorValue. Schema `analytics.*`. Formules composites (DAG). |
| **analytics** | `services/db-stats.service.ts` | Counts SQL live cross-domain (health_events, livestock_census, trade_flows, etc.) |
| **analytics** | `services/cross-domain.service.ts` | Agregations cross-domaines |
| **tenant** | `seed-kpis.ts` | 5+ presets KPI CAADEP (vaccination-coverage, disease-notification, livestock-census, trade-certification, fisheries-monitoring) |
| **data-sharing** | `services/dashboard.service.ts` | Stats accords: byStatus, byDomain, topOwners, expiringWithin30Days |
| **credential** | `services/session.service.ts` | Stats sessions utilisateur |
| **datalake** | `services/historical-data.service.ts` | Stats donnees historiques, time-series |

**Source principale pour le DashboardBuilder** : le service `analytics` avec son modele `Indicator` (schema Prisma `indicators.prisma`) qui supporte deja les modes MANUAL_ENTRY, AUTO_FROM_FORM, COMPOSITE_FORMULA.

---

## 3. Format actuel des pages domaine

Analyse de `apps/web/src/app/(dashboard)/animal-health/page.tsx` (pattern identique pour livestock, trade-sps, fisheries, governance) :

```
Structure type d'une page domaine :
1. Header (titre + boutons action)
2. KPI Cards (4 cards en grille 2x2 / 4x1) -- HARDCODED
3. Campaign Carousel (via CampaignCarousel composant)
4. CampaignDataDashboard (Map + Statistics + Courbe) -- composant partage
5. Table/Feed (events recents, records recents)
```

- Les sections sont controlees par `useDomainConfig('animal-health')` qui retourne `{ sections: { kpis, chart, map, statistics, curve, table } }`
- Les KPIs sont calcules inline a partir des donnees de campagne (`useCollectionCampaigns`)
- Pas de layout persistant, pas de configuration utilisateur
- Pas de grille drag-and-drop

---

## 4. Libraries drag-drop disponibles

**Deja installees dans `apps/web/package.json`** :

| Package | Version | Usage |
|---------|---------|-------|
| `@dnd-kit/core` | ^6.3.1 | Framework DnD principal |
| `@dnd-kit/sortable` | ^10.0.0 | Tri drag-and-drop |
| `@dnd-kit/utilities` | ^3.2.2 | Utilitaires DnD |
| `react-grid-layout` | ^2.2.2 | Grille redimensionnable avec drag-and-drop |
| `@types/react-grid-layout` | ^2.1.0 | Types TS |

**`react-grid-layout` est parfait pour le DashboardBuilder** -- il gere nativement la grille 12 colonnes, le resize, le drag-and-drop de widgets.

---

## 5. Librairie de graphiques

| Package | Version | Utilise dans |
|---------|---------|-------------|
| `recharts` | ^2.15.4 | `apps/web` et `apps/admin` |

**Recharts** est la seule lib de graphiques utilisee. Supporte : LineChart, BarChart, PieChart, AreaChart, ComposedChart, RadarChart, ScatterChart. Compatible avec tous les types de widgets prevus (LINE_CHART, BAR_CHART, PIE_CHART, STACKED_BAR, AREA_CHART, GAUGE via customisation).

---

## Resume & Recommandations

1. **Schema** : Creer `dashboard-builder.prisma` dans le schema `analytics` (meme schema que les indicateurs, couplage naturel)
2. **Grid** : `react-grid-layout` est deja installe -- utiliser `ResponsiveGridLayout` avec `cols=12`
3. **Charts** : `recharts` couvre tous les besoins (sauf MAP_AFRICA qui utilisera un composant geo custom)
4. **DnD** : `@dnd-kit` pour le drag de widgets depuis une palette vers la grille
5. **DataSource** : Les widgets INDICATOR se brancheront sur `analytics/indicators` API
6. **Migration** : Les pages domaine actuelles pourront etre converties en templates SYSTEM_TEMPLATE
