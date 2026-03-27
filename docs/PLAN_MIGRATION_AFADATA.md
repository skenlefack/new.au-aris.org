# ARIS 4.0 — Plan de Migration AfaData
# Remplacement 100% de afadata.au-ibar.org

**Version** : 1.0
**Date** : 2026-03-27
**Duree estimee** : 15 jours ouvrables (3 semaines)
**Prerequis** : ARIS 4.0 deploye sur PROD + STG

---

## Vue d'ensemble

```
Semaine 1 (J1-J5)     Semaine 2 (J6-J10)     Semaine 3 (J11-J15)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ P1: Schema DB   │   │ P4: Export       │   │ P6: Migration   │
│ P2: Referentiels│──>│ P5: Import bulk  │──>│ P7: Frontend    │
│ P3: Trade ext.  │   │                  │   │ P8: Tests finaux│
└─────────────────┘   └─────────────────┘   └─────────────────┘
     (parallele)         (depend de S1)        (depend de S2)
```

---

## PHASE 1 — Extension du modele Fisheries (J1-J3)

### Objectif
Completer le schema DB fisheries avec l'entite FishingEffort, etendre les 4 entites existantes, et ajouter les operations DELETE.

### 1.1 Nouvelle entite FishingEffort

**Fichier** : `packages/db-schemas/prisma/fisheries.prisma`

```prisma
model FishingEffort {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String   @map("tenant_id") @db.Uuid
  captureId          String?  @map("capture_id") @db.Uuid
  vesselId           String?  @map("vessel_id") @db.Uuid
  effortType         String   @map("effort_type") @db.VarChar(50)
  effortValue        Float    @map("effort_value")
  effortUnit         String   @map("effort_unit") @db.VarChar(30)
  startDate          DateTime @map("start_date") @db.Timestamptz
  endDate            DateTime @map("end_date") @db.Timestamptz
  gearType           String   @map("gear_type") @db.VarChar(50)
  crewSize           Int?     @map("crew_size")
  faoAreaCode        String?  @map("fao_area_code") @db.VarChar(20)
  dataClassification String   @default("PARTNER") @map("data_classification") @db.VarChar(20)
  createdBy          String   @map("created_by") @db.Uuid
  updatedBy          String   @map("updated_by") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([tenantId])
  @@index([vesselId])
  @@index([captureId])
  @@index([startDate])
  @@map("fishing_efforts")
  @@schema("fisheries")
}
```

**Taches** :
- [ ] Ajouter le modele dans `fisheries.prisma`
- [ ] `npx prisma db push --schema=prisma` sur STG puis PROD
- [ ] Creer `services/fisheries/src/services/effort.service.ts` (CRUD complet)
- [ ] Creer `services/fisheries/src/routes/effort.routes.ts` (5 routes)
- [ ] Creer `services/fisheries/src/schemas/effort.schema.ts` (Typebox)
- [ ] Enregistrer les routes dans `app.ts`
- [ ] Ajouter topics Kafka dans `packages/shared-types/src/kafka/topic-names.ts`

**Topics Kafka a ajouter** :
```typescript
export const TOPIC_MS_FISHERIES_EFFORT_CREATED = 'ms.fisheries.effort.created.v1';
export const TOPIC_MS_FISHERIES_EFFORT_UPDATED = 'ms.fisheries.effort.updated.v1';
export const TOPIC_MS_FISHERIES_EFFORT_DELETED = 'ms.fisheries.effort.deleted.v1';
```

**Routes** :
```
POST   /api/v1/fisheries/efforts          — Creer un effort
GET    /api/v1/fisheries/efforts          — Lister (pagine, filtres)
GET    /api/v1/fisheries/efforts/:id      — Detail
PATCH  /api/v1/fisheries/efforts/:id      — Modifier
DELETE /api/v1/fisheries/efforts/:id      — Supprimer
```

### 1.2 Extension des modeles existants

**Fichier** : `packages/db-schemas/prisma/fisheries.prisma`

#### FishCapture — ajouter :
```prisma
  fishingEnvironment String?  @map("fishing_environment") @db.VarChar(30)  // MARINE, INLAND, BRACKISH
  productionType     String?  @map("production_type") @db.VarChar(30)      // ARTISANAL, INDUSTRIAL, SUBSISTENCE
  status             String   @default("DRAFT") @db.VarChar(20)            // DRAFT, SUBMITTED, VALIDATED
```

#### FishingVessel — ajouter :
```prisma
  enginePowerKw      Float?   @map("engine_power_kw")
  crewCapacity       Int?     @map("crew_capacity")
  ownerName          String?  @map("owner_name") @db.VarChar(255)
```

#### AquacultureFarm — ajouter :
```prisma
  ownerName          String?  @map("owner_name") @db.VarChar(255)
  registrationNumber String?  @map("registration_number") @db.VarChar(100)
  totalWorkers       Int?     @map("total_workers")
  maleWorkers        Int?     @map("male_workers")
  femaleWorkers      Int?     @map("female_workers")
  pondCount          Int?     @map("pond_count")
```

#### AquacultureProduction — ajouter :
```prisma
  stockingDate       DateTime? @map("stocking_date") @db.Timestamptz
  survivalRate       Float?    @map("survival_rate")      // pourcentage 0-100
  averageWeightGrams Float?    @map("average_weight_grams")
```

**Taches** :
- [ ] Ajouter les champs ci-dessus dans `fisheries.prisma`
- [ ] Mettre a jour les schemas Typebox (create + update) pour chaque entite
- [ ] Mettre a jour les services pour prendre en compte les nouveaux champs
- [ ] `npx prisma db push --schema=prisma` sur STG puis PROD

### 1.3 Operations DELETE sur toutes les entites

