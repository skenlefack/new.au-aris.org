# Lot 0 — Diagnostic : Niveaux d'accès par domaine et sous-domaine

**Date :** 2026-09-25
**Auteur :** CC-5 (Frontend Web) + CC-1 (Platform Core)

---

## 1. Modélisation actuelle des domaines et sous-domaines

### 1.1 Stockage

| Entité | Table | Schéma | Service propriétaire | Fichier Prisma |
|--------|-------|--------|---------------------|----------------|
| Domain | `governance.domains` | settings | Config (settings) | `packages/db-schemas/prisma/settings.prisma` |
| SubDomain | `governance.sub_domains` | settings | Config (settings) | `packages/db-schemas/prisma/settings.prisma` |
| UserDomain | `credential.user_domains` | credential | Credential | `packages/db-schemas/prisma/credential.prisma` |
| CampaignDomainTarget | `public.campaign_domain_targets` | public | Collecte | `packages/db-schemas/prisma/collecte.prisma` |
| CampaignTarget | `public.campaign_targets` | public | Collecte | `packages/db-schemas/prisma/collecte.prisma` |

### 1.2 Codes des domaines (9)

Enum : `packages/shared-types/src/enums/domain-code.enum.ts`

| Code (kebab-case) | Libellé EN |
|-------------------|-----------|
| `governance` | Governance & Capacities |
| `animal-health` | Animal Health & One Health |
| `livestock-prod` | Production & Pastoralism |
| `trade-sps` | Trade, Markets & SPS |
| `fisheries` | Fisheries & Aquaculture |
| `wildlife` | Wildlife & Biodiversity |
| `apiculture` | Apiculture & Pollination |
| `climate-env` | Climate & Environment |
| `knowledge-hub` | Knowledge Management |

**Attention : double format.** Le code DB utilise `kebab-case` (`animal-health`), mais certains contextes (formulaires, campagnes legacy) utilisent `snake_case` (`animal_health`). Le filtrage `buildFilter()` normalise les deux via `expanded = userDomainCodes.flatMap(...)`.

### 1.3 Codes des sous-domaines (exemples)

Les sous-domaines sont stockés en DB avec un `code` UPPER_SNAKE_CASE et un `typeEnum` :

| Domaine | Sous-domaines | Type |
|---------|--------------|------|
| `livestock-prod` | DAIRY, RED_MEAT, POULTRY, PORK, SMALL_RUMINANTS, APICULTURE | VALUE_CHAIN |
| `governance` | CLINICS, SLAUGHTERHOUSES, LEGAL_FRAMEWORKS, VACCINATION, SURVEILLANCE, LABORATORIES | ORGANIZATIONAL |
| `animal-health` | PPR, AQUATIC_HEALTH, AMR | PATHOLOGY |
| `trade-sps` | DAIRY_TRADE, RED_MEAT_TRADE, POULTRY_TRADE, PORK_TRADE, SMALL_RUMINANTS_TRADE, FISHERIES_TRADE | VALUE_CHAIN |

### 1.4 Identification des noeuds (R2)

Le cahier des charges propose `ANIMAL_HEALTH` / `ANIMAL_HEALTH.LABORATORY`. En pratique :
- **Domaine** : code kebab-case → `animal-health`
- **Sous-domaine** : code snake_case du sous-domaine seul → `PPR`, `DAIRY`

**Mapping proposé pour `nodeCode` :**

| Noeud | nodeCode |
|-------|----------|
| Domaine | `animal-health` (le code tel quel) |
| Sous-domaine | `animal-health.PPR` (domainCode + "." + subDomainCode) |

Ce format composite est absent du code actuel mais ne crée aucun conflit. Les sous-domaines ont un `domainId` FK → la jointure est triviale.

### 1.5 Présence dans le JWT

```typescript
// JwtPayload.domains (packages/auth-middleware/src/interfaces/jwt-payload.interface.ts)
domains: Record<string, string[]>
// Exemple :
{
  "livestock-prod": ["DAIRY", "RED_MEAT"],
  "trade-sps": ["*"],         // wildcard = tous les sous-domaines
  "animal-health": ["*"]
}
```

Le JWT **ne contient pas** de niveaux d'accès. L'ajout d'un claim `accessVersion` (numéro de version) est envisagé pour détecter un contexte Redis périmé.

---

## 2. Filtrage actuel des campagnes par domaine

### 2.1 Points d'accès inventoriés (R7)

