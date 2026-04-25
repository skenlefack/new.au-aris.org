# Chantier C -- Inventaire complet des mentions PVS

> Rapport produit le 2026-04-25 -- lecture seule, aucune modification du code.
> Format : `fichier:ligne` | contexte | suggestion de remplacement

---

## 1. Schemas Prisma (modele de donnees)

### 1.1 Schema governance (packages)

`packages/db-schemas/prisma/governance.prisma:35` | `pvsSelfAssessmentScore Float? @map("pvs_self_assessment_score")` | Renommer en `vetServicesSelfAssessmentScore` / `vet_services_self_assessment_score`

`packages/db-schemas/prisma/governance.prisma:50` | `model PVSEvaluation {` | Renommer en `VeterinaryServicesEvaluation`

`packages/db-schemas/prisma/governance.prisma:67` | `@@map("pvs_evaluations")` | Migration SQL : renommer table en `veterinary_services_evaluations`

### 1.2 Schema animal-health (packages)

`packages/db-schemas/prisma/animal-health.prisma:1422` | `pvsScore Float? @map("pvs_score")` | Renommer en `vetServicesScore` / `vet_services_score`

### 1.3 Schema governance (service local)

`services/governance/prisma/schema.prisma:39` | `pvsSelfAssessmentScore Float? @map("pvs_self_assessment_score")` | Idem 1.1

`services/governance/prisma/schema.prisma:53` | `model PVSEvaluation {` | Idem 1.1

`services/governance/prisma/schema.prisma:70` | `@@map("pvs_evaluations")` | Idem 1.1

---

## 2. Services Backend

### 2.1 Governance service

`services/governance/src/services/pvs-evaluation.service.ts:14` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED` import | Renommer le topic

`services/governance/src/services/pvs-evaluation.service.ts:15` | `TOPIC_MS_GOVERNANCE_PVS_UPDATED` import | Renommer le topic

`services/governance/src/services/pvs-evaluation.service.ts:73` | `this.audit.log('PVSEvaluation', ...)` | `'VeterinaryServicesEvaluation'`

`services/governance/src/services/pvs-evaluation.service.ts:77` | `await this.publishEvent(TOPIC_MS_GOVERNANCE_PVS_EVALUATED, ...)` | Utiliser nouveau topic

`services/governance/src/services/pvs-evaluation.service.ts:111` | `throw new HttpError(404, 'PVS evaluation ${id} not found')` | `'Veterinary services evaluation ...'`

`services/governance/src/services/pvs-evaluation.service.ts:122` | `throw new HttpError(404, 'PVS evaluation ${id} not found')` | Idem

`services/governance/src/services/pvs-evaluation.service.ts:142` | `'PVSEvaluation'` (audit) | `'VeterinaryServicesEvaluation'`

`services/governance/src/services/pvs-evaluation.service.ts:150` | `TOPIC_MS_GOVERNANCE_PVS_UPDATED` | Utiliser nouveau topic

**Fichier entier a renommer** : `pvs-evaluation.service.ts` -> `veterinary-services-evaluation.service.ts`

`services/governance/src/services/capacity.service.ts:29` | `pvsSelfAssessmentScore?: number;` | `vetServicesAssessmentScore`

`services/governance/src/services/capacity.service.ts:39` | `pvsSelfAssessmentScore?: number;` | Idem

`services/governance/src/services/capacity.service.ts:82` | `pvsSelfAssessmentScore: dto.pvsSelfAssessmentScore ?? null` | Idem

`services/governance/src/services/capacity.service.ts:151` | `if (dto.pvsSelfAssessmentScore !== undefined) ...` | Idem

`services/governance/src/schemas/pvs-evaluation.schema.ts:3` | `PVSEvaluationTypeEnum` | `VetServicesEvaluationTypeEnum`

`services/governance/src/schemas/pvs-evaluation.schema.ts:4` | `Type.Literal('PVS')` | `Type.Literal('INITIAL')` (valeur semantique sans PVS)

`services/governance/src/schemas/pvs-evaluation.schema.ts:5` | `Type.Literal('PVS_GAP')` | `Type.Literal('GAP_ANALYSIS')`

`services/governance/src/schemas/pvs-evaluation.schema.ts:6` | `Type.Literal('PVS_FOLLOW_UP')` | `Type.Literal('FOLLOW_UP')`

`services/governance/src/schemas/pvs-evaluation.schema.ts:17` | `evaluationType: PVSEvaluationTypeEnum` | Idem

`services/governance/src/schemas/pvs-evaluation.schema.ts:26` | `evaluationType: Type.Optional(PVSEvaluationTypeEnum)` | Idem

**Fichier entier a renommer** : `pvs-evaluation.schema.ts` -> `veterinary-services-evaluation.schema.ts`

`services/governance/src/schemas/capacity.schema.ts:15` | `pvsSelfAssessmentScore: Type.Optional(...)` | `vetServicesAssessmentScore`

`services/governance/src/schemas/capacity.schema.ts:25` | `pvsSelfAssessmentScore: Type.Optional(...)` | Idem

`services/governance/src/routes/pvs-evaluation.routes.ts:18` | `const PREFIX = '/api/v1/governance/pvs-evaluations'` | `/api/v1/governance/vet-evaluations`

`services/governance/src/routes/pvs-evaluation.routes.ts:30` | `// POST ... create PVS evaluation` | Supprimer mention PVS du commentaire