**Fichiers a modifier** (5 services + 5 routes) :

| Service | Route | Methode a ajouter |
|---------|-------|-------------------|
| `capture.service.ts` | `capture.routes.ts` | `delete(id, user)` |
| `vessel.service.ts` | `vessel.routes.ts` | `delete(id, user)` |
| `aquaculture-farm.service.ts` | `aquaculture-farm.routes.ts` | `delete(id, user)` |
| `aquaculture-production.service.ts` | `aquaculture-production.routes.ts` | `delete(id, user)` |
| `effort.service.ts` (nouveau) | `effort.routes.ts` (nouveau) | `delete(id, user)` |

**Pattern DELETE** (identique pour tous) :
```typescript
async delete(id: string, user: AuthenticatedUser) {
  const record = await this.prisma.MODEL.findUnique({ where: { id } });
  if (!record) throw new HttpError(404, 'Not found');
  this.verifyTenantAccess(record.tenantId, user);
  await this.prisma.MODEL.delete({ where: { id } });
  await this.publishEvent(TOPIC_DELETED, { id, tenantId: record.tenantId }, user);
  return { data: { id, deleted: true } };
}
```

**Topics DELETE a ajouter** :
```typescript
export const TOPIC_MS_FISHERIES_CAPTURE_DELETED = 'ms.fisheries.capture.deleted.v1';
export const TOPIC_MS_FISHERIES_VESSEL_DELETED = 'ms.fisheries.vessel.deleted.v1';
export const TOPIC_MS_FISHERIES_AQUACULTURE_FARM_DELETED = 'ms.fisheries.aquaculture-farm.deleted.v1';
export const TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_DELETED = 'ms.fisheries.aquaculture-production.deleted.v1';
```

### 1.4 Seed enrichi

**Fichier** : `services/fisheries/src/seed.ts`

Ajouter :
- [ ] 8 FishingEffort (4 artisanaux, 4 industriels) lies aux captures/navires existants
- [ ] Mettre a jour les captures existantes avec `fishingEnvironment`, `productionType`, `status: 'VALIDATED'`
- [ ] Mettre a jour les fermes avec `totalWorkers`, `maleWorkers`, `femaleWorkers`, `pondCount`
- [ ] Mettre a jour les productions avec `stockingDate`, `survivalRate`, `averageWeightGrams`

### Test Phase 1
```bash
# Depuis le serveur STG
curl -s http://localhost:3022/api/v1/fisheries/efforts | jq '.meta.total'
# Attendu : 8

curl -s -X POST http://localhost:3022/api/v1/fisheries/efforts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"vesselId":"...","effortType":"DAYS_AT_SEA","effortValue":5,"effortUnit":"DAYS","startDate":"2026-03-01T00:00:00Z","endDate":"2026-03-05T00:00:00Z","gearType":"GILLNET"}'
# Attendu : 201

curl -s -X DELETE http://localhost:3022/api/v1/fisheries/captures/$ID \
  -H "Authorization: Bearer $TOKEN"
# Attendu : 200 {"data":{"id":"...","deleted":true}}
```

---

## PHASE 2 — Referentiels peche dans Master-Data (J2-J3)

### Objectif
Ajouter des tables de reference structurees pour les vocabulaires peche (au lieu de strings libres).

### 2.1 Nouvelles tables de reference

**Fichier** : `packages/db-schemas/prisma/master-data.prisma`

```prisma
model FisheryReferential {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String?  @map("tenant_id") @db.Uuid          // null = global
  category    String   @db.VarChar(30)                       // GEAR_TYPE, VESSEL_TYPE, FARM_TYPE, CULTURE_METHOD, FISHING_AREA, FISH_CATEGORY, PRODUCT_STATE
  code        String   @db.VarChar(30)                       // GILLNET, TRAWLER, POND, etc.
  name        Json                                           // { en: "Gillnet", fr: "Filet maillant", pt: "...", ar: "..." }
  description Json?                                          // description multilingue
  faoCode     String?  @map("fao_code") @db.VarChar(20)    // code FAO si applicable
  parentCode  String?  @map("parent_code") @db.VarChar(30)  // hierarchie (ex: ACTIVE > TRAWL)
  sortOrder   Int      @default(0) @map("sort_order")
  isActive    Boolean  @default(true) @map("is_active")
  metadata    Json?    @default("{}")                        // donnees supplementaires
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([category, code])
  @@index([category])
  @@index([isActive])
  @@map("fishery_referentials")
  @@schema("master_data")
}
```

### 2.2 Donnees de reference a seeder

**Fichier** : `services/master-data/src/seeds/fishery-referentials.ts`

#### GEAR_TYPE (types d'engins FAO) :
| Code | FR | EN | FAO |
|------|----|----|-----|
| GILLNET | Filet maillant | Gillnet | GN |
| SEINE | Senne | Seine net | SN |
| TRAWL | Chalut | Trawl | OTB |
| LONGLINE | Palangre | Longline | LL |
| TRAP | Nasse | Trap | FPO |
| CAST_NET | Epervier | Cast net | FCN |
| BEACH_SEINE | Senne de plage | Beach seine | SB |
| PURSE_SEINE | Senne coulissante | Purse seine | PS |
| DREDGE | Drague | Dredge | DRB |
| HOOK_LINE | Ligne a main | Hook and line | LHP |

#### VESSEL_TYPE :
| Code | FR | EN |
|------|----|----|
| ARTISANAL | Artisanal | Artisanal |
| SEMI_INDUSTRIAL | Semi-industriel | Semi-industrial |
| INDUSTRIAL | Industriel | Industrial |
| TRAWLER | Chalutier | Trawler |
| PURSE_SEINER | Senneur | Purse seiner |
| LONGLINER | Palangrier | Longliner |
| GILLNETTER | Fileyeur | Gillnetter |

