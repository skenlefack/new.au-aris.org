# Chantier A -- Diagnostic Multi-Target Campagnes & Formulaires

> Date : 2026-04-25
> Auteur : CC-5 (diagnostic en lecture seule)
> Branche analysee : `main` (commit `8effae7`)

---

## 1. Modele FormTemplate actuel

### Schema Prisma

**Fichier** : `packages/db-schemas/prisma/form-builder.prisma` (lignes 19-59)

```prisma
model FormTemplate {
  id                String             @id @default(uuid()) @db.Uuid
  tenant_id         String             @db.Uuid
  name              String             @db.VarChar(255)
  domain            String             @db.VarChar(50)          // <-- CHAMP SIMPLE, PAS DE FK
  form_type         FormType           @default(CAMPAIGN)
  version           Int                @default(1)
  parent_template_id String?           @db.Uuid
  schema            Json
  ui_schema         Json               @default("{}")
  data_contract_id  String?            @db.Uuid
  status            FormTemplateStatus @default(DRAFT)
  data_classification String           @default("RESTRICTED") @db.VarChar(20)
  created_by        String             @db.Uuid
  updated_by        String?            @db.Uuid
  published_at      DateTime?
  archived_at       DateTime?
  created_at        DateTime           @default(now())
  updated_at        DateTime           @updatedAt

  parent            FormTemplate?      @relation("TemplateInheritance", ...)
  children          FormTemplate[]     @relation("TemplateInheritance")
  submissions       FormSubmission[]
  collectionCampaigns CollectionCampaign[]
  overlays          FormOverlay[]

  @@unique([tenant_id, name, version])
  @@index([tenant_id])
  @@index([domain])
  @@index([status])
  @@index([parent_template_id])
  @@map("form_templates")
  @@schema("form_builder")
}
```

### Relation au domaine

| Aspect | Situation actuelle |
|--------|-------------------|
| Type de champ | `String @db.VarChar(50)` -- texte libre, pas de FK |
| Table de jointure | Aucune |
| Validation | Cote backend : Typebox `Type.String({ minLength: 2, maxLength: 50 })` |
| Valeurs possibles | Pas de contrainte DB, libre au code metier |
| Index | `@@index([domain])` |

**Conclusion** : Le `domain` est un **champ texte scalaire** sans relation a une table de reference. Un formulaire = exactement UN domaine. Pas de multi-domaine possible sans modifier le schema.

### Modeles associes dans `form_builder` schema

| Modele | Fichier (lignes) | Relation domain |
|--------|-----------------|-----------------|
| `FormSubmission` | form-builder.prisma:70-96 | Aucun champ domain (herite via `template_id` FK) |
| `FormOverlay` | form-builder.prisma:99-125 | Aucun champ domain |
| `FormVersionHistory` | form-builder.prisma:128-143 | Aucun champ domain |

---

## 2. Modele Campaign actuel

Il existe **deux** modeles de campagne dans le systeme :

### 2.1 Campaign (modele historique -- schema `public`)

**Fichier** : `packages/db-schemas/prisma/collecte.prisma` (lignes 82-111)

```prisma
model Campaign {
  id                String         @id @default(uuid()) @db.Uuid
  tenantId          String         @map("tenant_id") @db.Uuid
  name              String         @db.VarChar(255)
  domain            String         @db.VarChar(100)             // <-- CHAMP SIMPLE
  templateId        String         @map("template_id") @db.Uuid
  templateIds       String[]       @map("template_ids") @db.Uuid  // <-- ARRAY pour multi-templates
  targetCountries   String[]       @map("target_countries") @db.VarChar(2)
  startDate         DateTime       @map("start_date") @db.Date
  endDate           DateTime       @map("end_date") @db.Date
  targetZones       String[]       @map("target_zones") @db.Uuid
  assignedAgents    String[]       @map("assigned_agents") @db.Uuid
  targetSubmissions Int?           @map("target_submissions")
  status            CampaignStatus @default(PLANNED)
  description       String?        @db.Text
  conflictStrategy  ConflictStrategy @default(LAST_WRITE_WINS)
  dataContractId    String?        @map("data_contract_id") @db.Uuid
  createdBy         String         @map("created_by") @db.Uuid
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  submissions       Submission[]

  @@index([tenantId])
  @@index([domain])
  @@index([status])
  @@index([templateId])
  @@map("campaigns")
  @@schema("public")
}
```