`services/governance/src/routes/pvs-evaluation.routes.ts:36` | `app.pvsEvaluationService.create(...)` | `app.vetEvaluationService.create(...)`

`services/governance/src/routes/pvs-evaluation.routes.ts:40` | `// GET ... list PVS evaluations` | Supprimer mention PVS

`services/governance/src/routes/pvs-evaluation.routes.ts:57` | `app.pvsEvaluationService.findAll(...)` | Idem

`services/governance/src/routes/pvs-evaluation.routes.ts:60` | `// GET ... get PVS evaluation by ID` | Supprimer mention PVS

`services/governance/src/routes/pvs-evaluation.routes.ts:66` | `app.pvsEvaluationService.findOne(...)` | Idem

`services/governance/src/routes/pvs-evaluation.routes.ts:69` | `// PATCH ... update PVS evaluation` | Supprimer mention PVS

`services/governance/src/routes/pvs-evaluation.routes.ts:75` | `app.pvsEvaluationService.update(...)` | Idem

**Fichier entier a renommer** : `pvs-evaluation.routes.ts` -> `veterinary-services-evaluation.routes.ts`

`services/governance/src/kafka-topics.ts:13` | `// PVS evaluation` | Supprimer mention PVS

`services/governance/src/kafka-topics.ts:14` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED = 'ms.governance.pvs.evaluated.v1'` | `TOPIC_MS_GOVERNANCE_VET_EVALUATION_CREATED = 'ms.governance.vet-evaluation.created.v1'`

`services/governance/src/kafka-topics.ts:15` | `TOPIC_MS_GOVERNANCE_PVS_UPDATED = 'ms.governance.pvs.updated.v1'` | `TOPIC_MS_GOVERNANCE_VET_EVALUATION_UPDATED = 'ms.governance.vet-evaluation.updated.v1'`

`services/governance/src/app.ts:10` | `import { PvsEvaluationService } from './services/pvs-evaluation.service.js'` | Renommer import

`services/governance/src/app.ts:15` | `import { registerPvsEvaluationRoutes } from './routes/pvs-evaluation.routes.js'` | Renommer import

`services/governance/src/app.ts:89` | `const pvsEvaluationService = new PvsEvaluationService(prisma, kafka)` | `const vetEvaluationService = ...`

`services/governance/src/app.ts:94` | `app.decorate('pvsEvaluationService', pvsEvaluationService)` | `app.decorate('vetEvaluationService', ...)`

`services/governance/src/types/fastify.d.ts:6` | `import type { PvsEvaluationService } from '../services/pvs-evaluation.service'` | Renommer

`services/governance/src/types/fastify.d.ts:16` | `pvsEvaluationService: PvsEvaluationService` | `vetEvaluationService: VetEvaluationService`

`services/governance/src/seed.ts:50-54` | `pvsSelfAssessmentScore: 68.0` (et variantes) | `vetServicesAssessmentScore`

`services/governance/src/seed.ts:68` | `pvsSelfAssessmentScore: cap.pvsSelfAssessmentScore` | Idem

`services/governance/src/seed.ts:78` | `// PVS Evaluations (3)` | `// Veterinary Services Evaluations (3)`