#### FARM_TYPE :
| Code | FR | EN |
|------|----|----|
| POND | Bassin | Pond |
| CAGE | Cage | Cage |
| RACEWAY | Chenal | Raceway |
| TANK | Bac | Tank |
| RAS | Systeme recircule | Recirculating (RAS) |
| PEN | Enclos | Pen |

#### CULTURE_METHOD :
| Code | FR | EN |
|------|----|----|
| POND_CULTURE | Pisciculture en bassin | Pond culture |
| CAGE_CULTURE | Elevage en cage | Cage culture |
| RACEWAY_CULTURE | Elevage en chenal | Raceway culture |
| RAS_CULTURE | Systeme recircule | RAS culture |
| PEN_CULTURE | Elevage en enclos | Pen culture |
| INTEGRATED | Culture integree | Integrated culture |

#### FISHING_AREA (zones FAO majeures Afrique) :
| Code | FR | EN | FAO |
|------|----|----|-----|
| 01 | Afrique - Eaux interieures | Africa - Inland waters | 01 |
| 34 | Atlantique Centre-Est | Eastern Central Atlantic | 34 |
| 47 | Atlantique Sud-Est | Southeast Atlantic | 47 |
| 51 | Ocean Indien Ouest | Western Indian Ocean | 51 |
| 57 | Ocean Indien Est | Eastern Indian Ocean | 57 |
| 37 | Mediterranee et Mer Noire | Mediterranean and Black Sea | 37 |

#### FISH_CATEGORY (groupes d'especes) :
| Code | FR | EN |
|------|----|----|
| FINFISH | Poissons a nageoires | Finfish |
| CRUSTACEAN | Crustaces | Crustaceans |
| MOLLUSC | Mollusques | Molluscs |
| AQUATIC_PLANT | Plantes aquatiques | Aquatic plants |
| CEPHALOPOD | Cephalopodes | Cephalopods |

#### PRODUCT_STATE (etat du produit pour commerce) :
| Code | FR | EN |
|------|----|----|
| LIVE | Vivant | Live |
| FRESH | Frais | Fresh |
| FROZEN | Congele | Frozen |
| DRIED | Seche | Dried |
| SMOKED | Fume | Smoked |
| CANNED | En conserve | Canned |
| SALTED | Sale | Salted |
| FILLETED | En filets | Filleted |

**Taches** :
- [ ] Ajouter le modele `FisheryReferential` dans `master-data.prisma`
- [ ] Creer le seed `fishery-referentials.ts` avec les ~50 referentiels ci-dessus
- [ ] Creer route publique `GET /api/v1/master-data/fishery-referentials?category=GEAR_TYPE`
- [ ] Creer route admin `POST/PATCH/DELETE /api/v1/master-data/fishery-referentials`
- [ ] `npx prisma db push` sur STG puis PROD
- [ ] Seeder les referentiels

### 2.3 Enrichir Species pour l'aquatique

**Fichier** : `packages/db-schemas/prisma/master-data.prisma` — modele Species

Ajouter :
```prisma
  faoAlphaCode    String?  @map("fao_alpha_code") @db.VarChar(10)  // ex: TIL, YFT, PEN
  speciesGroup    String?  @map("species_group") @db.VarChar(30)    // FINFISH, CRUSTACEAN, MOLLUSC
  habitatType     String?  @map("habitat_type") @db.VarChar(30)     // PELAGIC, DEMERSAL, FRESHWATER
```

- [ ] Ajouter les champs
- [ ] Mettre a jour le seed species pour les especes aquatiques avec les codes FAO
- [ ] `npx prisma db push`

### Test Phase 2
```bash
curl -s http://localhost:3003/api/v1/master-data/fishery-referentials?category=GEAR_TYPE | jq '.data | length'
# Attendu : 10

curl -s http://localhost:3003/api/v1/master-data/fishery-referentials?category=FISHING_AREA | jq '.data[0].name.fr'
# Attendu : "Afrique - Eaux interieures"
```

---

## PHASE 3 — Extension Trade-SPS pour le commerce halieutique (J3-J4)

### Objectif
Adapter le service trade-sps pour couvrir les besoins specifiques du commerce de produits halieutiques d'AfaData.

### 3.1 Etendre le modele TradeFlow

**Fichier** : `packages/db-schemas/prisma/trade-sps.prisma`

Ajouter a TradeFlow :
```prisma
  productState     String?  @map("product_state") @db.VarChar(30)    // LIVE, FRESH, FROZEN, DRIED, SMOKED, CANNED
  commodityGroup   String?  @map("commodity_group") @db.VarChar(30)  // FISH, LIVESTOCK, CROP, DAIRY, OTHER
  processingLevel  String?  @map("processing_level") @db.VarChar(30) // RAW, SEMI_PROCESSED, PROCESSED
```

Ajouter index :
```prisma
  @@index([commodityGroup])
```

**Taches** :
- [ ] Ajouter les champs dans `trade-sps.prisma`
- [ ] Mettre a jour `trade-flow.schema.ts` (create + update + filter schemas)
- [ ] Ajouter filtre `?commodityGroup=FISH` dans `trade-flow.service.ts` `buildWhere()`
- [ ] Ajouter filtre `?productState=FROZEN` dans les queries
- [ ] `npx prisma db push`

### 3.2 Operations DELETE sur Trade-SPS

**Fichiers a modifier** :