### 2.2 CollectionCampaign (modele enrichi -- schema `public`)

**Fichier** : `packages/db-schemas/prisma/collecte.prisma` (lignes 335-370)

```prisma
model CollectionCampaign {
  id                  String                   @id @default(uuid()) @db.Uuid
  code                String                   @db.VarChar(100)
  name                Json                     // multilingue { en, fr, pt, ar }
  description         Json?
  domain              String                   @db.VarChar(50)     // <-- CHAMP SIMPLE
  formTemplateId      String                   @map("form_template_id") @db.Uuid
  startDate           DateTime                 @map("start_date") @db.Date
  endDate             DateTime                 @map("end_date") @db.Date
  targetCountries     Json?
  targetRecIds        Json?
  targetAdminAreas    Json?
  targetSubmissions   Int?
  targetPerAgent      Int?
  frequency           String?                  @db.VarChar(20)
  status              CollectionCampaignStatus @default(PLANNED)
  scope               String                   @default("continental") @db.VarChar(20)
  ownerId             String?                  @map("owner_id") @db.Uuid
  ownerType           String                   @default("continental")
  sendReminders       Boolean                  @default(true)
  reminderDaysBefore  Int                      @default(3)
  metadata            Json?
  createdBy           String?
  createdAt           DateTime                 @default(now())
  updatedAt           DateTime                 @updatedAt

  formTemplate        FormTemplate             @relation(...)
  assignments         CampaignAssignment[]

  @@unique([code, scope, ownerId])
  @@index([status])
  @@index([domain])
  @@index([formTemplateId])
  @@map("collection_campaigns")
  @@schema("public")
}
```

### Comparaison des deux modeles

| Aspect | Campaign | CollectionCampaign |
|--------|----------|-------------------|
| Champ domain | `String VarChar(100)` | `String VarChar(50)` |
| Multi-domain | Non (scalaire) | Non (scalaire) |
| Multi-template | Oui (`templateIds String[]`) | Non (1 FK `formTemplateId`) |
| Nom | String simple | Json multilingue |
| RECs cibles | Non | Oui (`targetRecIds Json?`) |
| Pays cibles | `String[] VarChar(2)` | `Json?` |
| Workflow | Lie via `Submission` | Lie via `CampaignAssignment` |
| Utilise par | `CampaignService` (route `/api/v1/collecte/campaigns`) | `CollectionCampaignService` (route `/api/v1/workflow/campaigns`) |

### Hack UI actuel pour le multi-domaine

Dans `apps/web/src/app/(dashboard)/collecte/campaigns/new/page.tsx` (ligne 127-148), l'UI permet de **selectionner plusieurs domaines** mais ne persiste que le premier :

```typescript
const primaryDomain = selectedDomains[0];
// ...
const payload = {
  domain: primaryDomain,          // <-- SEUL LE PREMIER EST ENVOYE
  // ...
  metadata: {
    domains: selectedDomains,     // <-- LES AUTRES SONT STOCKES DANS metadata (Json)
    recCodes: selectedRecs.map((r) => r.code),
  },
};
```

**Conclusion** : L'UI supporte deja la multi-selection de domaines, mais le backend ne persiste que le premier dans `domain` et les autres dans `metadata.domains` (non indexe, non requetable).

---

## 3. Endpoints qui consomment ces relations

### 3.1 Service form-builder (port 3010)

**Routes** (`services/form-builder/src/routes/templates.ts`) :

