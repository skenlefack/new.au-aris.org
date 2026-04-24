# Diagnostic du modele Domain existant — ARIS 4.0

**Date** : 2026-04-24
**Auteur** : CC-1 (Platform Core)
**Objectif** : Etat des lieux avant ajout de `sub_domains` et `value_chain_codes`

---

## 1. Localisation du schema

- **Fichier** : `packages/db-schemas/prisma/settings.prisma` (lignes 110-128)
- **Schema PostgreSQL** : `governance`
- **Table** : `domains`
- **Format** : Prisma multi-schema (31 fichiers .prisma dans `packages/db-schemas/prisma/`)

## 2. Structure actuelle du modele Domain

```prisma
model Domain {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique @db.VarChar(30)    // "animal-health", "livestock-prod"
  name        Json                                 // { "en": "...", "fr": "...", "pt": "...", "ar": "..." }
  description Json?
  icon        String   @db.VarChar(50)             // lucide icon name
  color       String   @db.VarChar(20)             // hex color
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  userDomains UserDomain[]

  @@index([isActive], map: "idx_domain_is_active")
  @@index([sortOrder], map: "idx_domain_sort_order")
  @@map("domains")
  @@schema("governance")
}
```

### Points cles :
- **Labels multilingues** : stockes en JSON (`name`, `description`), pas en colonnes separees
- **Code** : `@unique @db.VarChar(30)`, format kebab-case (`animal-health`, pas `ANIMAL_HEALTH`)
- **ID technique** : UUID (pas CUID)
- **Schema Postgres** : `governance` (pas `public`)

## 3. Relations entrantes vers Domain

### 3.1. Relation FK directe : `UserDomain` (settings.prisma)

```prisma
model UserDomain {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  domainId   String   @map("domain_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at") @db.Timestamptz
  assignedBy String?  @map("assigned_by") @db.Uuid
  isActive   Boolean  @default(true) @map("is_active")
  user       User     @relation(...)
  domain     Domain   @relation(fields: [domainId], references: [id], onDelete: Cascade)
  @@unique([userId, domainId])
  @@map("user_domains")
  @@schema("governance")
}
```

- **Impact migration** : aucun. `SubDomain` sera une NOUVELLE relation, `UserDomain` continue a pointer vers `Domain`.

### 3.2. References par code (sans FK) : `StatisticDefinition`, `KpiDefinition`

| Modele | Champ | Type | FK ? |
|--------|-------|------|------|
| StatisticDefinition | `domainCode` | VarChar(30) | Non |
| KpiDefinition | `domainCode` | VarChar(30)? | Non |

- **Impact migration** : aucun. Ces tables stockent un code string libre.

### 3.3. Autres usages du mot "domain" (NON lies au modele Domain)

- `Tenant.domain` : nom de domaine DNS (string libre)
- `LegalFramework.domain` : type de cadre juridique (string enum)
- `StakeholderRegistry.domains` : tableau de strings

## 4. Seeds actuels : 9 domaines

| # | Code | EN | FR | sortOrder |
|---|------|----|----|-----------|
| 1 | `governance` | Governance | Gouvernance | 1 |
| 2 | `animal-health` | Animal Health | Sante animale | 2 |
| 3 | `livestock-prod` | Livestock | Elevage | 3 |
| 4 | `trade-sps` | Trade & SPS | Commerce & SPS | 4 |
| 5 | `fisheries` | Fisheries | Peches | 5 |
| 6 | `wildlife` | Wildlife | Faune sauvage | 6 |
| 7 | `apiculture` | Apiculture | Apiculture | 7 |
| 8 | `climate-env` | Climate & Env | Climat & Env | 8 |
| 9 | `knowledge-hub` | Knowledge | Connaissances | 9 |

**Fichier seed** : `packages/db-schemas/prisma/seed-settings.ts` (lignes 1300-1402)
**Pattern** : upsert idempotent sur `code`

## 5. Service Credential — Integration Domain