| Service | Route | Topic Kafka |
|---------|-------|-------------|
| `trade-flow.service.ts` | `trade-flow.routes.ts` | `ms.trade.flow.deleted.v1` |
| `sps-certificate.service.ts` | `sps-certificate.routes.ts` | `ms.trade.sps.deleted.v1` |
| `market-price.service.ts` | `market-price.routes.ts` | `ms.trade.price.deleted.v1` |

Routes a ajouter :
```
DELETE /api/v1/trade/flows/:id
DELETE /api/v1/trade/sps-certificates/:id
DELETE /api/v1/trade/market-prices/:id
```

### 3.3 Seed commerce halieutique

**Fichier** : `services/trade-sps/src/seed.ts`

Ajouter 5 flux commerciaux halieutiques :
- Kenya → UE : Thon congele (EXPORT, FROZEN, FISH)
- Uganda → Kenya : Tilapia frais (IMPORT, FRESH, FISH)
- Senegal → Cote d'Ivoire : Sardines en conserve (EXPORT, CANNED, FISH)
- Mozambique → Afrique du Sud : Crevettes congelees (EXPORT, FROZEN, FISH)
- Maroc → Nigeria : Poisson seche (EXPORT, DRIED, FISH)

### Test Phase 3
```bash
curl -s "http://localhost:3025/api/v1/trade/flows?commodityGroup=FISH" | jq '.meta.total'
# Attendu : >= 5

curl -s -X DELETE http://localhost:3025/api/v1/trade/flows/$ID \
  -H "Authorization: Bearer $TOKEN"
# Attendu : 200 {"data":{"id":"...","deleted":true}}
```

---

## PHASE 4 — Export Excel/CSV + FishStatJ (J6-J7)

### Objectif
Permettre l'export des donnees en Excel et au format FishStatJ (FAO).

### 4.1 Module d'export generique

**Nouveau fichier** : `services/fisheries/src/services/export.service.ts`

```typescript
// Utilise exceljs pour generer .xlsx
// Pattern : query DB → transform rows → write workbook → stream response

export class ExportService {
  async exportCaptures(filters, format: 'xlsx' | 'csv'): Promise<Buffer>
  async exportVessels(filters, format): Promise<Buffer>
  async exportFarms(filters, format): Promise<Buffer>
  async exportProduction(filters, format): Promise<Buffer>
  async exportEfforts(filters, format): Promise<Buffer>
  async exportFishStatJ(year: number): Promise<Buffer>  // format FAO
}
```

**Dependance a ajouter** :
```bash
cd services/fisheries && pnpm add exceljs
```

**Routes d'export** :
```
GET /api/v1/fisheries/captures/export?format=xlsx&year=2025
GET /api/v1/fisheries/vessels/export?format=xlsx
GET /api/v1/fisheries/aquaculture/farms/export?format=xlsx
GET /api/v1/fisheries/aquaculture/production/export?format=xlsx
GET /api/v1/fisheries/efforts/export?format=xlsx
GET /api/v1/fisheries/export/fishstatj?year=2025
```

**Fichier** : `services/fisheries/src/routes/export.routes.ts`

Roles autorises : SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN, DATA_STEWARD

### 4.2 Export FishStatJ (format FAO)

**Colonnes du format FishStatJ** :
```
Country, ISSCAAP_Group, Species_Scientific, Species_FAO_Code, FAO_Area,
Production_Source, Unit, Year_2020, Year_2021, Year_2022, Year_2023, Year_2024, Year_2025
```

**Mapping ARIS → FishStatJ** :
| Champ FishStatJ | Source ARIS |
|---|---|
| Country | tenant.countryCode (ISO 3166) |
| Species_FAO_Code | species.faoAlphaCode (master-data) |
| FAO_Area | fishCapture.faoAreaCode |
| Production_Source | C (capture) ou A (aquaculture) |
| Unit | "t" (tonnes = quantityKg / 1000) |
| Year_XXXX | SUM(quantityKg) GROUP BY year |

### 4.3 Export Trade-SPS

**Nouveau fichier** : `services/trade-sps/src/services/export.service.ts`

```
GET /api/v1/trade/flows/export?format=xlsx&commodityGroup=FISH
GET /api/v1/trade/sps-certificates/export?format=xlsx
GET /api/v1/trade/market-prices/export?format=xlsx
```

**Dependance** :
```bash
cd services/trade-sps && pnpm add exceljs
```

### Test Phase 4
```bash
# Test export Excel captures
curl -s -o /tmp/captures.xlsx \
  "http://localhost:3022/api/v1/fisheries/captures/export?format=xlsx&year=2025" \
  -H "Authorization: Bearer $TOKEN"
file /tmp/captures.xlsx
# Attendu : Microsoft Excel 2007+

# Test export FishStatJ
curl -s -o /tmp/fishstatj.csv \
  "http://localhost:3022/api/v1/fisheries/export/fishstatj?year=2025" \
  -H "Authorization: Bearer $TOKEN"
head -3 /tmp/fishstatj.csv
# Attendu : Country,ISSCAAP_Group,Species,...,2025
#           KE,Tilapias and other cichlids,Oreochromis niloticus,TIL,01,C,t,45.2

# Test export trade flows poisson
curl -s -o /tmp/fish-trade.xlsx \
  "http://localhost:3025/api/v1/trade/flows/export?format=xlsx&commodityGroup=FISH" \
  -H "Authorization: Bearer $TOKEN"
file /tmp/fish-trade.xlsx
# Attendu : Microsoft Excel 2007+
```

---

## PHASE 5 — Import en masse (J8-J9)

### Objectif
Permettre l'import CSV/Excel de donnees en lots (prerequis pour la migration AfaData).

### 5.1 Module d'import generique

**Nouveau fichier** : `services/fisheries/src/services/import.service.ts`