| # | Point d'accès | Fichier | Méthode de filtrage | Filtre domaine actuel |
|---|--------------|---------|--------------------|-----------------------|
| 1 | **Liste campagnes** | `services/collecte/src/services/campaign.service.ts:126` (`findAll`) | `buildFilter()` L309-405 | `WHERE domain IN (user domains)` |
| 2 | **Détail campagne** | `services/collecte/src/services/campaign.service.ts:163` (`findOne`) | `canAccessCampaign()` L409-438 | Vérifie tenant + pays ciblé, **pas** les domaines |
| 3 | **Liste soumissions** | `services/collecte/src/services/submission.service.ts:362` (`findAll`) | `buildFilter()` L879-928 | Filtre par `campaignId` ou par domaine (lookup IDs) |
| 4 | **Détail soumission** | `services/collecte/src/services/submission.service.ts` | Vérifie submitter/admin | Pas de filtre domaine direct |
| 5 | **Workflow campagnes** | `services/collecte/src/services/workflow-engine.service.ts:1739` | `buildFilter()` dupliqué | `WHERE domain IN (user domains)` |
| 6 | **Sync mobile (delta)** | `services/collecte/src/services/sync.service.ts` (`getServerUpdates`) | Retourne campagnes modifiées depuis `lastSyncAt` | **Aucun filtre domaine** — retourne tout |
| 7 | **Sync mobile (batch)** | `services/collecte/src/routes/sync.ts` (`POST /sync`) | Valide `campaignId` existe | Pas de filtre domaine |
| 8 | **Dashboard domain summary** | `services/analytics/src/domain-summary/domain-summary.service.ts` | SQL brut `WHERE c.domain = $1` | Paramètre fourni par le front, pas de guard serveur |
| 9 | **Dashboard KPIs** | `services/analytics/src/routes/analytics.routes.ts` | Filtre par domaine | Pas de filtre par niveaux |
| 10 | **Reports** | `services/analytics/src/reports/report.service.ts` | Templates + génération | Pas de filtre campagne/domaine |
| 11 | **Datalake ingestion** | `services/datalake/src/services/ingestion.service.ts` | Kafka → PG + OpenSearch | Pas de filtre — ingère tout |
| 12 | **Exports** | Via soumissions/analytics | Hérite du filtrage soumissions | Variable |
| 13 | **OpenSearch (Knowledge)** | `services/knowledge-hub/src/services/search.service.ts` | Index `aris-knowledge` | Pas de filtre campagne (publications only) |

### 2.2 Analyse de `buildFilter()` — campaign.service.ts L309-405

```
1. isAdmin = SUPER_ADMIN || CONTINENTAL_ADMIN  → bypass domaine
2. userDomainCodes = Object.keys(user.domains)
3. Si non-admin ET 0 domaines → WHERE id = UUID_IMPOSSIBLE (aucun résultat)
4. Si non-admin ET ≥1 domaine → WHERE domain IN (expanded codes)
5. Tenant isolation (CONTINENTAL voit tout, REC/MS filtré par pays ciblés)
6. Si query.domainCode → WHERE targets.some { domainCode }
7. Si query.subDomainCode → WHERE targets.some { subDomainCode }
```

**Constat critique :** le filtrage est uniquement sur le **domaine** (champ `domain`). Les sous-domaines ne sont jamais vérifiés dans `buildFilter()`. Un utilisateur avec `{ "livestock-prod": ["DAIRY"] }` voit toutes les campagnes `livestock-prod`, même celles ciblant uniquement `RED_MEAT`.

### 2.3 Détail campagne — `findOne()` L163

- Vérifie l'isolation tenant (pays ciblés)
- **Ne vérifie pas le domaine** — un utilisateur authentifié peut accéder au détail de n'importe quelle campagne dont le tenant correspond
- Retourne 404 si le tenant ne correspond pas (bon comportement, R4)

### 2.4 Sync mobile — `getServerUpdates()`

- Retourne les campagnes modifiées depuis `lastSyncAt`
- **Aucun filtre domaine ni sous-domaine** — potentielle fuite de données

---

## 3. Rôles administrateurs (R6)

### 3.1 Enum UserRole

`packages/shared-types/src/enums/user-role.enum.ts` — 13 rôles :

```typescript
SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN,
DATA_STEWARD, WAHIS_FOCAL_POINT, ANALYST, FIELD_AGENT,
KNOWLEDGE_MANAGER, NATIONAL_LABORATORY, REGIONAL_LABORATORY,
CONTINENTAL_LABORATORY, PAID_ADMIN
```

### 3.2 Rôles qui contournent le filtre domaine