| Methode | Route | Filtre domain |
|---------|-------|--------------|
| POST | `/api/v1/form-builder/templates` | `domain` dans le body (requis) |
| GET | `/api/v1/form-builder/templates` | `?domain=xxx` en query |
| GET | `/api/v1/form-builder/templates/:id` | Non |
| PATCH | `/api/v1/form-builder/templates/:id` | `domain` optionnel dans le body |
| POST | `/api/v1/form-builder/templates/:id/publish` | Non |
| POST | `/api/v1/form-builder/templates/:id/archive` | Non |
| POST | `/api/v1/form-builder/templates/:id/duplicate` | Non |
| POST | `/api/v1/form-builder/templates/import-excel` | `?domain=xxx` en query (defaut `general`) |
| DELETE | `/api/v1/form-builder/templates/:id` | Non |

**Logique de filtrage par domaine** (`services/form-builder/src/services/template.service.ts`, lignes 112-127) :

```typescript
const userDomains = (user as any).domains ?? [];
let domainFilter: Record<string, unknown> = {};
if (query.domain) {
  if (user.role === 'SUPER_ADMIN' || userDomains.length === 0 || userDomains.includes(query.domain)) {
    domainFilter = { domain: query.domain };
  }
} else if (user.role !== 'SUPER_ADMIN' && userDomains.length > 0) {
  domainFilter = { domain: { in: userDomains } };
}
```

Le service utilise `user.domains` (un objet ou tableau provenant du JWT) pour restreindre les formulaires visibles par l'utilisateur.

### 3.2 Service collecte -- Campaign (port 3011)

**Routes** (`services/collecte/src/routes/campaigns.ts`) :

| Methode | Route | Filtre domain |
|---------|-------|--------------|
| POST | `/api/v1/collecte/campaigns` | `domain` dans le body (requis) |
| GET | `/api/v1/collecte/campaigns` | `?domain=xxx` en query |
| GET | `/api/v1/collecte/campaigns/:id` | Non |
| PATCH | `/api/v1/collecte/campaigns/:id` | Non |
| DELETE | `/api/v1/collecte/campaigns/:id` | Non |

**Filtrage** (`services/collecte/src/services/campaign.service.ts`, lignes 276-331) :
- Utilise `user.domains` pour restreindre les campagnes visibles
- Meme pattern que form-builder : `{ domain: { in: userDomainCodes } }`

### 3.3 Service collecte -- CollectionCampaign (via workflow routes)

**Routes** (`services/collecte/src/routes/workflow.ts`) :

| Methode | Route |
|---------|-------|
| GET | `/api/v1/workflow/campaigns` |
| GET | `/api/v1/workflow/campaigns/:id` |
| POST | `/api/v1/workflow/campaigns` |
| PUT | `/api/v1/workflow/campaigns/:id` |
| POST | `/api/v1/workflow/campaigns/:id/activate` |
| POST | `/api/v1/workflow/campaigns/:id/pause` |
| POST | `/api/v1/workflow/campaigns/:id/complete` |
| POST | `/api/v1/workflow/campaigns/:id/assignments` |
| GET | `/api/v1/workflow/campaigns/:id/progress` |
| DELETE | `/api/v1/workflow/campaigns/:id/assignments/:assignId` |

**Logique** (`services/collecte/src/services/workflow-engine.service.ts`, lignes 1157-1224) :
- `create()` : persiste `domain: dto.domain as string` (scalaire)
- `findAll()` : inclut `formTemplate: { select: { id, name, domain } }` dans le retour
- `buildVisibilityFilter()` : filtre par `query.domain` si fourni

---

## 4. UI actuelle

### 4.1 Creation de formulaire

**Fichier** : `apps/web/src/app/(dashboard)/collecte/forms/new/page.tsx`

- Selection du domaine : `<select>` simple (1 seul domaine)
- Source des options : `DOMAIN_OPTIONS` depuis `@/components/form-builder/utils/field-types`
- Defaut : `animal_health`
- Le domaine est envoye a `useCreateFormTemplate({ name, domain, formType, schema })`

### 4.2 Liste des formulaires

