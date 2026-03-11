# ARIS 4.0 — Data Dictionary v0
# Master Data Referentials — Structure initiale Phase 0

## 1. Geography (geo_entities)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| id | UUID | Primary key | Auto |
| code | VARCHAR(20) | ISO 3166-1 alpha-2 (country), GADM code (admin) | ISO/GADM |
| name | VARCHAR(200) | Official name (local) | National |
| name_en | VARCHAR(200) | English name | UN |
| name_fr | VARCHAR(200) | French name | UN |
| level | ENUM | COUNTRY, ADMIN1, ADMIN2, ADMIN3, SPECIAL_ZONE | ARIS |
| parent_id | UUID FK | Parent entity | Hierarchy |
| country_code | VARCHAR(2) | ISO 3166-1 alpha-2 of containing country | ISO |
| geometry | GEOMETRY | PostGIS polygon/multipolygon (SRID 4326) | GADM |
| centroid | POINT | Center point | Computed |
| population | INTEGER | Human population (latest census) | UN/National |
| is_active | BOOLEAN | Active flag | ARIS |
| version | INTEGER | Version number | ARIS |
| created_at | TIMESTAMPTZ | Creation timestamp | Auto |
| updated_at | TIMESTAMPTZ | Last update | Auto |

### Seed: 55 AU Member States
```
DZ,BJ,BW,BF,BI,CV,CM,CF,TD,KM,CG,CD,CI,DJ,EG,GQ,ER,SZ,ET,GA,GM,GH,GN,GW,KE,
LS,LR,LY,MG,MW,ML,MR,MU,MA,MZ,NA,NE,NG,RW,ST,SN,SC,SL,SO,ZA,SS,SD,TZ,TG,TN,
UG,ZM,ZW
```

### Seed: 8 RECs
| Code | Name | Members |
|------|------|---------|
| IGAD | Intergovernmental Authority on Development | DJ,ER,ET,KE,SO,SS,SD,UG |
| ECOWAS | Economic Community of West African States | BJ,BF,CV,CI,GM,GH,GN,GW,LR,ML,NE,NG,SN,SL,TG |
| SADC | Southern African Development Community | BW,CD,KM,SZ,LS,MG,MW,MU,MZ,NA,SC,ZA,TZ,ZM,ZW |
| EAC | East African Community | BI,CD,KE,RW,SS,TZ,UG |
| ECCAS | Economic Community of Central African States | AO,BI,CM,CF,TD,CG,CD,GQ,GA,RW,ST |
| UMA | Arab Maghreb Union | DZ,LY,MR,MA,TN |
| CEN-SAD | Community of Sahel-Saharan States | BF,CF,TD,KM,CI,DJ,EG,ER,GM,GH,GN,GW,KE,LR,LY,ML,MR,MA,NE,NG,SN,SL,SO,SD,TG,TN |
| COMESA | Common Market for Eastern and Southern Africa | BI,KM,CD,DJ,EG,ER,SZ,ET,KE,MG,MW,MU,RW,SC,SO,SD,TN,UG,ZM,ZW |

## 2. Species (species)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(20) | WOAH/FAO code |
| scientific_name | VARCHAR(200) | Latin binomial |
| common_name_en | VARCHAR(200) | English |
| common_name_fr | VARCHAR(200) | French |
| category | ENUM | DOMESTIC, WILDLIFE, AQUATIC, APICULTURE |
| production_categories | TEXT[] | dairy, beef, draught, wool, eggs, etc. |
| is_woah_listed | BOOLEAN | On WOAH species list |
| fao_code | VARCHAR(20) | FAOSTAT species code |
| version | INTEGER | Version |

### Seed: Top 30 Domestic Species
```
Cattle (Bos taurus/indicus), Sheep (Ovis aries), Goats (Capra hircus),
Chickens (Gallus gallus domesticus), Ducks (Anas platyrhynchos domesticus),
Pigs (Sus scrofa domesticus), Camels (Camelus dromedarius + bactrianus),
Horses (Equus caballus), Donkeys (Equus asinus), Rabbits (Oryctolagus cuniculus),
Turkeys (Meleagris gallopavo), Guinea fowl (Numida meleagris),
Pigeons (Columba livia domestica), Geese (Anser anser domesticus),
Buffalo (Bubalus bubalis)
```

### Seed: Top 10 Wildlife Species (Africa-relevant)
```
African Elephant (Loxodonta africana), African Lion (Panthera leo),
Hippopotamus (Hippopotamus amphibius), Giraffe (Giraffa camelopardalis),
African Wild Dog (Lycaon pictus), Cheetah (Acinonyx jubatus),
Mountain Gorilla (Gorilla beringei), African Penguin (Spheniscus demersus),
Pangolin (Manis spp.), Vulture (Gyps africanus)
```