Le code `buildFilter()` définit :
```typescript
const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CONTINENTAL_ADMIN';
```

**Proposition pour R6 — rôles contournant le filtre access-levels :**

| Rôle | Contourne le filtre ? | Justification |
|------|----------------------|---------------|
| `SUPER_ADMIN` | **OUI** | Administrateur système, accès total |
| `CONTINENTAL_ADMIN` | **OUI** | Officier de programme AU-IBAR, vision continentale |
| `REC_ADMIN` | NON | Coordinateur REC, ne voit que ses domaines/niveaux |
| `NATIONAL_ADMIN` | NON | Administrateur national, ne voit que ses domaines/niveaux |
| Autres | NON | Accès restreint |

> **QUESTION Q1 : Confirmez-vous que seuls `SUPER_ADMIN` et `CONTINENTAL_ADMIN` contournent le filtre access-levels ?** Le `REC_ADMIN` doit-il aussi contourner ?

### 3.3 Agents affectés (R6)

- Table `campaign_assignments` (`packages/db-schemas/prisma/collecte.prisma:439-469`)
- Clé unique : `(campaignId, userId)`
- API : `POST /api/v1/workflow/campaigns/:id/assignments`
- Champ legacy : `Campaign.assignedAgents: String[]` (tableau d'UUID)
- Un agent affecté voit toujours la campagne, indépendamment de ses niveaux → filtre à implémenter via `EXISTS (SELECT 1 FROM campaign_assignments WHERE campaignId = c.id AND userId = $userId)`

---

## 4. Patterns existants réutilisables

### 4.1 Page Settings

- **Pattern :** `apps/web/src/app/(dashboard)/settings/` — 6 groupes de settings
- **Groupe cible :** "Data & Domains" (contient déjà Domains, Sub-domains, etc.)
- **Hooks :** `useSettingsConfig()`, `useBulkUpdateConfig()`, `useSettingsAccess()`
- **Composants :** Cards avec icônes, SaveBar, formulaires multilingues (`MultiLangConfigField`)
- La nouvelle page "Domain Access Levels" s'intègre dans le groupe "Data & Domains"

### 4.2 SubDomainTreeSelector

- **Fichier :** `apps/web/src/components/forms/SubDomainTreeSelector.tsx`
- Arbre à cases à cocher avec domaines dépliables, recherche, chips, select all/deselect all
- Gère le mapping `FORM_TO_STORE` / `STORE_TO_FORM` entre formats `snake_case` et `kebab-case`
- **Réutilisable** comme base pour l'arbre domaines/sous-domaines + niveaux d'accès

### 4.3 Domain Store

- **Fichier :** `apps/web/src/lib/stores/domain-store.ts`
- Zustand store avec `domainPermissions: Record<string, string[]>`
- Méthodes : `hasAccess()`, `hasAccessToSubDomain()`, `hasAccessToValueChain()`
- Charge depuis `GET /me/access`

### 4.4 Kafka patterns

- Topics existants pour sous-domaines : `sys.credential.subdomain.{created|updated|deleted|activated|deactivated}.v1`
- Producer pattern avec `KafkaHeaders` : `correlationId, sourceService, tenantId, userId, schemaVersion, timestamp`
- Consumer pattern dans analytics : `app.kafka.subscribe({ topic, groupId, fromBeginning: false }, handler)`
- **Timeout 5s** obligatoire via `Promise.race` (cf. mémoire `feedback_kafka_timeout_pattern.md`)

### 4.5 i18n

- **6 langues** : en, fr, ar, pt, es, sw (cahier des charges mentionne 4 : en, fr, ar, pt)
- Fichiers : `packages/i18n/src/translations/{en,fr,ar,pt,es,sw}.json`
- Structure : JSON hiérarchique avec clés dot-notation (`settings.accessLevels.*`)
- RTL pour l'arabe via `useLocaleStore`

### 4.6 Feature flags

- **Aucun système de feature flag n'existe.** Les flags sont gérés via des variables d'environnement simples.
- Pour `ACCESS_LEVELS_ENABLED` : ajouter dans `.env` et vérifier côté service + front.

---

## 5. Choix de stratégie : projection locale vs cache Redis

### Options

| | (a) Projection locale Kafka | (b) Cache Redis |
|---|---|---|
| **Mécanisme** | Collecte consomme `credential.user.access-levels.updated.v1` et écrit dans une table locale `user_scope_access_levels` | Collecte lit `accessContext:{userId}` depuis Redis |
| **Latence lecture** | ~0 ms (lecture locale PG) | ~1-2 ms (réseau Redis) |
| **Cohérence** | Éventuelle (délai Kafka ≤ 100ms) | Éventuelle (délai Kafka ≤ 100ms pour invalidation) |
| **Complexité** | Consumer + table + migration | Clé Redis structurée, pas de migration |
| **Résilience** | OK même si Redis tombe | Dépend de Redis (fallback PG possible) |
| **Requête SQL** | JOIN direct dans la requête de liste → `EXISTS` sur table locale | Résolution en mémoire après fetch Redis, puis injection dans la requête |

### Choix : **(b) Cache Redis**

**Justification :**
1. **Redis est déjà l'infra de cache** pour ARIS (TTL, invalidation Kafka, `@aris/cache`).
2. Les niveaux d'un utilisateur changent rarement (≤ 1x/jour). Le cache est efficace.
3. La donnée est petite (~200 bytes par utilisateur). Redis supporte facilement 100K entrées.
4. **Pas de migration Prisma** côté Collecte — on évite de dupliquer un modèle entre services.
5. Le filtrage SQL reste performant : on résout les niveaux de l'utilisateur depuis Redis (1 appel), puis on injecte les codes dans la clause `WHERE EXISTS(...)` / `NOT EXISTS(...)`.

**Pattern :**
```
1. GET accessContext:{userId} → { version: 3, scopes: { "animal-health": ["LEVEL_A"], "animal-health.PPR": ["LEVEL_B"] } }
2. Injecter dans la requête Prisma : WHERE ... AND (campagne ouverte OU intersection niveaux)
3. Invalider sur événement Kafka credential.user.access-levels.updated.v1
```

**Fallback :** si Redis est indisponible, appeler le service Credential via HTTP (avec circuit breaker). Ne jamais bloquer la liste des campagnes.

---

## 6. Points d'accès à filtrer — liste exhaustive

En combinant l'inventaire du §2.1 avec R7, voici les points où le filtre access-levels doit être appliqué :

| # | Service | Endpoint / Méthode | Action requise |
|---|---------|-------------------|----------------|
| 1 | Collecte | `GET /campaigns` (findAll) | Ajouter clause access-levels dans `buildFilter()` |
| 2 | Collecte | `GET /campaigns/:id` (findOne) | Vérifier access-levels, retourner 404 |
| 3 | Collecte | `GET /submissions` (findAll) | Filtrer via campaign → access-levels |
| 4 | Collecte | `GET /submissions/:id` | Vérifier campagne parente visible |
| 5 | Collecte | `GET /workflow/campaigns` | Ajouter clause dans `buildFilter()` dupliqué |
| 6 | Collecte | `GET /sync/delta` | Filtrer campagnes retournées |
| 7 | Collecte | `POST /sync` | Valider que la campagne est visible avant d'accepter une soumission |
| 8 | Analytics | `GET /dashboard/kpis` | Filtrer les KPI par campagnes visibles |
| 9 | Analytics | `GET /domain-summary` | Filtrer les campagnes comptabilisées |
| 10 | Analytics | Reports / exports | Filtrer les données source |
| 11 | Datalake | Ingestion OpenSearch | Embarquer les scopes dans l'index pour filtrage à la recherche |
| 12 | Mobile | Sync initial + delta | Appliquer le même filtre que #6 |

---

## 7. Plan ajusté des lots

### Lot 1 — Modèle, migrations, package partagé
1. Modèle `DomainAccessLevel` dans `settings.prisma` (service Config)
2. Modèle `UserScopeAccessLevel` dans `credential.prisma` (service Credential)
3. Modèle `CampaignScopeAccessLevel` dans `collecte.prisma` (service Collecte)
4. Package `packages/access-control/` : types, Zod, `canViewCampaign()`
5. Tests unitaires exhaustifs (table de vérité complète)
6. Feature flag `ACCESS_LEVELS_ENABLED` dans `.env`

### Lot 2 — Service Config + page Settings
1. API CRUD dans le service settings (ou un module dédié du service existant)
2. Événements Kafka `config.access-level.{created|updated|deactivated}.v1`
3. Topics Kafka dans `packages/shared-types/src/kafka/topic-names.ts`
4. Page UI `settings/access-levels/` avec arbre + tableau + CRUD + copie + drag-and-drop
5. i18n (6 langues)
6. Tests API + composants

### Lot 3 — Credential : affectation des utilisateurs
1. API `PUT /users/:id/scopes`
2. Événement Kafka `credential.user.access-levels.updated.v1`
3. Cache Redis `accessContext:{userId}`
4. UI dans le formulaire utilisateur : arbre domaines/sous-domaines + multi-select niveaux
5. Résumé des niveaux dans la liste utilisateurs
6. Tests

### Lot 4 — Collecte : ciblage campagnes + filtrage
1. API `PUT /campaigns/:id/scopes`
2. Événement Kafka `collecte.campaign.access-levels.updated.v1`
3. Modification de `buildFilter()` dans `campaign.service.ts` (requête indexée `EXISTS`)
4. Modification de `findOne()` pour vérifier les niveaux (404)
5. Modification de `buildFilter()` dans `submission.service.ts`
6. Modification de `buildFilter()` dans `workflow-engine.service.ts`
7. UI de création/édition de campagne : étape domaines + niveaux
8. Tests d'intégration

### Lot 5 — Propagation aux services aval
1. Analytics : filtrer domain-summary, KPIs, reports par campagnes visibles
2. Datalake : embarquer les scopes dans l'index OpenSearch
3. Sync mobile delta : filtrer les campagnes retournées
4. Tests

### Lot 6 — Mobile (Kotlin)
1. Endpoint delta applique le filtre
2. Room : stocker les niveaux d'accès localement
3. Révocation : retirer campagnes invisibles, conserver soumissions en attente
4. Tests WorkManager et Room

### Lot 7 — Recette, performance, documentation
1. Tests E2E (4 profils types)
2. `EXPLAIN ANALYZE` sur requête de liste (≥10K campagnes, ≥50K affectations)
3. Plan d'activation progressive du feature flag
4. Documentation architecture + guide administrateur

---

## 8. Questions ouvertes

### Q1 — Rôles admin (R6)
Seuls `SUPER_ADMIN` et `CONTINENTAL_ADMIN` contournent le filtre dans le code actuel. **Confirmez-vous cette liste ?** Le `REC_ADMIN` doit-il aussi contourner le filtre access-levels ?

### Q2 — Format du nodeCode
Le cahier des charges utilise `ANIMAL_HEALTH` et `ANIMAL_HEALTH.LABORATORY`. Le code existant utilise `animal-health` (kebab-case) et `PPR` (UPPER_SNAKE). Je propose `animal-health` pour les domaines et `animal-health.PPR` pour les sous-domaines. **Approuvez-vous ce format ?**

### Q3 — Service propriétaire du catalogue
Le cahier des charges dit "service Config". En pratique, les domaines/sous-domaines sont dans le schéma `settings` (service settings/config). Le modèle `DomainAccessLevel` irait dans `settings.prisma`. **Confirmez-vous ?**

### Q4 — Sous-domaines dans `buildFilter()`
Actuellement, `buildFilter()` ne filtre **pas** par sous-domaine (un utilisateur avec `{ "livestock-prod": ["DAIRY"] }` voit toutes les campagnes `livestock-prod`). Le filtre access-levels doit-il aussi corriger ce manque, ou est-ce un sujet séparé ?

### Q5 — Soumissions existantes lors d'une révocation
Si un utilisateur perd l'accès à une campagne après avoir soumis des données : ses soumissions existantes restent-elles visibles par les admins ? (Hypothèse : OUI, les soumissions sont dissociées de la visibilité de la campagne pour les admins.)

### Q6 — Nombre de niveaux d'accès prévu
Pour le dimensionnement de la requête `EXPLAIN ANALYZE` : combien de niveaux d'accès distincts prévoyez-vous par noeud ? (5-10 ? 50+ ?)

---

## 9. Risques identifiés

| # | Risque | Impact | Mitigation |
|---|--------|--------|-----------|
| R1 | `buildFilter()` est dupliqué dans 3 fichiers (campaign, submission, workflow-engine) | Divergence du filtre | Centraliser via le package `access-control` |
| R2 | La sync mobile n'a aucun filtre domaine actuellement | Fuite de données campagnes | Lot 5-6 : filtrage obligatoire |
| R3 | Le domain-summary (analytics) utilise du SQL brut avec `c.domain = $1` | Nécessite modification SQL | Lot 5 : ajout `EXISTS` dans les requêtes SQL brutes |
| R4 | Double format de code domaine (kebab vs snake) | Erreur de matching | `nodeCode` normalisé en kebab-case, conversion systématique |
| R5 | Redis indisponible → blocage du filtrage | Utilisateurs bloqués | Fallback HTTP vers Credential avec cache local court (30s) |
| R6 | Campagnes multi-noeud complexes | Requête lente | Index composites + `EXPLAIN ANALYZE` au Lot 7 |