```typescript
export class ImportService {
  async importCaptures(buffer: Buffer, format: 'xlsx' | 'csv', user): Promise<ImportResult>
  async importVessels(buffer, format, user): Promise<ImportResult>
  async importFarms(buffer, format, user): Promise<ImportResult>
  async importProduction(buffer, format, user): Promise<ImportResult>
  async importEfforts(buffer, format, user): Promise<ImportResult>
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}
```

**Routes** :
```
POST /api/v1/fisheries/captures/import        — multipart/form-data (fichier)
POST /api/v1/fisheries/vessels/import
POST /api/v1/fisheries/aquaculture/farms/import
POST /api/v1/fisheries/aquaculture/production/import
POST /api/v1/fisheries/efforts/import
```

Roles : SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN

**Logique d'import** :
1. Parser le fichier (exceljs ou csv-parse)
2. Valider chaque ligne contre le schema Typebox
3. Resoudre les references (speciesId via faoAlphaCode, geoEntityId via countryCode)
4. Inserer par batch de 100 (transaction Prisma)
5. Publier evenements Kafka pour chaque enregistrement cree
6. Retourner le rapport ImportResult

### 5.2 Import Trade-SPS

```
POST /api/v1/trade/flows/import              — multipart/form-data
POST /api/v1/trade/market-prices/import
```

### 5.3 Templates d'import

Generer des templates Excel vides avec en-tetes :
```
GET /api/v1/fisheries/captures/import/template     — retourne .xlsx vide avec en-tetes
GET /api/v1/fisheries/vessels/import/template
...
```

### Test Phase 5
```bash
# Creer un CSV de test
echo "speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite
TIL,01,GILLNET,5000,2026-01-15,Kisumu
YFT,51,LONGLINE,12000,2026-02-20,Mombasa" > /tmp/test-captures.csv

# Importer
curl -s -X POST http://localhost:3022/api/v1/fisheries/captures/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-captures.csv" | jq
# Attendu : {"imported":2,"skipped":0,"errors":[]}

# Verifier
curl -s "http://localhost:3022/api/v1/fisheries/captures?sort=createdAt&order=desc&limit=2" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Attendu : 2
```

---

## PHASE 6 — Migration des donnees AfaData (J11-J13)

### Objectif
Extraire les donnees de la base MariaDB d'AfaData et les charger dans ARIS 4.0.

### 6.1 Script d'extraction AfaData

**Nouveau fichier** : `deploy/scripts/_migrate_afadata.py`

```python
# Etape 1 : Connexion MariaDB (afadata.au-ibar.org)
# Etape 2 : Export CSV de chaque table
# Etape 3 : Mapping des IDs vers ARIS referentiels
# Etape 4 : Chargement via API bulk ou SQL direct
# Etape 5 : Verification des compteurs
```

### 6.2 Mapping des donnees

| Table AfaData (MariaDB) | Table ARIS (PostgreSQL) | Mapping cle |
|---|---|---|
| `productions` WHERE type=capture | `fisheries.fish_captures` | species.fao_code → speciesId, country → tenantId |
| `productions` WHERE type=aquaculture | `fisheries.aquaculture_production` | farm_id → farmId |
| `farms` | `fisheries.aquaculture_farms` | country → tenantId via geo |
| `vessels` | `fisheries.fishing_vessels` | registration → registrationNumber |
| `efforts` | `fisheries.fishing_efforts` | vessel → vesselId |
| `trades` | `trade_sps.trade_flows` | direction → flowDirection, state → productState |
| `species` | `master_data.species` | fao_code → faoAlphaCode |
| `species_groups` | `master_data.fishery_referentials` (FISH_CATEGORY) | name → code |

### 6.3 Procedure de migration

```
1. BACKUP AfaData MariaDB (mysqldump complet)
2. BACKUP ARIS PostgreSQL (pg_dump schemas fisheries, trade_sps, master_data)
3. Executer le script de migration en mode DRY-RUN (validation sans insert)
4. Corriger les erreurs de mapping
5. Executer en mode LIVE sur STG
6. Verification manuelle STG par l'equipe (comparer chiffres)
7. Executer en mode LIVE sur PROD
8. Verification PROD
```

### 6.4 Verification post-migration

| Verification | Query ARIS | Comparaison |
|---|---|---|
| Total captures | `SELECT COUNT(*) FROM fisheries.fish_captures` | = nombre dans AfaData |
| Total par pays | `SELECT tenant_id, COUNT(*) ... GROUP BY 1` | = repartition AfaData |
| Total aquaculture | `SELECT COUNT(*) FROM fisheries.aquaculture_production` | = AfaData |
| Total commerce | `SELECT COUNT(*) FROM trade_sps.trade_flows WHERE commodity_group='FISH'` | = AfaData trades |
| Total especes | `SELECT COUNT(*) FROM master_data.species WHERE category='AQUATIC'` | >= AfaData species |

### Test Phase 6
```bash
# Verifier les compteurs post-migration
python deploy/scripts/_migrate_afadata.py --mode=verify --env=STG
# Attendu :
# fish_captures:      AfaData=12,450  ARIS=12,450  OK
# aquaculture_prod:   AfaData=3,200   ARIS=3,200   OK
# fishing_vessels:    AfaData=890     ARIS=890      OK
# trade_flows(FISH):  AfaData=5,600   ARIS=5,600   OK
# species(AQUATIC):   AfaData=340     ARIS=340      OK
```

---

## PHASE 7 — Frontend complet (J12-J14)

### Objectif
Completer les pages frontend pour couvrir toutes les fonctionnalites AfaData.

### 7.1 Nouvelle page Efforts de peche

**Fichier** : `apps/web/src/app/(dashboard)/fisheries/efforts/page.tsx`

