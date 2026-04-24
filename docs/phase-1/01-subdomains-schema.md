# Schema Sub-Domains & Value Chain Codes — ARIS 4.0

**Date** : 2026-04-24
**Phase** : 1 Semaine 1
**Schema Postgres** : `governance`

## 1. Architecture

```
Domain (existant, 9 domaines)
  └─ SubDomain[] (nouveau, N..1)
       └─ ValueChainCode? (optionnel, tag transverse)
```

- **2 niveaux maximum** : Domain → SubDomain. Pas de sub-sub-domain.
- **Tag transverse** : `valueChainCode` permet de regrouper des sous-domaines de domaines differents (ex: DAIRY sous livestock-prod ET DAIRY_TRADE sous trade-sps partagent le code `DAIRY`).
- **Feature flag** : `active = false` pour les sous-domaines hors projet (ex: APICULTURE).

## 2. Tables ajoutees

### `value_chain_codes`

| Colonne | Type | Description |
|---------|------|-------------|
| code (PK) | VARCHAR(30) | Code stable SCREAMING_SNAKE |
| label_fr | TEXT | Label francais |
| label_en | TEXT | Label anglais |
| label_ar | TEXT? | Label arabe (nullable v1) |
| label_pt | TEXT? | Label portugais (nullable v1) |
| active | BOOLEAN | Default true |
| display_order | INT | Ordre d'affichage |

### `sub_domains`

| Colonne | Type | Description |
|---------|------|-------------|
| id (PK) | UUID | ID technique |
| code | VARCHAR(50) | Code SCREAMING_SNAKE |
| domain_id (FK) | UUID | → domains.id (CASCADE) |
| value_chain_code (FK) | VARCHAR(30)? | → value_chain_codes.code (SET NULL) |
| label_fr, label_en | TEXT | Labels bilingues |
| label_ar, label_pt | TEXT? | Labels optionnels |
| type_enum | SubDomainType | VALUE_CHAIN / ORGANIZATIONAL / PATHOLOGY / OTHER |
| active | BOOLEAN | Feature flag |
| display_order | INT | Ordre d'affichage |
| description | TEXT? | Description libre |

**Index** : `(domain_id, code)` UNIQUE, `(value_chain_code)`, `(domain_id, active, display_order)`

### Enum `SubDomainType`

- `VALUE_CHAIN` : Chaine de valeur (Dairy, Red meat...)
- `ORGANIZATIONAL` : Structure organisationnelle (Clinics, Labs...)
- `PATHOLOGY` : Pathologie (PPR, FMD, ASF...)
- `OTHER` : Autre

## 3. Donnees initiales

### 7 Value Chain Codes

| Code | FR | EN |
|------|----|----|
| DAIRY | Lait | Dairy |
| RED_MEAT | Viande rouge | Red meat |
| POULTRY | Volaille | Poultry |
| PORK | Porc | Pork |
| SMALL_RUMINANTS | Petits ruminants | Small ruminants |
| FISHERIES_AQUA | Peche et aquaculture | Fisheries & aquaculture |
| APICULTURE | Apiculture | Apiculture |

### 18 Sub-Domains (3 domaines)

**livestock-prod** (6 VALUE_CHAIN) : DAIRY, RED_MEAT, POULTRY, PORK, SMALL_RUMINANTS, APICULTURE (inactive)

**governance** (6 ORGANIZATIONAL) : CLINICS, SLAUGHTERHOUSES, LEGAL_FRAMEWORKS, VACCINATION, SURVEILLANCE, LABORATORIES

**trade-sps** (6 VALUE_CHAIN) : DAIRY_TRADE, RED_MEAT_TRADE, POULTRY_TRADE, PORK_TRADE, SMALL_RUMINANTS_TRADE, FISHERIES_TRADE

## 4. Vue transverse

```sql
-- Tous les sous-domaines lies a la chaine "Lait"
SELECT sd.*, d.code as domain_code
FROM sub_domains sd
JOIN domains d ON d.id = sd.domain_id
WHERE sd.value_chain_code = 'DAIRY';

-- Resultat : DAIRY (livestock-prod) + DAIRY_TRADE (trade-sps)
```

## 5. Impact sur l'existant

- Table `domains` : ajout relation `subDomains SubDomain[]` (non destructif)
- Table `user_domains` : aucun changement
- Services existants : aucun changement
- Pas de renommage de domaines dans cette phase

## 6. Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `packages/db-schemas/prisma/settings.prisma` | +3 modeles (ValueChainCode, SubDomainType, SubDomain) + relation inverse Domain |
| `packages/db-schemas/prisma/seed-settings.ts` | +seedValueChainCodes() +seedSubDomains() |
| `services/credential/src/__tests__/sub-domains.spec.ts` | 18 tests |