`services/governance/src/seed.ts:79` | `console.log('  ... PVS evaluations...')` | Supprimer mention PVS

`services/governance/src/seed.ts:81` | `const pvsEvals = [` | `const vetEvals = [`

`services/governance/src/seed.ts:84` | `evaluationType: 'PVS'` | `evaluationType: 'INITIAL'`

`services/governance/src/seed.ts:104` | `evaluationType: 'PVS_GAP_ANALYSIS'` | `evaluationType: 'GAP_ANALYSIS'`

`services/governance/src/seed.ts:122` | `evaluationType: 'PVS_FOLLOW_UP'` | `evaluationType: 'FOLLOW_UP'`

`services/governance/src/seed.ts:141-159` | variables `pvs`, `pvsEvals` | Renommer en `vetEval`, `vetEvals`

`services/governance/src/seed.ts:159` | `console.log('... PVS evaluations')` | Supprimer mention PVS

### 2.2 Animal Health service

`services/animal-health/src/schemas/capacity.schema.ts:9` | `pvsScore: Type.Optional(Type.Number(...))` | `vetServicesScore`

`services/animal-health/src/schemas/capacity.schema.ts:18` | `pvsScore: Type.Optional(Type.Number(...))` | Idem

`services/animal-health/src/services/capacity.service.ts:44` | `pvsScore: dto.pvsScore ?? null` | `vetServicesScore`

`services/animal-health/src/services/capacity.service.ts:111` | `if (dto.pvsScore !== undefined) updateData['pvsScore'] = dto.pvsScore` | Idem

`services/animal-health/src/seed.ts:284` | `pvsScore: 68.0` | `vetServicesScore: 68.0`

`services/animal-health/src/seed.ts:285` | `pvsScore: 72.0` | `vetServicesScore: 72.0`

`services/animal-health/src/seed.ts:299` | `pvsScore: sv.pvsScore` | `vetServicesScore: sv.vetServicesScore`

### 2.3 Analytics service

`services/analytics/src/dto/cross-domain.dto.ts:11` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED = 'ms.governance.pvs.evaluated.v1'` | Aligner sur nouveau topic

`services/analytics/src/dto/cross-domain.dto.ts:122` | `compositeScore: number` | OK (pas PVS)

`services/analytics/src/services/cross-domain.service.ts:248` | `// Governance (inverse: higher PVS = lower risk)` | Supprimer mention PVS du commentaire

`services/analytics/src/services/cross-domain.service.ts:359` | `const pvsScore = parseFloat(...)` | `const vetScore = ...`

`services/analytics/src/services/cross-domain.service.ts:362` | `// Inverse: high PVS = low risk. PVS scale is roughly 0-100.` | Supprimer mentions PVS

`services/analytics/src/services/cross-domain.service.ts:363` | `const score = pvsScore > 0 ? ...` | Renommer variable

`services/analytics/src/services/cross-domain.service.ts:364` | `factors.push('PVS score: ${pvsScore}')` | `'Vet services score: ${vetScore}'`

`services/analytics/src/services/cross-domain.service.ts:365` | `factors.push('No PVS data')` | `'No vet services data'`

`services/analytics/src/services/cross-domain.service.ts:818` | `{ key: 'avg_pvs_score', label: 'Avg PVS Score', ...}` | `'avg_vet_score'`, `'Avg Vet Services Score'`