| Element | Detail |
|---|---|
| KPI Cards | Total efforts, Jours en mer moyens, Navires actifs |
| Filtres | Navire, Type d'effort, Engin, Periode |
| Tableau | Navire, Type, Valeur, Unite, Periode, Engin, Equipage |
| Pagination | 10/page |

### 7.2 Nouvelle page Export

**Fichier** : `apps/web/src/app/(dashboard)/fisheries/export/page.tsx`

| Element | Detail |
|---|---|
| Selection | Type de donnees (Captures, Navires, Fermes, Production, Efforts) |
| Filtres | Pays, Annee, Espece, Zone FAO |
| Format | Excel (.xlsx) ou CSV |
| FishStatJ | Bouton special "Export FishStatJ" (format FAO) |
| Action | Telecharger le fichier |

### 7.3 Nouvelle page Import

**Fichier** : `apps/web/src/app/(dashboard)/fisheries/import/page.tsx`

| Element | Detail |
|---|---|
| Selection | Type de donnees a importer |
| Template | Bouton "Telecharger le template" |
| Upload | Zone drag & drop pour fichier CSV/Excel |
| Validation | Affichage en temps reel des erreurs de validation |
| Resultat | Rapport : X importes, Y ignores, Z erreurs |

### 7.4 Vue commerce halieutique

**Fichier** : `apps/web/src/app/(dashboard)/fisheries/trade/page.tsx`

Vue filtree des TradeFlow avec `commodityGroup=FISH` :

| Element | Detail |
|---|---|
| KPI Cards | Export poisson total, Import poisson total, Balance |
| Filtres | Pays, Espece, Etat produit, Direction, Periode |
| Tableau | Exportateur, Importateur, Espece, Etat, Quantite, Valeur, Periode |
| Graphique | Top 5 especes commercees |

### 7.5 Dashboard fisheries enrichi

**Fichier** : `apps/web/src/app/(dashboard)/fisheries/page.tsx`

Ajouter :
- [ ] KPI "Effort total de peche" (jours en mer)
- [ ] KPI "Commerce poisson" (volume import/export)
- [ ] Graphique "Top 10 especes capturees" (bar chart horizontal)
- [ ] Liens rapides vers Efforts, Export, Import, Commerce
- [ ] Carte PostGIS des zones de capture (future, optionnel)

### 7.6 Hooks API

**Fichier** : `apps/web/src/lib/api/hooks.ts`

Ajouter :
```typescript
// Efforts
export function useFishingEfforts(params?) { ... }
export function useCreateEffort() { ... }
export function useUpdateEffort() { ... }
export function useDeleteEffort() { ... }

// Export
export function useExportCaptures(params?) { ... }
export function useExportFishStatJ(year?) { ... }

// Import
export function useImportCaptures() { ... }
export function useImportTemplate(entity?) { ... }

// Trade (filtered for fish)
export function useFishTrade(params?) { ... }

// Delete hooks for existing entities
export function useDeleteCapture() { ... }
export function useDeleteVessel() { ... }
export function useDeleteFarm() { ... }
export function useDeleteProduction() { ... }
```

### 7.7 Traductions i18n

**Fichiers** : `apps/web/src/messages/{en,fr,pt,ar}.json`

Ajouter section `fisheries` :
```json
{
  "fisheries": {
    "efforts": "Fishing Effort",
    "effortType": "Effort Type",
    "daysAtSea": "Days at Sea",
    "export": "Export Data",
    "import": "Import Data",
    "fishStatJ": "FishStatJ Export (FAO)",
    "fishTrade": "Fish Trade",
    "productState": "Product State",
    "fresh": "Fresh",
    "frozen": "Frozen",
    "dried": "Dried",
    "smoked": "Smoked",
    "canned": "Canned",
    "template": "Download Template",
    "importResult": "Import Result",
    "imported": "Records imported",
    "skipped": "Records skipped",
    "errors": "Errors"
  }
}
```

### Test Phase 7
```
Navigation manuelle :
1. /fisheries           → Dashboard avec 6 KPI + graphiques
2. /fisheries/captures  → Table avec filtres etendus + bouton DELETE
3. /fisheries/vessels   → Table avec colonnes moteur, equipage, proprietaire
4. /fisheries/aquaculture → Table avec travailleurs, bassins
5. /fisheries/efforts   → NOUVELLE page, table des efforts
6. /fisheries/export    → NOUVELLE page, telechargement Excel/CSV/FishStatJ
7. /fisheries/import    → NOUVELLE page, upload + validation + rapport
8. /fisheries/trade     → NOUVELLE page, commerce poisson filtre
```

---

## PHASE 8 — Tests de fonctionnement finaux (J15)

### 8.1 Tests unitaires backend

**Fichiers de test a creer/mettre a jour** :

| Fichier | Tests |
|---------|-------|
| `services/fisheries/src/__tests__/effort.service.spec.ts` | CRUD FishingEffort (6 tests) |
| `services/fisheries/src/__tests__/capture-vessel.service.spec.ts` | Ajouter DELETE tests (2 tests) |
| `services/fisheries/src/__tests__/aquaculture.service.spec.ts` | Ajouter DELETE tests (2 tests) |
| `services/fisheries/src/__tests__/export.service.spec.ts` | Export Excel + FishStatJ (4 tests) |
| `services/fisheries/src/__tests__/import.service.spec.ts` | Import CSV valide + erreurs (4 tests) |
| `services/trade-sps/src/__tests__/trade-sps.spec.ts` | Ajouter DELETE + filtre FISH (3 tests) |
| `services/master-data/src/__tests__/fishery-ref.spec.ts` | CRUD referentiels (4 tests) |

