# ARIS 4.0 — Guide de Session d'Interoperabilite
## Protocole de Discussion avec les Etats Membres

---

**Union Africaine — Bureau Interafricain des Ressources Animales (UA-BIRA)**
**Systeme d'Information sur les Ressources Animales (ARIS) 4.0**
**Document de Reference pour les Sessions d'Interoperabilite Pays**

---

## Table des Matieres

1. [Introduction et Contexte](#1-introduction-et-contexte)
2. [Architecture ARIS — Vue d'Ensemble](#2-architecture-aris--vue-densemble)
3. [Les 3 Modeles d'Integration](#3-les-3-modeles-dintegration)
4. [Contrat de Donnees (Data Contract)](#4-contrat-de-donnees-data-contract)
5. [Referentiels et Standards](#5-referentiels-et-standards)
6. [Quality Gates — Garantie de Qualite](#6-quality-gates--garantie-de-qualite)
7. [Securite et Gouvernance des Donnees](#7-securite-et-gouvernance-des-donnees)
8. [Deroulement de la Session](#8-deroulement-de-la-session)
9. [Fiche Technique par Modele](#9-fiche-technique-par-modele)
10. [Livrables de la Session](#10-livrables-de-la-session)
11. [Annexes](#11-annexes)

---

## 1. Introduction et Contexte

### 1.1 Pourquoi l'Interoperabilite ?

L'Union Africaine, a travers l'UA-BIRA, a developpe ARIS 4.0 comme infrastructure numerique continentale pour les ressources animales. L'objectif n'est **pas de remplacer** les systemes nationaux existants, mais de les **federer** pour permettre :

- **Un reporting harmonise** vers les organisations internationales (OMSA/WAHIS, FAO/EMPRES, FAOSTAT)
- **Une vue continentale** agregee pour l'aide a la decision (Agenda 2063, LiDeSA, PFRS)
- **L'elimination de la double saisie** — le pays saisit dans son systeme, ARIS consolide automatiquement
- **Le renforcement mutuel** — les quality gates ARIS ameliorent la qualite des donnees nationales

### 1.2 Principes Fondamentaux

| Principe | Description |
|----------|-------------|
| **Souverainete des donnees** | Chaque pays reste proprietaire et maitre de ses donnees. ARIS consolide, ne remplace pas. |
| **Subsidiarite federee** | Les donnees sont produites et validees au niveau national. ARIS consolide aux niveaux REC et continental. |
| **Report once, use many** | Une seule saisie au niveau pays → WAHIS, EMPRES, FAOSTAT, dashboards, CAADP automatiquement. |
| **Interoperabilite par design** | Standards internationaux (OMSA, FAO, ISO) comme pivot, pas de format proprietaire. |
| **Progressivite** | Commencer par 1 domaine pilote, pas tout d'un coup. Monter en puissance graduellement. |

### 1.3 Les 9 Domaines Couverts par ARIS

| # | Domaine | Exemples de Donnees |
|---|---------|---------------------|
| 1 | **Sante Animale & One Health** | Foyers, surveillance, laboratoires, vaccination, RAM |
| 2 | **Elevage & Pastoralisme** | Recensement, systemes de production, transhumance |
| 3 | **Peche & Aquaculture** | Captures, flotte, licences, production aquacole |
| 4 | **Commerce & SPS** | Flux commerciaux, certification SPS, marches |
| 5 | **Faune Sauvage & Biodiversite** | Inventaires, aires protegees, CITES |
| 6 | **Apiculture & Pollinisation** | Ruchers, production de miel, sante des colonies |
| 7 | **Gouvernance & Capacites** | Cadres juridiques, services veterinaires, PVS |
| 8 | **Climat & Environnement** | Stress hydrique, paturages, GES |
| 9 | **Gestion des Connaissances** | Portail, e-repository, briefs |

---

## 2. Architecture ARIS — Vue d'Ensemble

### 2.1 Architecture Federee

```
┌─────────────────────────────────────────────────────────┐
│                    UA-BIRA (Continental)                 │
│                         ARIS 4.0                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Analytics │  │ Quality  │  │ Workflow │  │ Export │  │
│  │ & KPIs   │  │ Gates    │  │ 4-Level  │  │ WAHIS  │  │
│  └──────────┘  └──────────┘  └──────────┘  │ EMPRES │  │
│                                            │ FAOSTAT│  │
│                                            └────────┘  │
├─────────────────────────────────────────────────────────┤
│              Couche d'Interoperabilite                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              INTEROP HUB                         │   │
│  │  API Push │ API Pull │ File Upload │ Mapping     │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│    │Kenya │  │Ethio.│  │Niger.│  │Seneg.│  │ ...  │   │
│    │KLHIS │  │AIHMS │  │NADIS │  │SIMBA │  │      │   │
│    └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   │
│         Systemes Nationaux Existants                    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Flux de Donnees

```
Systeme National → Interop Hub → Quality Gates → Domain Service → Workflow → Analytics
                                     │                                        │
                                     ▼                                        ▼
                              Correction Loop                          WAHIS / EMPRES
                              (si rejet)                               FAOSTAT / Dashboards
```

### 2.3 Pile Technologique

| Composant | Technologie | Role |
|-----------|-------------|------|
| Backend | NestJS + TypeScript | Microservices (22 services) |
| Base de donnees | PostgreSQL 16 + PostGIS | Stockage + geospatial |
| Bus evenementiel | Apache Kafka | Communication inter-services |
| Cache | Redis 7 | Performance + invalidation |
| Stockage fichiers | MinIO (S3-compatible) | Documents, exports |
| API Gateway | Traefik v3 | Routage, TLS, rate limiting |
| Authentification | JWT RS256 + MFA TOTP | Securite |
| Mobile | Kotlin + Jetpack Compose | Collecte terrain (offline) |
| Frontend | Next.js 14 + React | Interface web |

---

## 3. Les 3 Modeles d'Integration

Chaque pays choisit le modele qui correspond a sa maturite numerique. Les modeles ne sont pas exclusifs — un pays peut utiliser le Modele A pour la sante animale et le Modele C pour les pecheries.

### 3.1 Modele A — API Push (Systeme Moderne)

**Le pays pousse les donnees vers ARIS en temps reel ou periodiquement.**

```
┌──────────────┐     HTTPS/REST      ┌──────────────┐
│   Systeme    │ ──────────────────▶  │  ARIS        │
│   National   │   JSON standard      │  Interop Hub │
│              │ ◀──────────────────  │              │
│              │   Validation result  │              │
└──────────────┘                      └──────────────┘
```

**Pre-requis cote pays :**
- API REST ou webhook capable d'envoyer des requetes HTTP
- Capacite a formater les donnees en JSON (schema ARIS fourni)
- Connexion Internet stable

**Avantages :**
- Temps reel ou quasi temps reel
- Le pays controle quand et quoi envoyer
- Feedback immediat (validation/rejet)
- Meilleure tracabilite

**Points d'entree API :**
```
POST /api/v1/interop/country-ingestion/push
     Headers: Authorization: Bearer <token_pays>
     Body: { domain, entityType, records[], mappingProfile? }
     Response: { accepted: N, rejected: N, validationReport }
```

**Cas d'usage :**
- Kenya (KLHIS) → push des foyers en temps reel
- Afrique du Sud (DAFF) → push des donnees commerciales quotidiennement
- Ethiopie (AIHMS) → push des resultats de laboratoire

---

### 3.2 Modele B — API Pull (Systeme Legacy Accessible)

**ARIS interroge periodiquement le systeme national via un connecteur configure.**

```
┌──────────────┐     HTTP GET/FHIR    ┌──────────────┐
│  ARIS        │ ──────────────────▶  │   Systeme    │
│  Interop Hub │   Requete donnees    │   National   │
│              │ ◀──────────────────  │   (DHIS2,    │
│              │   Donnees brutes     │    KoboTool) │
└──────────────┘                      └──────────────┘
```

**Pre-requis cote pays :**
- Le systeme expose un endpoint accessible (REST, FHIR R4, DHIS2 API, OData)
- Credentials d'acces fournis a ARIS
- Documentation de l'API nationale

**Avantages :**
- Aucun developpement cote pays
- ARIS gere la transformation et le mapping
- Frequence configurable (horaire, quotidien, hebdomadaire)
- Reconnexion automatique en cas de panne

**Systemes supportes :**
| Systeme | Protocole | Notes |
|---------|-----------|-------|
| DHIS2 | REST API v2.x | Tracker + Aggregate |
| FHIR R4 | HL7 FHIR REST | Bundles, Resources |
| KoboToolbox | REST API | Formulaires + soumissions |
| ODK Aggregate | REST API | Formulaires + soumissions |
| OMS/OIE legacy | XML/SOAP | Adaptation via connecteur |
| API REST custom | HTTP/JSON | Mapping configurable |

**Configuration :**
```
POST /api/v1/interop/country-connections
     Body: {
       countryCode: "KE",
       systemType: "DHIS2",
       baseUrl: "https://dhis2.health.go.ke/api",
       authType: "OAUTH2",
       credentials: { clientId, clientSecret },
       syncFrequency: "DAILY",
       domains: ["animal-health", "livestock-prod"],
       mappingProfile: "dhis2-ke-health-v1"
     }
```

---

### 3.3 Modele C — Depot de Fichier Structure (Sans API)

**Le pays exporte ses donnees dans un template Excel/CSV fourni par ARIS et les depose sur un canal securise.**

```
┌──────────────┐   Excel/CSV/JSON   ┌──────────────┐
│   Agent      │ ──────────────────▶│  ARIS        │
│   National   │   Upload web ou    │  Interop Hub │
│              │   SFTP             │              │
│              │ ◀──────────────────│              │
│              │   Rapport validation│              │
└──────────────┘                    └──────────────┘
```

**Pre-requis cote pays :**
- Capacite a exporter en Excel ou CSV
- Acces a un navigateur web OU un client SFTP
- Point focal designe pour les soumissions

**Canaux de depot :**
| Canal | Details |
|-------|---------|
| **Upload Web** | Interface ARIS dediee (`/interop/upload`) — drag & drop |
| **SFTP** | Serveur SFTP ARIS dedie par pays (`sftp://files.au-aris.org/KE/`) |
| **Email** | Adresse dediee avec parsing automatique (futur) |

**Templates fournis :**
| Domaine | Colonnes Cles |
|---------|---------------|
| Sante Animale | country_code, disease_code, report_date, species, cases, deaths, coordinates |
| Elevage | country_code, species_code, year, population, methodology, admin_division |
| Peche | country_code, species_fao_code, year, catch_area, quantity_tonnes, gear_type |
| Commerce | country_code, partner_code, commodity_code, year, quantity, value_usd, flow |
| Vaccination | country_code, disease_code, species, doses_administered, coverage_pct, period |

**Point d'entree :**
```
POST /api/v1/interop/country-ingestion/upload
     Content-Type: multipart/form-data
     Body: { file, domain, entityType, countryCode, period }
     Response: { transactionId, recordsParsed, validationReport }
```

---

### 3.4 Tableau Comparatif

| Critere | Modele A (Push) | Modele B (Pull) | Modele C (Fichier) |
|---------|-----------------|-----------------|---------------------|
| **Effort cote pays** | Moyen (dev API) | Faible (expose endpoint) | Minimal (export Excel) |
| **Effort cote ARIS** | Faible | Moyen (connecteur) | Moyen (parsing) |
| **Frequence** | Temps reel | Configurable | Periodique (manuel) |
| **Volume maximal** | Illimite | Illimite | 100 000 lignes/fichier |
| **Feedback** | Immediat | Differe | Rapport post-upload |
| **Autonomie pays** | Totale | Partielle | Totale |
| **Maturite requise** | Elevee | Moyenne | Basique |
| **Evolutivite** | → maintenir | → migrer vers A | → migrer vers B ou A |

---

## 4. Contrat de Donnees (Data Contract)

Chaque integration pays-ARIS est formalisee par un **Contrat de Donnees** enregistre dans le systeme.

### 4.1 Contenu du Contrat

```json
{
  "name": "Kenya — Animal Health Integration",
  "countryCode": "KE",
  "integrationModel": "API_PUSH",
  "domains": ["animal-health"],
  "entityTypes": ["outbreak", "vaccination", "lab-result"],
  "frequency": "REALTIME",
  "format": "JSON",
  "schema": {
    "fields": [
      { "name": "disease_code", "type": "string", "required": true, "ref": "WOAH" },
      { "name": "report_date", "type": "date", "required": true },
      { "name": "species", "type": "string[]", "required": true, "ref": "ARIS_SPECIES" },
      { "name": "cases", "type": "integer", "required": true, "min": 0 },
      { "name": "deaths", "type": "integer", "required": false, "min": 0 },
      { "name": "coordinates", "type": "object", "required": false }
    ]
  },
  "qualitySla": {
    "minPassRate": 95,
    "correctionDeadlineHours": 48,
    "escalationDeadlineDays": 7
  },
  "timelinessSlaHours": 24,
  "classification": "RESTRICTED",
  "focalPoints": {
    "technical": { "name": "Dr. John Omondi", "email": "j.omondi@dvs.go.ke" },
    "dataOwner": { "name": "Dr. Alice Mwangi", "email": "a.mwangi@dvs.go.ke" }
  },
  "validFrom": "2026-07-01",
  "version": 1,
  "status": "ACTIVE"
}
```

### 4.2 Cycle de Vie du Contrat

```
DRAFT → ACTIVE → ARCHIVED
  │         │
  │         ├── Update → new version (ACTIVE), old → ARCHIVED
  │         └── Suspend → SUSPENDED (reactivable)
  │
  └── Review bilateral → corrections → ACTIVE
```

### 4.3 Suivi de Conformite (Compliance)

ARIS suit automatiquement :
- **Taux de ponctualite** — % de soumissions dans le delai SLA
- **Taux de qualite** — % de records passant les quality gates
- **Nombre de corrections** — records corriges apres rejet
- **Alertes SLA** — notification si non-respect des delais

---

## 5. Referentiels et Standards

### 5.1 Table de Correspondance (Mapping)

Le mapping est le coeur de l'interoperabilite. Pour chaque pays, on definit :

| Referentiel ARIS | Source d'Autorite | Exemple Mapping |
|------------------|-------------------|-----------------|
| **Geographie** | ISO 3166 + GADM | `admin_div_national` → `GADM admin2 code` |
| **Maladies** | Liste OMSA | `disease_code_national` → `WOAH code` |
| **Especes** | Taxonomie OMSA + FAO | `species_national` → `ARIS species UUID` |
| **Unites** | SI + sectoriel | `national_unit` → `ARIS unit code` |
| **Temporalite** | Calendrier epidemio | `period_national` → `ARIS period` |
| **Laboratoires** | Registre ARIS | `lab_national_id` → `ARIS lab UUID` |

### 5.2 Processus de Mapping

```
1. Export des referentiels ARIS (Excel) ───▶ Remis au pays
2. Le pays remplit la colonne "code_national" ───▶ Table de correspondance
3. ARIS charge le mapping dans le profil du pays
4. Chaque ingestion applique le mapping automatiquement
5. Les codes non-mappes sont signales pour correction
```

### 5.3 Gestion des Codes Inconnus

Quand un code national n'a pas de correspondance ARIS :
1. Le record est accepte avec un flag `UNMAPPED`
2. Le Data Steward recoit une notification
3. Le code est ajoute a la file d'attente de mapping
4. Une fois mappe, les records en attente sont re-traites

---

## 6. Quality Gates — Garantie de Qualite

### 6.1 Les 8 Portes de Qualite

Chaque record ingere passe par **8 quality gates** avant acceptation :

| # | Gate | Description | Exemple |
|---|------|-------------|---------|
| 1 | **Completude** | Champs obligatoires remplis | disease_code, report_date, country_code |
| 2 | **Coherence temporelle** | Dates logiques | confirmation >= suspicion |
| 3 | **Coherence geographique** | Codes admin valides, coordonnees dans les limites | Nairobi != Nigeria |
| 4 | **Codes & vocabulaires** | Especes/maladies dans les referentiels maitre | WOAH disease code valide |
| 5 | **Unites** | Unites valides et coherentes | tonnes, tetes, doses |
| 6 | **Deduplication** | Pas de doublon | Meme foyer pas signale 2x |
| 7 | **Auditabilite** | Systeme source + responsable presents | source_system = "KLHIS" |
| 8 | **Score de confiance** | Niveau de confiance coherent | rumeur < verifie < confirme |

### 6.2 Resultat de Validation

```json
{
  "overallStatus": "FAILED",
  "gates": [
    { "name": "COMPLETENESS", "status": "PASS" },
    { "name": "TEMPORAL_CONSISTENCY", "status": "PASS" },
    { "name": "GEOGRAPHIC_CONSISTENCY", "status": "FAIL",
      "violations": [
        { "field": "admin_code", "message": "Admin code 'XYZ' not found in GADM for KE" }
      ]
    },
    { "name": "CODES_VOCABULARIES", "status": "PASS" },
    { "name": "UNITS", "status": "PASS" },
    { "name": "DEDUPLICATION", "status": "PASS" },
    { "name": "AUDITABILITY", "status": "PASS" },
    { "name": "CONFIDENCE_SCORE", "status": "PASS" }
  ],
  "correctionDeadline": "2026-07-03T14:00:00Z"
}
```

### 6.3 Boucle de Correction

```
Ingestion → Quality Gates → PASS → Domain Service → Workflow → Publication
                          → FAIL → Notification Data Steward
                                 → Correction dans le systeme national
                                 → Re-soumission → Quality Gates (retry)
```

---

## 7. Securite et Gouvernance des Donnees

### 7.1 Authentification

| Modele | Methode d'Authentification |
|--------|---------------------------|
| API Push | API Key unique par pays + JWT (RS256) |
| API Pull | Credentials configures dans ARIS (OAuth2, API Key, ou Basic) |
| File Upload | Compte utilisateur ARIS avec role dedie |

### 7.2 Classification des Donnees

| Niveau | Description | Acces |
|--------|-------------|-------|
| **PUBLIC** | Donnees agregees, statistiques | Tout le monde |
| **PARTNER** | Partage avec orgs autorisees (OMSA, FAO) | Partenaires signataires |
| **RESTRICTED** | Donnees individuelles, non confirmees | Pays + AU-IBAR |
| **CONFIDENTIAL** | Credentials, securite nationale | Administrateurs uniquement |

### 7.3 Audit Trail

Chaque donnee ingeree est tracee :
- **Qui** : utilisateur ou systeme source
- **Quand** : horodatage UTC
- **Quoi** : action (CREATE, UPDATE, VALIDATE, REJECT)
- **D'ou** : systeme source (KLHIS, DHIS2, fichier...)
- **Version** : chaque modification cree une nouvelle version

### 7.4 Chiffrement

- **En transit** : TLS 1.3 obligatoire
- **Au repos** : AES-256 pour les donnees CONFIDENTIAL
- **API Keys** : hashees en base, jamais stockees en clair

---

## 8. Deroulement de la Session

### Phase 1 — Decouverte Mutuelle (45 min)

**Objectif :** Comprendre l'ecosysteme numerique du pays.

**Cote AU-IBAR :**
- Presentation ARIS 4.0 (ce document)
- Demonstration live sur `test.au-aris.org`

**Cote Pays :**
- Presenter le(s) systeme(s) existant(s)
- Technologies utilisees (DHIS2, custom, Excel...)
- Volumes de donnees (records/mois, domaines couverts)
- Points de douleur actuels

**Questions a poser au pays :**
1. Quels systemes utilisez-vous pour collecter les donnees animales ?
2. Quels domaines sont couverts numeriquement ? Lesquels sont encore sur papier/Excel ?
3. Votre systeme a-t-il une API accessible ? Si oui, quelle technologie ?
4. Comment reportez-vous actuellement a l'OMSA (WAHIS) ? Manuellement ?
5. Combien de records generez-vous par mois/an ?
6. Avez-vous une equipe IT dediee aux systemes d'information animale ?
7. Quels sont vos principaux defis de qualite de donnees ?

### Phase 2 — Choix du Modele et Mapping (60 min)

**Objectif :** Definir le modele d'integration et commencer le mapping des referentiels.

**Activites :**
1. **Choix du modele** (A, B, ou C) — selon la grille de decision :
   ```
   Le pays a une API REST fonctionnelle ?
     OUI → Modele A (Push) ou B (Pull)
       Le pays peut developper un webhook ?
         OUI → Modele A (Push) — le pays controle
         NON → Modele B (Pull) — ARIS interroge
     NON → Modele C (Fichier structure)
   ```

2. **Choix du domaine pilote** — commencer par le plus critique/mature

3. **Mapping des referentiels** :
   - Distribuer les templates de mapping
   - Commencer le mapping en seance (au moins maladies + especes)
   - Identifier les codes nationaux sans equivalent ARIS

4. **Schema des donnees** :
   - Comparer le schema national vs ARIS
   - Identifier les champs supplementaires du pays
   - Definir les transformations necessaires

### Phase 3 — Prototype Live (45 min)

**Objectif :** Demontrer un echange de donnees en temps reel.

**Scenario de demonstration :**
1. Preparer un jeu de 10-20 records du pays (donnees reelles ou fictives)
2. Soumettre via le modele choisi (API, fichier, ou simulation pull)
3. Observer le passage dans les quality gates
4. Voir les records acceptes apparaitre dans le dashboard ARIS
5. Voir les records rejetes et le rapport de qualite
6. Corriger les erreurs et re-soumettre

**Environnement :** `test.au-aris.org` (staging)

### Phase 4 — Formalisation et Planning (30 min)

**Objectif :** Signer le contrat et definir le calendrier.

**Activites :**
1. **Rediger le Data Contract** — completement ou les grandes lignes
2. **Nommer les points focaux** :
   - Point focal technique (IT) cote pays
   - Point focal technique cote AU-IBAR
   - Data Owner / CVO office
   - Data Steward
3. **Calendrier indicatif** :

| Etape | Delai | Responsable |
|-------|-------|-------------|
| Mapping referentiels complet | J+14 | Pays + AU-IBAR |
| Configuration connecteur | J+7 | AU-IBAR |
| Test d'integration | J+21 | Conjoint |
| Pilote (1 domaine, 1 mois) | J+30 a J+60 | Conjoint |
| Revue et ajustement | J+60 | Conjoint |
| Extension a d'autres domaines | J+90+ | Conjoint |

---

## 9. Fiche Technique par Modele

### 9.1 Fiche Modele A — API Push

**Endpoint principal :**
```
POST https://au-aris.org/api/v1/interop/country-ingestion/push
Content-Type: application/json
Authorization: Bearer <country_api_token>
X-Country-Code: KE
X-Integration-Model: API_PUSH
```

**Corps de la requete :**
```json
{
  "domain": "animal-health",
  "entityType": "outbreak",
  "sourceSystem": "KLHIS",
  "sourceVersion": "3.2.1",
  "records": [
    {
      "sourceId": "KLHIS-OB-2026-001",
      "diseaseCode": "FMD",
      "reportDate": "2026-06-15",
      "species": ["cattle"],
      "cases": 45,
      "deaths": 3,
      "location": {
        "adminCode": "KE-30",
        "coordinates": { "lat": -1.286, "lng": 36.817 }
      },
      "confidenceLevel": "CONFIRMED",
      "controlMeasures": ["VACCINATION", "QUARANTINE"]
    }
  ]
}
```

**Reponse :**
```json
{
  "transactionId": "uuid-xxx",
  "status": "COMPLETED",
  "summary": {
    "total": 1,
    "accepted": 1,
    "rejected": 0,
    "warnings": 0
  },
  "results": [
    {
      "sourceId": "KLHIS-OB-2026-001",
      "arisId": "uuid-yyy",
      "status": "ACCEPTED",
      "qualityScore": 0.95
    }
  ]
}
```

### 9.2 Fiche Modele B — API Pull

**Configuration du connecteur :**
```json
{
  "countryCode": "ET",
  "systemType": "DHIS2",
  "baseUrl": "https://dhis2.aihms.et/api",
  "authType": "OAUTH2",
  "credentials": {
    "clientId": "aris-connector",
    "clientSecret": "***"
  },
  "syncFrequency": "DAILY",
  "syncTime": "02:00",
  "pullConfig": {
    "programs": ["ANIMAL_HEALTH_SURVEILLANCE"],
    "dataElements": ["cases", "deaths", "species", "disease"],
    "orgUnitLevel": 3,
    "periodType": "WEEKLY"
  }
}
```

### 9.3 Fiche Modele C — Depot de Fichier

**Template CSV (Sante Animale) :**
```csv
source_id,country_code,disease_code,report_date,species,cases,deaths,admin_code,latitude,longitude,confidence_level,source_system
OB-2026-001,NG,FMD,2026-06-15,cattle,45,3,NG-LA,6.524,3.379,CONFIRMED,NADIS
OB-2026-002,NG,PPR,2026-06-16,"sheep,goats",120,15,NG-KN,12.002,8.514,VERIFIED,NADIS
```

**Upload :**
```
POST https://au-aris.org/api/v1/interop/country-ingestion/upload
Content-Type: multipart/form-data
Authorization: Bearer <user_token>

file: animal_health_NG_202606.csv
domain: animal-health
entityType: outbreak
countryCode: NG
period: 2026-06
```

---

## 10. Livrables de la Session

A la fin de chaque session pays, les documents suivants doivent etre produits :

| # | Livrable | Format | Responsable |
|---|----------|--------|-------------|
| 1 | **Data Contract** | JSON (enregistre dans ARIS) + PDF signe | Conjoint |
| 2 | **Table de Mapping des Referentiels** | Excel | Pays (complete par AU-IBAR) |
| 3 | **Choix du Modele d'Integration** | Document ecrit | Conjoint |
| 4 | **Calendrier de Mise en Oeuvre** | Tableau | Conjoint |
| 5 | **Points Focaux Nommes** | Liste (nom, email, role) | Pays |
| 6 | **Compte-Rendu de Session** | PDF | AU-IBAR |
| 7 | **Jeu de Donnees Test** | CSV/JSON | Pays |
| 8 | **Rapport de Validation du Prototype** | PDF (genere par ARIS) | ARIS automatique |

---

## 11. Annexes

### Annexe A — Glossaire

| Terme | Definition |
|-------|-----------|
| **Data Contract** | Accord formel definissant les donnees echangees, leur format, frequence, et SLA |
| **Quality Gate** | Point de controle automatique verifiant la qualite d'un record |
| **Data Steward** | Responsable de la qualite des donnees dans un pays |
| **Interop Hub** | Service ARIS centralisant tous les echanges avec les systemes externes |
| **Referentiel** | Liste de reference standardisee (maladies, especes, geographie...) |
| **SLA** | Service Level Agreement — engagement sur les delais et la qualite |
| **Mapping** | Table de correspondance entre codes nationaux et codes ARIS/internationaux |
| **WAHIS** | World Animal Health Information System (OMSA) |
| **EMPRES** | Emergency Prevention System (FAO) |
| **FAOSTAT** | Base de donnees statistiques de la FAO |

### Annexe B — Contacts AU-IBAR

| Role | Contact |
|------|---------|
| Responsable ARIS | [A definir] |
| Architecte Technique | [A definir] |
| Data Quality Lead | [A definir] |
| Support Technique | support@au-aris.org |

### Annexe C — URLs de Reference

| Ressource | URL |
|-----------|-----|
| ARIS Production | https://au-aris.org |
| ARIS Staging (tests) | https://test.au-aris.org |
| Documentation API | https://au-aris.org/api/docs |
| Templates de Mapping | https://au-aris.org/interop/templates |

---

*Document prepare par l'equipe technique ARIS 4.0 — UA-BIRA*
*Version 1.0 — Juin 2026*
*Classification : PARTNER*