`services/analytics/src/services/db-stats.service.ts:60` | `(SELECT COUNT(*) FROM governance.pvs_evaluations)::int AS pvs_eval` | Aligner sur nouveau nom de table

`services/analytics/src/services/db-stats.service.ts:134` | `counts.pvs_eval` | Aligner sur nouveau nom

`services/analytics/src/routes/analytics.routes.ts:275` | `// Governance PVS Scores` | Supprimer mention PVS

`services/analytics/src/routes/analytics.routes.ts:277` | `app.get('${PREFIX}/governance/pvs-scores', ...)` | `/governance/vet-scores`

`services/analytics/src/consumers/consumer-registry.ts:13` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED` import | Utiliser nouveau topic

`services/analytics/src/consumers/consumer-registry.ts:201` | `// Governance PVS Evaluated` | Supprimer mention PVS

`services/analytics/src/consumers/consumer-registry.ts:204` | `topic: TOPIC_MS_GOVERNANCE_PVS_EVALUATED` | Utiliser nouveau topic

`services/analytics/src/consumers/consumer-registry.ts:209` | log `TOPIC_MS_GOVERNANCE_PVS_EVALUATED` | Idem

`services/analytics/src/consumers/consumer-registry.ts:211` | log `TOPIC_MS_GOVERNANCE_PVS_EVALUATED` | Idem

---

## 3. Packages partages

### 3.1 Kafka Client

`packages/kafka-client/src/events/event-catalog.ts:145` | `PVS_EVALUATION_CREATED: 'ms.governance.pvs-evaluation.created.v1'` | `VET_EVALUATION_CREATED: 'ms.governance.vet-evaluation.created.v1'`

### 3.2 Auth Middleware

`packages/auth-middleware/src/__tests__/domain-guard.spec.ts:145` | `'governance/pvs-scores': 'governance'` | `'governance/vet-scores': 'governance'`

### 3.3 i18n Translations

`packages/i18n/src/translations/en.json:449` | `"pvsPathway": "PVS pathway"` | `"vetServicesPathway": "Veterinary services pathway"` (cle + valeur)

`packages/i18n/src/translations/fr.json:635` | `"pvs": "PVS"` | Supprimer ou remplacer par `"vetServices": "Services veterinaires"`

`packages/i18n/src/translations/fr.json:636` | `"pvsEvaluation": "Evaluation PVS"` | `"vetEvaluation": "Evaluation des services veterinaires"`

`packages/i18n/src/translations/fr.json:637` | `"pvsPathway": "Processus PVS"` | `"vetServicesPathway": "Processus d'evaluation des services veterinaires"`

`packages/i18n/src/translations/pt.json:449` | `"pvsPathway": "Percurso PVS"` | `"vetServicesPathway": "Percurso de avaliacao dos servicos veterinarios"`

`packages/i18n/src/translations/es.json:449` | `"pvsPathway": "Proceso PVS"` | `"vetServicesPathway": "Proceso de evaluacion de servicios veterinarios"`

`packages/i18n/src/translations/ar.json:449` | `"pvsPathway": "مسار PVS"` | `"vetServicesPathway": "مسار تقييم الخدمات البيطرية"`

### 3.4 DB Schemas Seeds

`packages/db-schemas/prisma/seed-settings.ts:1316` | `'...PVS metrics...'` (en) | `'...veterinary services metrics...'`

`packages/db-schemas/prisma/seed-settings.ts:1317` | `'...indicateurs PVS...'` (fr) | `'...indicateurs des services veterinaires...'`

`packages/db-schemas/prisma/seed-settings.ts:1318` | `'...metricas PVS...'` (pt) | `'...metricas de servicos veterinarios...'`

`packages/db-schemas/prisma/seed-roles.ts:506` | `{ module: 'governance', feature: 'pvs', actions: ACTIONS_FULL }` | `feature: 'vet-evaluations'`

---

## 4. Frontend (apps/web)

### 4.1 Pages

`apps/web/src/app/(dashboard)/governance/pvs/page.tsx` | **Page entiere** dediee aux evaluations PVS | Renommer fichier et route en `/governance/vet-evaluations/`

