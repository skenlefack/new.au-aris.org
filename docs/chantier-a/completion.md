# Chantier A -- Multi-target campagnes & formulaires -- Completion Report

## Livrables

- [x] Tables `form_targets` et `campaign_targets` en place (commit `5d8ebe3`)
- [x] Migration des donnees legacy (script `deploy/scripts/_migrate_form_campaign_targets.ts`)
- [x] APIs CRUD multi-target dans form-builder et collecte (commit `ae6fc52`)
- [x] Helper de resolution des cibles (`resolveDomain()` dans template.service.ts et campaign.service.ts)
- [x] UI TargetsSelector integre dans FormBuilder et CampaignBuilder (commit `6a4af69`)
- [x] Badges targets dans les listes (TargetBadges dans campaigns/page.tsx, forms/page.tsx)
- [x] Audit du code legacy -- 30+ occurrences annotees `// Backward compat: reads legacy domain field, prefer targets[]`
- [x] Documentation (ce fichier)

## Fichiers cles

### Schema Prisma
- `packages/db-schemas/prisma/form-builder.prisma` -- table `form_targets` (FK vers `form_templates`)
- `packages/db-schemas/prisma/collecte.prisma` -- table `campaign_targets` (FK vers `collection_campaigns`)

### Backend -- form-builder
- `services/form-builder/src/services/template.service.ts` -- CRUD avec targets[], resolveDomain(), backward compat
- `services/form-builder/src/services/form-resolver.service.ts` -- resolution de formulaires (backward compat annote)
- `services/form-builder/src/template/__tests__/template.service.spec.ts` -- tests multi-target + legacy

### Backend -- collecte
- `services/collecte/src/services/campaign.service.ts` -- CRUD avec targets[], resolveDomain(), backward compat
- `services/collecte/src/services/submission.service.ts` -- lecture campaign.domain pour Kafka events (backward compat)
- `services/collecte/src/services/sync.service.ts` -- lecture campaign.domain pour sync events (backward compat)
- `services/collecte/src/services/workflow-engine.service.ts` -- creation campaigns internes (backward compat)

### Backend -- workflow
- `services/workflow/src/services/workflow.service.ts` -- lecture/ecriture domain sur instances (backward compat)

### Frontend
- `apps/web/src/components/forms/TargetsSelector.tsx` -- composant UI multi-target
- `apps/web/src/app/(dashboard)/collecte/forms/[id]/edit/page.tsx` -- editeur formulaires (backward compat)
- `apps/web/src/app/(dashboard)/collecte/forms/page.tsx` -- liste formulaires (backward compat)
- `apps/web/src/app/(dashboard)/collecte/campaigns/[id]/edit/page.tsx` -- editeur campagnes (targets restoration)
- `apps/web/src/app/(dashboard)/collecte/campaigns/page.tsx` -- liste campagnes (TargetBadges + fallback legacy)
- `apps/web/src/app/(dashboard)/collecte/campaigns/[id]/page.tsx` -- detail campagne (backward compat)
- `apps/web/src/app/(dashboard)/collecte/page.tsx` -- tableau de bord collecte (backward compat)
- `apps/web/src/components/form-builder/FormBuilderToolbar.tsx` -- toolbar (backward compat)
- `apps/web/src/components/form-builder/FormBuilderStatusBar.tsx` -- status bar (backward compat)

### Migration
- `deploy/scripts/_migrate_form_campaign_targets.ts` -- script de migration des donnees legacy vers targets

## Audit du code legacy -- Resume

30+ occurrences du champ `.domain` legacy identifiees et annotees dans 4 services backend et 8 fichiers frontend.

**Categorie des occurrences :**

| Type | Nombre | Action |
|------|--------|--------|
| Ecriture du champ legacy (create/update) | 8 | Annote -- le champ est toujours peuple via `resolveDomain()` |
| Lecture pour filtrage (findAll, query) | 6 | Annote -- les nouveaux filtres `domainCode`/`subDomainCode` existent en parallele |
| Lecture pour affichage (UI badges, labels) | 10 | Annote -- fallback sur targets[] quand disponibles |
| Lecture pour Kafka events (domain dans payload) | 4 | Annote -- le domain est propage aux consumers downstream |
| Seed/import (ecriture initiale) | 4 | Laisse tel quel -- les seeds ecrivent toujours le champ legacy |

**Non modifie (hors scope) :**
- `apps/web/src/app/(dashboard)/quality/rules/page.tsx` -- le champ `domain` est propre aux quality rules, pas aux form/campaign targets

## Prochaine etape

- Executer la migration des donnees en staging puis prod (`deploy/scripts/_migrate_form_campaign_targets.ts`)
- Planifier la suppression du champ `domain` legacy (A.4 final, hors heures ouvrees, coordination Philippe)
- Migrer les filtres legacy `?domain=X` vers `?domainCode=X&subDomainCode=Y` dans les clients API