**Execution** :
```bash
cd services/fisheries && pnpm test
cd services/trade-sps && pnpm test
cd services/master-data && pnpm test
```

**Couverture cible** : >= 80% sur les fichiers modifies

### 8.2 Tests d'integration API (STG)

**Script** : `deploy/scripts/_test_afadata_migration.py`

```python
"""
Tests d'integration end-to-end sur l'environnement STG.
Valide l'ensemble des fonctionnalites AfaData dans ARIS 4.0.
"""

# 1. AUTH
#    - Login admin@au-aris.org → token JWT
#    - Login admin@ke.au-aris.org → token Kenya

# 2. REFERENTIELS (master-data :3003)
TEST_REF_01 = "GET /api/v1/master-data/fishery-referentials?category=GEAR_TYPE → 200, >= 10 items"
TEST_REF_02 = "GET /api/v1/master-data/fishery-referentials?category=VESSEL_TYPE → 200, >= 7 items"
TEST_REF_03 = "GET /api/v1/master-data/fishery-referentials?category=FARM_TYPE → 200, >= 6 items"
TEST_REF_04 = "GET /api/v1/master-data/fishery-referentials?category=FISHING_AREA → 200, >= 6 items"
TEST_REF_05 = "GET /api/v1/master-data/fishery-referentials?category=FISH_CATEGORY → 200, >= 5 items"
TEST_REF_06 = "GET /api/v1/master-data/fishery-referentials?category=PRODUCT_STATE → 200, >= 8 items"

# 3. CAPTURES (fisheries :3022)
TEST_CAP_01 = "GET /api/v1/fisheries/captures → 200, pagine"
TEST_CAP_02 = "POST /api/v1/fisheries/captures (nouveau) → 201"
TEST_CAP_03 = "GET /api/v1/fisheries/captures/:id → 200, champs etendus (fishingEnvironment, productionType, status)"
TEST_CAP_04 = "PATCH /api/v1/fisheries/captures/:id → 200"
TEST_CAP_05 = "DELETE /api/v1/fisheries/captures/:id → 200"
TEST_CAP_06 = "GET /api/v1/fisheries/captures/:id (apres delete) → 404"

# 4. NAVIRES (fisheries :3022)
TEST_VES_01 = "GET /api/v1/fisheries/vessels → 200"
TEST_VES_02 = "POST /api/v1/fisheries/vessels (avec enginePowerKw, crewCapacity) → 201"
TEST_VES_03 = "PATCH /api/v1/fisheries/vessels/:id → 200"
TEST_VES_04 = "DELETE /api/v1/fisheries/vessels/:id → 200"

# 5. FERMES AQUACOLES (fisheries :3022)
TEST_FARM_01 = "GET /api/v1/fisheries/aquaculture/farms → 200"
TEST_FARM_02 = "POST /api/v1/fisheries/aquaculture/farms (avec workers, pondCount) → 201"
TEST_FARM_03 = "DELETE /api/v1/fisheries/aquaculture/farms/:id → 200"

# 6. PRODUCTION AQUACOLE (fisheries :3022)
TEST_PROD_01 = "GET /api/v1/fisheries/aquaculture/production → 200"
TEST_PROD_02 = "POST /api/v1/fisheries/aquaculture/production (avec stockingDate, survivalRate) → 201"
TEST_PROD_03 = "DELETE /api/v1/fisheries/aquaculture/production/:id → 200"

# 7. EFFORT DE PECHE (fisheries :3022) — NOUVEAU
TEST_EFF_01 = "GET /api/v1/fisheries/efforts → 200"
TEST_EFF_02 = "POST /api/v1/fisheries/efforts → 201"
TEST_EFF_03 = "GET /api/v1/fisheries/efforts/:id → 200"
TEST_EFF_04 = "PATCH /api/v1/fisheries/efforts/:id → 200"
TEST_EFF_05 = "DELETE /api/v1/fisheries/efforts/:id → 200"

# 8. COMMERCE HALIEUTIQUE (trade-sps :3025)
TEST_TRD_01 = "GET /api/v1/trade/flows?commodityGroup=FISH → 200, filtre OK"
TEST_TRD_02 = "POST /api/v1/trade/flows (productState=FROZEN, commodityGroup=FISH) → 201"
TEST_TRD_03 = "DELETE /api/v1/trade/flows/:id → 200"

# 9. EXPORT (fisheries :3022)
TEST_EXP_01 = "GET /api/v1/fisheries/captures/export?format=xlsx → 200, Content-Type application/vnd.openxmlformats"
TEST_EXP_02 = "GET /api/v1/fisheries/vessels/export?format=csv → 200, Content-Type text/csv"
TEST_EXP_03 = "GET /api/v1/fisheries/export/fishstatj?year=2025 → 200, format CSV FAO valide"
TEST_EXP_04 = "GET /api/v1/trade/flows/export?format=xlsx&commodityGroup=FISH → 200"

# 10. IMPORT (fisheries :3022)
TEST_IMP_01 = "GET /api/v1/fisheries/captures/import/template → 200, .xlsx vide avec en-tetes"
TEST_IMP_02 = "POST /api/v1/fisheries/captures/import (CSV valide 5 lignes) → 200, imported=5"
TEST_IMP_03 = "POST /api/v1/fisheries/captures/import (CSV avec erreurs) → 200, errors.length > 0"

# 11. MULTI-TENANT
TEST_MT_01 = "Login admin@ke.au-aris.org → GET captures → voit uniquement ses donnees Kenya"
TEST_MT_02 = "Login admin@au-aris.org → GET captures → voit TOUTES les donnees (continental)"
TEST_MT_03 = "Login admin@ke.au-aris.org → DELETE capture d'un autre pays → 403"

# 12. DONNEES MIGREES (post Phase 6)
TEST_MIG_01 = "COUNT fish_captures >= seuil_AfaData"
TEST_MIG_02 = "COUNT aquaculture_production >= seuil_AfaData"
TEST_MIG_03 = "COUNT fishing_vessels >= seuil_AfaData"
TEST_MIG_04 = "COUNT trade_flows WHERE commodity_group='FISH' >= seuil_AfaData"
```