`apps/web/src/app/(dashboard)/governance/pvs/page.tsx:28` | `function PvsPage()` | `function VetEvaluationsPage()`

`apps/web/src/app/(dashboard)/governance/pvs/page.tsx:41` | `{t('pvs')}` et `{t('pvsDesc')}` | Utiliser nouvelles cles i18n

`apps/web/src/app/(dashboard)/governance/pvs/page.tsx:43` | `returnTo=/governance/pvs` | `returnTo=/governance/vet-evaluations`

`apps/web/src/app/(dashboard)/governance/pvs/page.tsx:51` | `returnTo=/governance/pvs` | Idem

`apps/web/src/app/(dashboard)/governance/PvsScoresChart.tsx` | **Fichier entier** | Renommer en `VetScoresChart.tsx`

`apps/web/src/app/(dashboard)/governance/PvsScoresChart.tsx:13` | `interface PvsScoresChartProps` | `VetScoresChartProps`

`apps/web/src/app/(dashboard)/governance/PvsScoresChart.tsx:17` | `function PvsScoresChart` | `function VetScoresChart`

`apps/web/src/app/(dashboard)/governance/page.tsx:62` | `href: '/governance/pvs', label: t('pvs'), desc: t('pvsDesc')` | `href: '/governance/vet-evaluations'` + nouvelles cles

`apps/web/src/app/(dashboard)/governance/page.tsx:139` | `'PVS Evaluation Report': '#1565C0'` | `'Veterinary Services Evaluation Report': '#1565C0'`

`apps/web/src/app/(dashboard)/governance/capacity/page.tsx:54` | `const pvs = d.pvs_score ? Number(d.pvs_score) : 0` | `const vetScore = ...`

`apps/web/src/app/(dashboard)/governance/capacity/page.tsx:61` | `{pvs > 0 && <span ...>{pvs.toFixed(1)}</span>}` | Renommer variable

### 4.2 Hooks API

`apps/web/src/lib/api/hooks.ts:3667` | `pvsEvaluations: number` | `vetEvaluations: number`

`apps/web/src/lib/api/hooks.ts:3727` | `pvsSelfAssessmentScore: number` | `vetServicesAssessmentScore: number`

`apps/web/src/lib/api/hooks.ts:3736` | `pvsEvaluations: 0` (fallback) | `vetEvaluations: 0`

`apps/web/src/lib/api/hooks.ts:3794` | `queryKey: ['governance', 'pvs-evaluations', params]` | `['governance', 'vet-evaluations', ...]`

`apps/web/src/lib/api/hooks.ts:3798` | `'/governance/pvs-evaluations'` | `'/governance/vet-evaluations'`

### 4.3 Data / Landing

`apps/web/src/data/country-domain-stats.ts:154` | `detail: 'PVS evaluation -- ...'` | `'Veterinary services evaluation -- ...'`

`apps/web/src/components/landing/ContinentalStats.tsx:17` | `'...PVS metrics...'` (en, fr, pt dans description) | `'...veterinary services metrics...'` (3 langues)

### 4.4 Messages / Traductions (i18n web)

**Anglais** (`apps/web/src/messages/en.json`) :
- `:2469` | `"subtitle": "...PVS metrics..."` | `"...veterinary services metrics..."`
- `:2472` | `"pvs": "PVS Evaluations"` | `"vetEvaluations": "Veterinary Services Evaluations"`
- `:2473` | `"pvsDesc": "OIE Performance of Veterinary Services pathway evaluations..."` | `"vetEvaluationsDesc": "OMSA veterinary services pathway evaluations..."`
- `:2477` | `"capacityDesc": "...PVS self-assessment scores"` | `"...veterinary services self-assessment scores"`
- `:2479` | `"searchEvaluations": "Search PVS evaluations..."` | `"Search veterinary evaluations..."`
- `:2517` | `"pvsScore": "PVS Score"` | `"vetScore": "Veterinary Score"`
- `:2520` | `"noEvaluationsFound": "No PVS evaluations found"` | `"No veterinary evaluations found"`