**Fichier** : `apps/web/src/app/(dashboard)/collecte/forms/page.tsx`

- Utilise `useFormBuilderTemplates({ domain, status, ... })` pour filtrer
- Affiche le domain badge via `DOMAIN_OPTIONS.find(d => d.value === tmpl.domain)`

### 4.3 Creation de campagne

**Fichier** : `apps/web/src/app/(dashboard)/collecte/campaigns/new/page.tsx`

- **Multi-domaine UI** : boutons pills avec multi-selection (`selectedDomains: string[]`, ligne 55)
- **Multi-template** : `MultiSearchCombobox<FormTemplateListItem>` (ligne 368-394)
- **Filtrage templates par domaines** : les templates PUBLISHED sont filtres par les domaines selectionnes (ligne 78-85)
- **Soumission** : seul `selectedDomains[0]` est envoye dans `domain`, les autres vont dans `metadata.domains`

### 4.4 Composant DomainCampaignsSection

**Fichier** : `apps/web/src/components/domain/DomainCampaignsSection.tsx`

- Recoit une prop `domain: string`
- Appelle `useCollectionCampaigns({ domain, status: 'ACTIVE', limit: 5 })`
- Affiche les campagnes actives pour un domaine donne sur les pages domaine

### 4.5 DOMAIN_OPTIONS

**Fichier** : `apps/web/src/components/form-builder/utils/field-types.ts` (lignes 138-147)

```typescript
export const DOMAIN_OPTIONS = [
  { value: 'animal_health', label: 'Animal Health' },
  { value: 'livestock', label: 'Livestock & Production' },
  { value: 'fisheries', label: 'Fisheries & Aquaculture' },
  { value: 'trade_sps', label: 'Trade & SPS' },
  { value: 'wildlife', label: 'Wildlife & Biodiversity' },
  { value: 'apiculture', label: 'Apiculture' },
  { value: 'climate_env', label: 'Climate & Environment' },
  { value: 'governance', label: 'Governance & Capacities' },
];
```

8 valeurs hard-codees cote frontend. Pas de correspondance avec une table DB de domaines.

### 4.6 Hooks API utilises

| Hook | Fichier | Role |
|------|---------|------|
| `useFormBuilderTemplates` | `apps/web/src/lib/api/form-builder-hooks.ts:99` | Liste templates avec filtre `?domain=` |
| `useCreateFormTemplate` | `apps/web/src/lib/api/form-builder-hooks.ts:135` | Cree template (domain requis) |
| `useCreateCollectionCampaign` | `apps/web/src/lib/api/workflow-hooks.ts:406` | POST `/api/v1/workflow/campaigns` |
| `useCollectionCampaigns` | `apps/web/src/lib/api/workflow-hooks.ts` | GET `/api/v1/workflow/campaigns?domain=` |

---

## 5. Tables liees impactees

### 5.1 Submission (collecte.prisma:115-147)

```prisma
model Submission {
  campaignId   String   @map("campaign_id") @db.Uuid
  templateId   String   @map("template_id") @db.Uuid
  // ... pas de champ domain direct
  campaign     Campaign @relation(...)
}
```

- Lie a `Campaign` par FK. Pas de champ domain propre.
- Le domain est resolu via `campaign.domain` au runtime (cf. `submission.service.ts:486`).

### 5.2 FormSubmission (form-builder.prisma:70-96)

- Lie a `FormTemplate` par `template_id` FK
- Pas de champ domain propre

### 5.3 CollecteInstance (collecte.prisma:273-301)

```prisma
model CollecteInstance {
  workflowId        String   @map("workflow_id") @db.Uuid
  submissionId      String   @unique @map("submission_id") @db.Uuid
  formSubmissionId  String?  @unique @map("form_submission_id") @db.Uuid
  // ... pas de champ domain
}
```

- Pas de relation directe au domaine. Le domaine est resolu via la chaine :
  `CollecteInstance -> Submission -> Campaign.domain`