### Routes :
- `GET /api/v1/public/domains` — liste publique
- `GET /api/v1/credential/domains` — liste authentifiee
- `GET /api/v1/credential/users/:userId/domains` — domaines d'un utilisateur
- `PUT /api/v1/credential/users/:userId/domains` — assigner des domaines

### Service (`domain.service.ts`) :
- `listDomains()` — retourne domaines actifs tries par sortOrder
- `getUserDomains(userId)` — domaines assignes
- `setUserDomains(userId, domainIds, assignedBy, tenantId)` — remplace les assignations
- `getUserDomainCodes(userId)` — codes pour enrichissement JWT

### Kafka :
- Topic `sys.credential.user.domains-updated.v1` emis lors de changement d'assignation

### Tests :
- `services/credential/src/__tests__/domains.spec.ts` (220 lignes)

## 6. Points d'attention pour la migration

### 6.1. Convention de nommage des codes

Le prompt demande des codes SCREAMING_SNAKE (`DAIRY`, `CLINICS`).
Les codes Domain existants sont en **kebab-case** (`animal-health`, `livestock-prod`).

**Decision a prendre** : les codes SubDomain suivent-ils la convention existante kebab-case ou la nouvelle SCREAMING_SNAKE ?

**Recommandation** : SCREAMING_SNAKE pour les nouveaux modeles (SubDomain, ValueChainCode) car ce sont des codes referentiels stables, pas des slugs URL.

### 6.2. Labels multilingues : JSON vs colonnes

Le modele Domain utilise **JSON** (`name: Json`) pour le multilingue.
Le prompt propose des **colonnes separees** (`labelFr`, `labelEn`, `labelAr`, `labelPt`).

**Recommandation** : suivre le prompt (colonnes separees) car c'est plus type-safe et permet des requetes SQL directes par langue.

### 6.3. Renommages de domaines demandes

| Actuel | Nouveau | Impact |
|--------|---------|--------|
| `trade-sps` | `economic-trade` (ou `ECONOMIC_TRADE`) | `UserDomain` FK, `StatisticDefinition.domainCode`, `KpiDefinition.domainCode`, seeds de 8 services |
| `governance` | Eclater en 3 : `veterinary-governance`, `livestock-investment-governance`, `fisheries-investment-governance` | Meme impact + plus complexe |

**ATTENTION** : ces renommages sont **destructifs** si des donnees existent en production.
- `UserDomain` a des FK directes → migration SQL necessaire
- `StatisticDefinition` / `KpiDefinition` ont des codes strings → UPDATE SQL
- 8 services seeds referencent les codes domaines
- Le frontend utilise les codes pour le routage

**Recommandation** : reporter les renommages a une migration dediee (Phase 1 Semaine 2). Ajouter les sous-domaines d'abord sur les codes existants.

### 6.4. Schema Postgres

Le modele Domain est dans le schema `governance`. Les nouveaux modeles `SubDomain` et `ValueChainCode` doivent etre dans le **meme schema** pour les FK.

### 6.5. ID technique

Domain utilise `@default(uuid())`. Le prompt propose `@default(cuid())` pour SubDomain. **Recommandation** : utiliser `@default(uuid())` pour coherence avec le reste du projet.

---

## 7. Resume des impacts

| Element | Impact | Risque |
|---------|--------|--------|
| Table `domains` | Ajout relation `subDomains SubDomain[]` | Aucun (additif) |
| Table `user_domains` | Aucun changement | Aucun |
| `StatisticDefinition` | Aucun changement | Aucun |
| `KpiDefinition` | Aucun changement | Aucun |
| Credential Service | Aucun changement immediat | Futur : endpoints SubDomain |
| Seeds | Ajouter ValueChainCode + SubDomain | Idempotent |
| Renommages domains | **A REPORTER** | Eleve si donnees en prod |

**Verdict** : l'ajout de `sub_domains` et `value_chain_codes` est **non destructif** et peut etre fait en toute securite. Les renommages de domaines necessitent une migration dediee.
