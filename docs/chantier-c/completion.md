# Chantier C — Module indicateurs refondu — Completion Report

## Livrables
- [x] Toutes les mentions PVS supprimees des UI utilisateur
- [x] Modele d'indicateurs refondu en place (indicators.prisma)
- [x] 6 types par defaut seedes (OMD, CAADP, IBAR, FAO, OMSA, CUSTOM)
- [x] Admin UI pour types et indicateurs operationnelle
- [x] Backend indicator-service avec CRUD complet (16 endpoints)
- [x] FormulaEvaluator avec mathjs sandbox et detection cycles
- [x] Auto-from-form alimente les indicateurs via Kafka
- [x] Composite recompute en cascade (max 5 niveaux)
- [x] Frontend admin avec pages types, liste, creation, edition, valeurs
- [x] Sidebar Settings integre
- [x] Vue materialisee BI creee
- [ ] Monitoring Grafana (Phase suivante)
- [ ] Tests E2E (Phase suivante)

## Fichiers cles

### Backend (services/analytics/src/indicators/)
| Fichier | Role |
|---------|------|
| `indicator.service.ts` | CRUD IndicatorType, Indicator, IndicatorValue, Formula + Kafka publish |
| `indicator.routes.ts` | 16 endpoints Fastify (types, indicators, values, formulas) |
| `indicator.schemas.ts` | Validation TypeBox (DTOs, enums, query params) |
| `formula-evaluator.ts` | Evaluation mathjs sandboxee, detection cycles DFS, cache Redis |
| `auto-from-form.consumer.ts` | Consumer Kafka `ms.collecte.form.submitted.v1` -> upsert valeurs |
| `composite-recompute.consumer.ts` | Consumer Kafka `sys.analytics.indicator.value-updated.v1` -> cascade |
| `index.ts` | Barrel exports |

### Frontend (apps/web/src/app/(dashboard)/settings/indicators/)
| Fichier | Role |
|---------|------|
| `page.tsx` | Liste des indicateurs avec filtres et recherche |
| `new/` | Creation d'indicateur |
| `[id]/` | Edition, valeurs, formule d'un indicateur |

### Schema & Seed
| Fichier | Role |
|---------|------|
| `packages/db-schemas/prisma/indicators.prisma` | Schema Prisma (5 modeles, 4 enums) |
| `packages/db-schemas/prisma/seed-indicator-types.ts` | Seed 6 types par defaut |
| `packages/db-schemas/prisma/migrations/mv_indicator_values_enriched.sql` | Vue materialisee BI |

### Kafka Topics (packages/shared-types/src/kafka/topic-names.ts)
| Topic | Usage |
|-------|-------|
| `sys.analytics.indicator.created.v1` | Publie a la creation d'un indicateur |
| `sys.analytics.indicator.updated.v1` | Publie a la mise a jour d'un indicateur |
| `sys.analytics.indicator.value-created.v1` | Publie a la creation d'une valeur |
| `sys.analytics.indicator.value-updated.v1` | Publie a la mise a jour d'une valeur (declencheur cascade) |
| `sys.analytics.indicator.compute-failed.v1` | Publie quand le calcul composite echoue |

## Architecture — Flux Kafka

```
ms.collecte.form.submitted.v1
        |
        v
  auto-from-form.consumer
  (cherche indicateurs AUTO_FROM_FORM)
  (aggrege: SUM/AVG/COUNT/MIN/MAX/LATEST)
  (upsert indicator_values)
        |
        v
sys.analytics.indicator.value-updated.v1
        |
        v
  composite-recompute.consumer
  (cherche formules dependantes via indicator_formula_dependencies)
  (evalue via FormulaEvaluator + mathjs)
  (upsert indicator_values)
        |
        v
sys.analytics.indicator.value-updated.v1  [depth + 1]
        |
        v
  ... cascade (max depth = 5) ...
```

### Protection anti-boucle
- Chaque event porte un champ `depth` (0 au depart)
- Le consumer composite incremente `depth` a chaque re-publication
- A `depth >= 5`, le consumer s'arrete et log un warning
- Le FormulaEvaluator detecte aussi les cycles dans le graphe de dependances (DFS)

### Vue materialisee BI
```sql
analytics.mv_indicator_values_enriched
  -- Jointure indicator_values + indicators + indicator_types
  -- Index unique sur id (pour REFRESH CONCURRENTLY)
  -- Index lookup sur (indicator_code, year, country_code)
  -- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_indicator_values_enriched;
```

## Prochaines etapes
1. **Monitoring Grafana** : dashboard pour suivre les metriques des consumers (latence, erreurs, nombre de recomputes)
2. **Tests E2E** : scenarios complets form submission -> auto-from-form -> composite cascade
3. **Refresh programmatique** de la vue materialisee (cron ou post-bulk-import)