**Francais** (`apps/web/src/messages/fr.json`) :
- `:2464` | `"subtitle": "...metriques PVS..."` | `"...metriques des services veterinaires..."`
- `:2467` | `"pvs": "Evaluations PVS"` | `"vetEvaluations": "Evaluations des services veterinaires"`
- `:2468` | `"pvsDesc": "Evaluations du parcours PVS de l'OIE..."` | `"...du parcours d'evaluation des services veterinaires de l'OMSA..."`
- `:2472` | `"capacityDesc": "...scores d'auto-evaluation PVS"` | `"...scores d'auto-evaluation des services veterinaires"`
- `:2474` | `"searchEvaluations": "Rechercher des evaluations PVS..."` | `"Rechercher des evaluations des services veterinaires..."`
- `:2512` | `"pvsScore": "Score PVS"` | `"vetScore": "Score des services veterinaires"`
- `:2515` | `"noEvaluationsFound": "Aucune evaluation PVS trouvee"` | `"Aucune evaluation des services veterinaires trouvee"`

**Portugais** (`apps/web/src/messages/pt.json`) :
- `:2346` | `"subtitle": "...metricas PVS..."` | `"...metricas de servicos veterinarios..."`
- `:2349` | `"pvs": "Avaliacoes PVS"` | Renommer cle + valeur
- `:2350` | `"pvsDesc": "Avaliacoes do percurso PVS da OIE..."` | Supprimer mention PVS/OIE
- `:2354` | `"capacityDesc": "...pontuacoes de auto-avaliacao PVS"` | Supprimer mention PVS
- `:2356` | `"searchEvaluations": "Pesquisar avaliacoes PVS..."` | Supprimer mention PVS
- `:2394` | `"pvsScore": "Pontuacao PVS"` | Renommer
- `:2397` | `"noEvaluationsFound": "Nenhuma avaliacao PVS encontrada"` | Supprimer mention PVS

**Espagnol** (`apps/web/src/messages/es.json`) :
- `:2346` | `"subtitle": "...metricas PVS..."` | Supprimer mention PVS
- `:2349` | `"pvs": "Evaluaciones PVS"` | Renommer cle + valeur
- `:2350` | `"pvsDesc": "Evaluaciones del camino PVS de la OIE..."` | Supprimer PVS/OIE
- `:2354` | `"capacityDesc": "...puntuaciones de auto-evaluacion PVS"` | Supprimer PVS
- `:2356` | `"searchEvaluations": "Buscar evaluaciones PVS..."` | Supprimer PVS
- `:2394` | `"pvsScore": "Puntuacion PVS"` | Renommer
- `:2397` | `"noEvaluationsFound": "No se encontraron evaluaciones PVS"` | Supprimer PVS

**Arabe** (`apps/web/src/messages/ar.json`) :
- `:2346` | `"subtitle": "...مقاييس PVS..."` | Supprimer PVS
- `:2349` | `"pvs": "تقييمات PVS"` | Renommer
- `:2350` | `"pvsDesc": "تقييمات مسار PVS..."` | Supprimer PVS
- `:2354` | `"capacityDesc": "...درجات التقييم الذاتي PVS"` | Supprimer PVS
- `:2356` | `"searchEvaluations": "بحث في تقييمات PVS..."` | Supprimer PVS
- `:2394` | `"pvsScore": "درجة PVS"` | Renommer
- `:2397` | `"noEvaluationsFound": "لم يتم العثور على تقييمات PVS"` | Supprimer PVS

---

## 5. Apps Admin

`apps/admin/src/app/(admin)/bulk-import/page.tsx:43` | `'pVSEvaluation'` dans le mapping governance | `'vetEvaluation'`

`apps/admin/src/app/(admin)/bulk-export/page.tsx:35` | `'pVSEvaluation'` dans le mapping governance | `'vetEvaluation'`