### 5.4 CampaignAssignment (collecte.prisma:374-404)

- Lie a `CollectionCampaign` par FK `campaignId`
- Pas de champ domain propre

### 5.5 CollecteHistory (collecte.prisma:306-331)

- Lie a `CollecteInstance` par FK. Pas de champ domain.

### 5.6 SyncLog (collecte.prisma:151-169)

- Pas de lien campagne/domaine.

### Synthese des dependances

```
FormTemplate.domain
    |
    +-- FormSubmission (via template_id FK)
    +-- FormOverlay (via template_id FK)
    +-- FormVersionHistory (via template_id FK)
    +-- CollectionCampaign (via formTemplateId FK + own domain field)
            |
            +-- CampaignAssignment (via campaignId FK)

Campaign.domain
    |
    +-- Submission (via campaignId FK)
        |
        +-- CollecteInstance (via submissionId FK)
            |
            +-- CollecteHistory (via instanceId FK)
```

---

## 6. Topics Kafka actuels

**Fichier** : `packages/shared-types/src/kafka/topic-names.ts`

### Topics Collecte (lignes 27-31)

| Constante | Topic |
|-----------|-------|
| `TOPIC_MS_COLLECTE_CAMPAIGN_CREATED` | `ms.collecte.campaign.created.v1` |
| `TOPIC_MS_COLLECTE_FORM_SUBMITTED` | `ms.collecte.form.submitted.v1` |
| `TOPIC_MS_COLLECTE_FORM_SYNCED` | `ms.collecte.form.synced.v1` |
| `TOPIC_MS_COLLECTE_SUBMISSION_QUALITY_COMPLETED` | `ms.collecte.submission.quality-completed.v1` |
| `TOPIC_MS_COLLECTE_SUBMISSION_WORKFLOW_CREATED` | `ms.collecte.submission.workflow-created.v1` |

### Topics FormBuilder (lignes 34-35)

| Constante | Topic |
|-----------|-------|
| `TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED` | `ms.formbuilder.template.created.v1` |
| `TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED` | `ms.formbuilder.template.published.v1` |

### Topic DLQ (ligne 172)

| Constante | Topic |
|-----------|-------|
| `TOPIC_DLQ_COLLECTE` | `dlq.collecte.v1` |

### Producteurs identifies

| Service | Topic emis | Fichier |
|---------|-----------|---------|
| form-builder | `TEMPLATE_CREATED`, `TEMPLATE_PUBLISHED` | `services/form-builder/src/services/template.service.ts` |
| collecte (CampaignService) | `CAMPAIGN_CREATED` | `services/collecte/src/services/campaign.service.ts:95` |
| collecte (SubmissionService) | `FORM_SUBMITTED`, `FORM_SYNCED`, `SUBMISSION_QUALITY_COMPLETED`, `SUBMISSION_WORKFLOW_CREATED` | `services/collecte/src/services/submission.service.ts` |

### Note sur la convention sub-domain

Le fichier `topic-names.ts` (lignes 329-337) definit deja une fonction utilitaire pour generer des topics avec granularite sous-domaine :

```typescript
export function domainSubDomainTopic(
  scope: 'ms' | 'rec' | 'au' | 'sys',
  domainCode: string,
  subDomainCode: string,
  event: string,
  version = 'v1',
): string {
  return [scope, domainCode, subDomainCode, event, version].join('.');
}
// Exemple: 'ms.livestock-prod.dairy.metric.updated.v1'
```

Cette fonction n'est pas encore utilisee pour les topics de collecte/form-builder.

---

## 7. Volume estime (seeds/fixtures)

### FormTemplate seeds

**Fichier** : `services/form-builder/src/seed.ts` (lignes 1574-1616)