### 8.3 Tests frontend (navigation manuelle)

| # | Page | Verification |
|---|------|--------------|
| F01 | `/fisheries` | 6 KPI affiches, graphique tendances, liens rapides vers 7 sous-pages |
| F02 | `/fisheries/captures` | Table paginees, filtres (espece, engin, environnement, annee), bouton supprimer |
| F03 | `/fisheries/vessels` | Table avec colonnes moteur, equipage, proprietaire, licence |
| F04 | `/fisheries/aquaculture` | Table avec travailleurs, bassins, statut |
| F05 | `/fisheries/efforts` | Table efforts, filtres navire/type/periode |
| F06 | `/fisheries/trade` | Commerce poisson filtre, graphique top especes |
| F07 | `/fisheries/export` | Telecharger Excel, CSV, FishStatJ — fichier valide |
| F08 | `/fisheries/import` | Upload CSV, validation en direct, rapport importation |
| F09 | `/trade/flows` | Filtre commodityGroup=FISH fonctionne |
| F10 | Changement de langue | Toutes les pages fisheries traduites EN/FR/PT/AR |

### 8.4 Checklist de validation finale

```
VALIDATION TECHNIQUE
[ ] Tous les tests unitaires passent (vitest)
[ ] 42 tests d'integration API passent (script Python)
[ ] 10 tests frontend OK (navigation manuelle)
[ ] Export Excel ouvrable dans Microsoft Excel
[ ] Export FishStatJ conforme au format FAO
[ ] Import CSV 1000 lignes < 30 secondes
[ ] DELETE cascade OK (pas d'orphelins)
[ ] Kafka events publies pour chaque mutation

VALIDATION FONCTIONNELLE (avec equipe AU-IBAR)
[ ] Comparer ecran captures AfaData vs ARIS → equivalent
[ ] Comparer ecran aquaculture AfaData vs ARIS → equivalent
[ ] Comparer ecran commerce AfaData vs ARIS → equivalent
[ ] Comparer export Excel AfaData vs ARIS → memes colonnes
[ ] Donnees migrees coherentes (compteurs identiques)
[ ] Utilisateurs nationaux peuvent saisir des donnees
[ ] Utilisateurs REC voient les donnees de leurs pays membres
[ ] AU-IBAR (continental) voit toutes les donnees

VALIDATION SECURITE
[ ] Routes protegees par JWT (401 sans token)
[ ] RBAC respecte (FIELD_AGENT ne peut pas supprimer)
[ ] Isolation tenant (pays A ne voit pas pays B)
[ ] DataClassification appliquee (PARTNER/RESTRICTED)

DEPLOIEMENT
[ ] Schema DB mis a jour sur STG
[ ] Seed referentiels OK sur STG
[ ] Service fisheries rebuild sur STG
[ ] Service trade-sps rebuild sur STG
[ ] Service master-data rebuild sur STG
[ ] Frontend web rebuild sur STG
[ ] Tests OK sur STG
[ ] Meme procedure sur PROD
[ ] DNS afadata.au-ibar.org → redirection vers au-aris.org/fisheries
```

---

## Recapitulatif des livrables

| Phase | Livrables | Fichiers crees/modifies | Jours |
|:---:|---|---|:---:|
| **1** | FishingEffort + extensions + DELETE | 15 fichiers (schema, services, routes, schemas, seed, topics) | 3 |
| **2** | Referentiels peche + Species enrichi | 5 fichiers (schema, service, routes, seed, types) | 2 |
| **3** | Trade-SPS extensions + DELETE | 8 fichiers (schema, services, routes, schemas, seed) | 2 |
| **4** | Export Excel/CSV/FishStatJ | 6 fichiers (2 services, 2 routes, dep exceljs) | 2 |
| **5** | Import bulk CSV/Excel | 4 fichiers (2 services, 2 routes, templates) | 2 |
| **6** | Migration donnees AfaData → ARIS | 1 script Python + procedure | 2 |
| **7** | Frontend (4 pages + hooks + i18n) | 12 fichiers (pages, hooks, messages) | 3 |
| **8** | Tests (unit + integration + frontend) | 8 fichiers tests + 1 script validation | 1 |
| | **TOTAL** | **~60 fichiers** | **15 j** |

---

## Dependances entre phases

```
Phase 1 ─────┐
Phase 2 ─────┼──> Phase 4 (export) ──┐
Phase 3 ─────┘    Phase 5 (import) ──┼──> Phase 6 (migration) ──> Phase 8 (tests)
                                     │
                                     └──> Phase 7 (frontend) ────> Phase 8 (tests)
```

Phases 1, 2, 3 sont **independantes** et peuvent etre executees en parallele.
Phase 8 est la derniere et depend de toutes les autres.

---

## Critere d'arret d'AfaData

AfaData (`afadata.au-ibar.org`) peut etre arrete quand :
1. Tous les tests Phase 8 passent (technique + fonctionnel + securite)
2. Les donnees migrees sont validees par l'equipe AU-IBAR
3. Les utilisateurs nationaux ont ete formes sur la nouvelle interface
4. Un redirect HTTP 301 `afadata.au-ibar.org → au-aris.org/fisheries` est en place
5. Une periode de double-run de 2 semaines est terminee sans incident