`apps/admin/src/app/(admin)/audit/page.tsx:63` | `'pvs_evaluation'` dans la liste des entity types | `'vet_evaluation'`

---

## 6. Tests

`services/governance/src/__tests__/governance.spec.ts:6` | `import { PvsEvaluationService, HttpError as PvsHttpError }` | Renommer imports

`services/governance/src/__tests__/governance.spec.ts:13` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED` import | Utiliser nouveau topic

`services/governance/src/__tests__/governance.spec.ts:253` | `pvsSelfAssessmentScore: 3.2` | Renommer

`services/governance/src/__tests__/governance.spec.ts:268` | `pvsSelfAssessmentScore: 3.2` | Idem

`services/governance/src/__tests__/governance.spec.ts:344` | `'create -- creates PVS evaluation ...'` | Supprimer mention PVS dans le titre du test

`services/governance/src/__tests__/governance.spec.ts:346` | `id: 'pvs-001'` | Renommer

`services/governance/src/__tests__/governance.spec.ts:347` | `evaluationType: 'PVS'` | `'INITIAL'`

`services/governance/src/__tests__/governance.spec.ts:361` | `evaluationType: 'PVS'` | Idem

`services/governance/src/__tests__/governance.spec.ts:377` | `evaluationType: 'PVS'` | Idem

`services/governance/src/__tests__/governance.spec.ts:383-385` | `TOPIC_MS_GOVERNANCE_PVS_EVALUATED`, `'pvs-001'` | Renommer

`services/governance/src/__tests__/governance.spec.ts:390` | `'findAll -- lists PVS evaluations ...'` | Supprimer mention PVS

`services/governance/src/__tests__/governance.spec.ts:393` | `id: 'pvs-001'` | Renommer

`services/governance/src/__tests__/governance.spec.ts:394` | `evaluationType: 'PVS'` | `'INITIAL'`

`services/animal-health/src/__tests__/remaining-services.spec.ts:83` | `pvsScore: 3.5` | `vetServicesScore: 3.5`

`services/analytics/src/__tests__/analytics.service.spec.ts:399` | `// Governance PVS (high score = low risk)` | Supprimer mention PVS

---

## 7. Documentation

`docs/api/ROUTES.md:469-472` | 4 routes `/api/v1/governance/pvs-evaluations` | Renommer en `/vet-evaluations`

`docs/api/ROUTES.md:521` | `/analytics/governance/pvs-scores` | `/analytics/governance/vet-scores`

`docs/architecture/OVERVIEW.md:135` | `PVS metrics` | `veterinary services metrics`

`docs/architecture/OVERVIEW.md:218` | `PVS metrics` | Idem

`docs/architecture/DEPLOYMENT.md:592` | `PVS` dans description governance | Supprimer mention

`docs/architecture/DATA-MODEL.md:1142` | `float pvsScore "nullable, OIE PVS score"` | Renommer

`docs/ARIS4_Rapport_Traitement_Donnees_Historiques.md:350` | `PVS` dans la liste des templates governance | Renommer

`services/governance/README.md:5` | `PVS evaluations` | `veterinary services evaluations`

`services/governance/README.md:29-32` | 4 routes `/governance/pvs-evaluations` | Renommer

`services/governance/README.md:45-46` | Topics Kafka `ms.governance.pvs.*` | Renommer

`services/governance/README.md:64` | `PVSEvaluation | PARTNER` | `VeterinaryServicesEvaluation`

`services/governance/package.json:5` | `"description": "...PVS evaluations..."` | Supprimer mention PVS

`services/analytics/README.md:30` | `/api/v1/analytics/governance/pvs-scores` | Renommer

`services/analytics/README.md:53` | `ms.governance.pvs.evaluated.v1` | Renommer

`services/CLAUDE-CC4.md:106` | `pvsScore?: number` | `vetServicesScore?: number`

---

## 8. Configuration et projet

`CLAUDE.md:10` | `PVS metrics` | `veterinary services metrics`

`CLAUDE.md:100` | `PVS` dans description governance | Supprimer