| Domaine | Nombre de formulaires | Noms |
|---------|----------------------|------|
| `animal_health` | 7 | Monthly Health Report, Emergency Disease, Mass Vaccination, Meat Inspection, Monthly Abattoir, Monthly Vaccination, Aquatic Animal Health |
| `livestock` | 7 | Breeding & Genomics, Population Genetic, Population & Composition, Breeder Assoc., Disaster & Risk, Legislation, Genetic Resources Centre |
| `trade_sps` | 8 | Cost of Production, Import/Export, Market Demand, Market Price, Market Req/Location, Quality Inputs, Quality Poultry, Transport |
| `fisheries` | 6 | Capture Report, Vessel Registration, Fishing Effort, Aquaculture Farm, Aquaculture Production, Fish Trade |
| **Total** | **28** | |

Pas de formulaires seedes pour `wildlife`, `apiculture`, `climate_env`, `governance`.

### Campaign seeds

**Fichier** : `services/collecte/src/seed/seed-data.ts`

- **1 seule campagne seedee** : "Kenya FMD Surveillance Q1 2025"
  - Domaine : `health`
  - Template : `SEED_TEMPLATE_ID`
  - 5 zones cibles, 2 agents, 500 submissions cibles

### Estimation volume production

D'apres les conversations et le deploy staging (MEMORY.md) :
- 110 topics Kafka crees en staging
- 63 tenants seedes
- 128 utilisateurs seedes
- Le seed form-builder cree 28 formulaires
- En production, des formulaires additionnels ont ete crees manuellement (deploy scripts `_create_livestock_production_v2.py` etc.)

---

## Synthese des contraintes pour le multi-target

### Points bloquants actuels

1. **Domain est un champ scalaire** (pas de FK, pas de table de jointure)
   - `FormTemplate.domain` : `String VarChar(50)`
   - `Campaign.domain` : `String VarChar(100)`
   - `CollectionCampaign.domain` : `String VarChar(50)`

2. **Deux modeles de campagne coexistent** (`Campaign` et `CollectionCampaign`)
   - `Campaign` a `templateIds String[]` (multi-template en array)
   - `CollectionCampaign` a `formTemplateId` (FK simple, 1 seul template)
   - Logique dupliquee dans `CampaignService` et `CollectionCampaignService`

3. **Le filtrage backend repose sur un match scalaire**
   - `WHERE domain = 'health'` ou `WHERE domain IN ['health', 'livestock']`
   - Un formulaire multi-domaine (ex: "Aquatic Animal Health" couvrant `animal_health` + `fisheries`) n'est pas representable

4. **L'UI a pris de l'avance** sur le backend
   - Multi-selection de domaines dans la creation de campagne (boutons pills)
   - Multi-selection de templates (MultiSearchCombobox)
   - Mais le payload final envoie `domain: selectedDomains[0]` et met le reste dans `metadata.domains`

### Ce qui existe deja et peut etre reutilise

- `DOMAIN_OPTIONS` cote frontend (8 domaines)
- `domainSubDomainTopic()` pour Kafka
- `user.domains` dans le JWT pour le filtrage RBAC
- `metadata Json` dans `CollectionCampaign` (peut contenir `domains[]` mais non indexe)
- Multi-template dans `Campaign.templateIds` (pattern array Postgres)

### Impact estimatif d'un passage multi-target

| Composant | Impact |
|-----------|--------|
| Schema Prisma | Moyen -- ajout table de jointure `form_template_domains` / `campaign_domains` |
| form-builder service | Moyen -- adapter create/findAll/update pour gerer N domaines |
| collecte service (Campaign) | Moyen -- meme adaptation |
| collecte service (CollectionCampaign) | Moyen -- meme adaptation |
| UI creation formulaire | Faible -- passer de `<select>` a multi-select |
| UI creation campagne | Faible -- deja multi-select, juste envoyer l'array complet |
| Filtrage RBAC | Moyen -- adapter les filtres `domain IN (...)` |
| Kafka events | Faible -- ajouter `domains[]` dans les payloads |
| Submissions/Workflow | Faible -- resolvent le domaine via FK, pas de changement schema |
| Seeds | Faible -- adapter les 28 templates |
| Tests | Moyen -- adapter ~12 fichiers spec |
