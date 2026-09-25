# Changelog — Domain Access Levels

## [1.0.0] — 2026-09-25

### Lot 1 — Modele, migrations, package partage
- Modele `DomainAccessLevel` dans `settings.prisma` (schema `governance`)
- Modele `UserScopeAccessLevel` dans `credential.prisma` (schema `public`)
- Modele `CampaignScopeAccessLevel` dans `collecte.prisma` (schema `public`)
- 5 topics Kafka dans `shared-types/kafka/topic-names.ts`
- Package `@aris/access-control` : types, Zod, `canViewCampaign()`, `buildAccessLevelSqlFilter()`, feature flag
- 53 tests unitaires (table de verite complete)
- Feature flag `ACCESS_LEVELS_ENABLED` dans `.env.example`

### Lot 2 — Service Config + page Settings
- 6 routes API dans tenant service : GET, POST, PATCH, deactivate, reorder, copy
- 6 methodes dans `SettingsService` avec cache Redis, Kafka, audit
- Page UI `settings/access-levels/` : arbre domaines/sous-domaines, CRUD niveaux, copie, reordonnancement
- Schemas TypeBox : AccessLevelQuery, Create, Update, Reorder, Copy
- 6 hooks React Query : useAccessLevels, useCreate/Update/Deactivate/Reorder/CopyAccessLevel
- i18n : cle `accessLevels` dans 6 langues (en, fr, ar, pt, es, sw)
- Fix test pre-existant : `tenant.service.spec.ts` throws 409 (27/27 verts)

### Lot 3 — Credential : affectation utilisateurs
- 2 routes API : GET/PUT `/settings/users/:id/scopes`
- `setUserScopes()` avec validation, transaction Prisma, cache Redis `accessContext:{userId}`, Kafka
- Schema TypeBox `UserScopesBodySchema`
- 2 hooks React Query : useUserScopes, useSetUserScopes
- Section "Access Levels" dans le formulaire utilisateur (boutons toggle par domaine)

### Lot 4 — Collecte : ciblage campagnes + filtrage
- 2 routes API : GET/PUT `/collecte/campaigns/:id/scopes`
- `setCampaignScopes()` avec transaction Prisma, Kafka
- Filtrage `buildFilter()` dans 3 fichiers : campaign, submission, workflow-engine
- `findOne()` retourne 404 si campagne non visible
- `canUserViewCampaign()` : resolution scopes via DB (pas de Redis dans collecte)
- 2 hooks React Query : useCampaignScopes, useSetCampaignScopes
- Section "Access Levels" dans le formulaire de creation de campagne

### Lot 5 — Propagation services aval
- Analytics : `hasAccessToDomain()` sur domain-summary et KPI routes (404 si non autorise)
- Sync mobile `getServerUpdates()` : filtre domain Prisma + access-levels post-filter
- Sync mobile `getDelta()` : clause SQL `AND domain IN (...)` pour non-admins
- Signature `getDelta()` modifiee : recoit `user: AuthenticatedUser` complet

### Lot 6 — Mobile (Kotlin)
- `CampaignDao` : `getAllIds()`, `deleteByIds(ids)`
- `SubmissionDao` : `markRevokedByCampaigns(ids)` — PENDING/DRAFT → REVOKED
- `CampaignRepository.refreshCampaigns()` : reconciliation (compare serveur vs local, supprime revoques)
- `AppModule` : `submissionDao` injecte dans `CampaignRepository`

### Lot 7 — Documentation
- `docs/access-levels/architecture.md` : vue d'ensemble, diagrammes Mermaid, points d'acces
- `docs/access-levels/guide-administrateur.md` : guide FR pour les administrateurs
- `docs/access-levels/activation-plan.md` : plan en 5 phases, EXPLAIN ANALYZE, rollback
- `docs/access-levels/CHANGELOG.md` : ce fichier