`README.md:35` | `PVS metrics` | `veterinary services metrics`

`README.md:195` | `PVS metrics` | Idem

`CHANGELOG.md:81` | `PVS scores` | `veterinary services scores`

`scripts/db-seed-all.ts:118` | `'Legal frameworks, capacities, PVS, stakeholders'` | Supprimer mention PVS

---

## 9. Deploy scripts

`deploy/scripts/_create_governance_templates.py:105` | `"name": "PVS Evaluation Report"` | `"Veterinary Services Evaluation Report"`

`deploy/scripts/_create_governance_templates.py:113` | `"label": {"en": "Initial PVS"}` | `"Initial Evaluation"`

`deploy/scripts/_create_governance_templates.py:114` | `"label": {"en": "Follow-up PVS"}` | `"Follow-up Evaluation"`

`deploy/scripts/_create_governance_templates.py:116` | `"label": {"en": "PVS Pathway"}` | `"Veterinary Services Pathway"`

`deploy/vm_audit_report.json:56,139,222,305` | `"pvs": "No PVS"` | **CONSERVER** -- c'est la commande Linux `pvs` (Physical Volume Scan, LVM), pas lie a l'OIE/OMSA

`deploy/audit_vms.py:70` | `"pvs": "sudo pvs --noheadings ..."` | **CONSERVER** -- commande systeme LVM `pvs`

---

## 10. Donnees historiques

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:24906` | `"name": "PVS Evaluation Report"` | `"Veterinary Services Evaluation Report"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25003` | `"en": "Initial PVS"` | `"Initial Evaluation"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25009` | `"en": "Follow-up PVS"` | `"Follow-up Evaluation"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25021` | `"en": "PVS Pathway"` | `"Veterinary Services Pathway"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25039` | `"en": "PVS Scores (1-5)"` | `"Veterinary Services Scores (1-5)"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25040` | `"fr": "Scores PVS (1-5)"` | `"Scores des services veterinaires (1-5)"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25676-25677` | `"id": "pvs_score", "code": "pvs_score"` | `"vet_score"` / `"vet_score"`

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25680-25681` | `"en": "PVS Score"`, `"fr": "Score PVS"` | Supprimer mentions PVS

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25869-25870` | `"en": "PVS Gap Identified"`, `"fr": "Lacune PVS identifiee"` | Supprimer PVS

`DONNEES-HISTORIQUES-ARIS/templates/_raw_templates.json:25872` | `"value": "pvs_gap"` | `"vet_gap"`

---

## 11. Fichiers a EXCLURE (faux positifs)

| Fichier | Raison |
|---------|--------|
| `deploy/audit_vms.py:70` | Commande Linux `pvs` (LVM Physical Volume Scan) |
| `deploy/vm_audit_report.json:56,139,222,305` | Output de la commande Linux `pvs` |
| `node_modules/**` | Genere automatiquement, ne pas modifier |
| `prompts/1/*.md` | Documents de specification du chantier, references internes OK |

---

## Resume quantitatif

| Categorie | Nombre d'occurrences |
|-----------|---------------------|
| Schemas Prisma | 7 |
| Services backend | ~45 |
| Packages partages | ~12 |
| Frontend pages/composants | ~20 |
| Traductions web (5 langues) | ~35 |
| Traductions i18n (5 langues) | ~8 |
| Apps admin | 3 |
| Tests | ~15 |
| Documentation | ~15 |
| Seeds / deploy scripts | ~15 |
| Donnees historiques | ~10 |
| **TOTAL (hors faux positifs et node_modules)** | **~185** |
| Fichiers a renommer (pas seulement contenu) | 3 (pvs-evaluation.service.ts, pvs-evaluation.schema.ts, pvs-evaluation.routes.ts) |
| Dossiers a renommer | 1 (`apps/web/src/app/(dashboard)/governance/pvs/` -> `vet-evaluations/`) |
| Routes API a migrer | 5 (4 governance + 1 analytics) |
| Topics Kafka a migrer | 3 (2 governance + 1 event-catalog) |