### Seed: Top 10 Aquatic Species
```
Nile Tilapia (Oreochromis niloticus), Nile Perch (Lates niloticus),
Catfish (Clarias gariepinus), Sardine (Sardinella spp.),
Tuna (Thunnus spp.), Shrimp (Penaeus spp.),
Carp (Cyprinus carpio), Mackerel (Scomber spp.),
Octopus (Octopus vulgaris), Lobster (Panulirus spp.)
```

## 3. Diseases (diseases)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(20) | WAHIS-aligned code |
| name_en | VARCHAR(200) | English |
| name_fr | VARCHAR(200) | French |
| is_woah_listed | BOOLEAN | On WOAH notifiable list |
| affected_species | UUID[] | Species IDs |
| is_notifiable | BOOLEAN | National notification required |
| wahis_category | VARCHAR(50) | WAHIS disease category |
| agent_type | ENUM | VIRUS, BACTERIA, PARASITE, PRION, FUNGUS, OTHER |
| is_zoonotic | BOOLEAN | Zoonotic potential |
| version | INTEGER | Version |

### Seed: Top 30 WOAH-Listed Diseases (Africa priority)
```
Foot and mouth disease (FMD), Peste des petits ruminants (PPR),
Rinderpest (eradicated — monitoring), Contagious bovine pleuropneumonia (CBPP),
African swine fever (ASF), Highly pathogenic avian influenza (HPAI),
Newcastle disease, Rift Valley fever (RVF), Rabies,
Lumpy skin disease (LSD), Sheep pox/Goat pox, Anthrax,
Brucellosis, Bovine tuberculosis, Trypanosomiasis,
East Coast fever (Theileriosis), Heartwater (Cowdriosis),
Epizootic hemorrhagic disease, Bluetongue, African horse sickness,
Dourine, Glanders, Equine influenza,
Caprine arthritis/encephalitis, Scrapie,
Avian mycoplasmosis, Infectious bursal disease,
Epizootic ulcerative syndrome, Spring viraemia of carp,
White spot disease (shrimp)
```

## 4. Units (units)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(20) | Standard code |
| name_en | VARCHAR(100) | English |
| name_fr | VARCHAR(100) | French |
| category | ENUM | COUNT, WEIGHT, VOLUME, AREA, LENGTH, TIME, RATE, CURRENCY |
| si_equivalent | VARCHAR(50) | SI conversion |

### Seed
```
COUNT: heads, doses, samples, holdings, flocks, herds, licenses, trips
WEIGHT: kg, tonnes, g, mg
VOLUME: liters, ml, m³
AREA: km², ha, m²
LENGTH: km, m
TIME: days, months, years
RATE: %, per_1000, per_10000, per_100000
CURRENCY: USD, EUR, XOF, KES, ETB, NGN, ZAR
```

## 5. Denominators (denominators)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| country_code | VARCHAR(2) | ISO country |
| species_id | UUID FK | Species reference |
| year | INTEGER | Reference year |
| source | ENUM | FAOSTAT, NATIONAL_CENSUS, ESTIMATE |
| population | BIGINT | Animal population count |
| assumptions | TEXT | Methodology documentation |
| confidence | ENUM | HIGH, MEDIUM, LOW |
| version | INTEGER | Version |
| validated_at | TIMESTAMPTZ | Validation date |
| validated_by | UUID FK | Validator user |

### Seed: Pilot Countries (FAOSTAT 2022 estimates — illustrative)
| Country | Cattle | Sheep | Goats | Chickens | Camels |
|---------|--------|-------|-------|----------|--------|
| Kenya | 18.5M | 19.3M | 17.4M | 46.2M | 3.4M |
| Ethiopia | 70.3M | 42.9M | 52.5M | 57.1M | 7.6M |
| Nigeria | 20.9M | 43.4M | 84.5M | 180.0M | 0.3M |
| Senegal | 3.7M | 6.4M | 6.0M | 52.0M | 0.5M |
| South Africa | 12.7M | 22.8M | 5.9M | 189.0M | — |

## 6. Identifiers (identifiers)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| type | ENUM | LAB, MARKET, BORDER_POINT, PROTECTED_AREA, SLAUGHTERHOUSE, QUARANTINE |
| code | VARCHAR(50) | Unique code |
| name | VARCHAR(200) | Name |
| country_code | VARCHAR(2) | Country |
| geo_entity_id | UUID FK | Location reference |
| coordinates | POINT | GPS coordinates |
| capacity | VARCHAR(100) | Capacity description |
| is_active | BOOLEAN | Active |
| version | INTEGER | Version |

## Data Classification Default per Referential
| Referential | Default Classification |
|-------------|----------------------|
| Geography | PUBLIC |
| Species | PUBLIC |
| Diseases | PUBLIC |
| Units | PUBLIC |
| Denominators | PARTNER (national figures may be sensitive) |
| Identifiers | RESTRICTED (lab/border locations) |
