# CLAUDE.md — CC-2 Data Hub

## Your Scope
You own the **Interoperability Hub** — the centerpiece of the ARIS architecture (Annex A):
- `services/master-data/` (port 3003) — Common dictionary & referentials
- `services/data-quality/` (port 3004) — Quality gates engine & correction loop
- `services/data-contract/` (port 3005) — Contract registry & SLA tracking
- `services/interop-hub/` (port 3032) — External system connectors

## Critical: You Are the Data Backbone
Without your services, no data enters or leaves ARIS in a quality-controlled, standardized way.
The Annex A positions the Interoperability Hub as the **heart** of the architecture.

## Service: master-data (port 3003)

### Referentials (non-negotiable per AU-IBAR mandate)
```typescript
// Geography — ISO 3166 + admin levels
interface GeoEntity {
  id: string;
  code: string;          // "KE", "KE-01", "KE-01-001"
  name: string;
  nameEn: string;
  nameFr: string;
  level: 'COUNTRY' | 'ADMIN1' | 'ADMIN2' | 'ADMIN3' | 'SPECIAL_ZONE';
  parentId?: string;
  geometry?: GeoJSON;     // PostGIS polygon/point
  centroid?: { lat: number; lng: number };
  countryCode: string;
  isActive: boolean;
  version: number;
}

// Species — WOAH + FAO aligned
interface Species {
  id: string;
  code: string;           // WOAH code
  scientificName: string;
  commonNameEn: string;
  commonNameFr: string;
  category: 'DOMESTIC' | 'WILDLIFE' | 'AQUATIC' | 'APICULTURE';
  productionCategories: string[];  // e.g., ["dairy", "beef", "draught"]
  isWoahListed: boolean;
  version: number;
}

// Disease — WOAH list + emerging
interface Disease {
  id: string;
  code: string;           // WAHIS-aligned code
  nameEn: string;
  nameFr: string;
  isWoahListed: boolean;
  affectedSpecies: string[];  // Species IDs
  isNotifiable: boolean;
  wahisCategory?: string;
  version: number;
}

// Denominator — FAOSTAT vs national census (versioned!)
interface Denominator {
  id: string;
  countryCode: string;
  speciesId: string;
  year: number;
  source: 'FAOSTAT' | 'NATIONAL_CENSUS' | 'ESTIMATE';
  population: number;
  assumptions?: string;    // Documented methodology
  version: number;
  validatedAt?: Date;
  validatedBy?: string;
}
```

### Endpoints
- `GET /master-data/geo` — List/search geographic entities (with filters)
- `GET /master-data/geo/:id` — Get entity with geometry
- `GET /master-data/species` — List species (filter by category)
- `GET /master-data/diseases` — List diseases (filter by WOAH-listed)
- `GET /master-data/denominators` — List denominators (filter by country, species, year, source)
- `POST /master-data/denominators` — Add/update denominator (requires DATA_STEWARD+)
- `GET /master-data/units` — List measurement units
- `GET /master-data/identifiers` — Registry of labs, markets, border points, protected areas
- `GET /master-data/version` — Current dictionary version

All referentials are **versioned**. Changes tracked in audit trail.

### Kafka Topics
- `sys.master.geo.updated.v1`
- `sys.master.species.updated.v1`
- `sys.master.disease.updated.v1`
- `sys.master.denominator.updated.v1`

## Service: data-quality (port 3004)

### Quality Gates (Annex B §B4.2 — mandatory)
```typescript
interface QualityReport {
  recordId: string;
  domain: string;
  submittedAt: Date;
  gates: QualityGateResult[];
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  confidenceScore: number;     // 0.0 – 1.0
  correctionDeadline?: Date;   // SLA from data contract
  errors: QualityViolation[];
}

interface QualityGateResult {
  gate: QualityGateName;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  details?: string;
}

type QualityGateName =
  | 'COMPLETENESS'
  | 'TEMPORAL_CONSISTENCY'
  | 'GEOGRAPHIC_CONSISTENCY'
  | 'CODE_VALIDATION'
  | 'UNIT_VALIDATION'
  | 'DEDUPLICATION'
  | 'AUDITABILITY'
  | 'CONFIDENCE_SCORE';
```

### Endpoints
- `POST /data-quality/validate` — Validate a record against quality gates
- `GET /data-quality/reports` — List quality reports (filter by domain, status)
- `GET /data-quality/reports/:id` — Get detailed report
- `GET /data-quality/dashboard` — Quality KPIs (pass rate, avg correction time)
- `POST /data-quality/rules` — Define custom rules per domain (DATA_STEWARD+)

### Correction Loop
1. Record submitted → quality gates run automatically
2. If FAILED → record returned to source with actionable error messages
3. SLA timer starts (from data contract, e.g., 48h correction, 7d escalation)
4. Steward dashboard shows pending corrections
5. If SLA breached → auto-escalation notification

### Kafka Topics
- `au.quality.record.validated.v1`
- `au.quality.record.rejected.v1`
- `au.quality.correction.overdue.v1`

## Service: data-contract (port 3005)

### Data Contract (Annex B §B5 template)
```typescript
interface DataContract {
  id: string;
  name: string;                    // e.g., "Animal Health Events — Kenya"
  domain: string;                  // Business domain
  dataOwner: string;               // Institution legally responsible
  dataSteward: string;             // Operational custodian
  purpose: string;
  officialityLevel: 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';
  schema: JsonSchema;              // JSON Schema for record validation
  frequency: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  timelinessSla: number;           // Max hours from event to submission
  qualitySla: {
    correctionDeadline: number;    // Hours to correct failed records
    escalationDeadline: number;    // Hours before escalation
    minPassRate: number;           // Minimum quality gate pass rate (0-1)
  };
  classification: DataClassification;
  exchangeMechanism: 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';
  version: number;
  validFrom: Date;
  validTo?: Date;
  approvedBy: string;
}
```

### Endpoints
- `GET /data-contracts` — List all contracts (filter by domain, status)
- `POST /data-contracts` — Create contract (CONTINENTAL_ADMIN+)
- `GET /data-contracts/:id` — Get contract details
- `PATCH /data-contracts/:id` — Update contract (versioned)
- `GET /data-contracts/:id/compliance` — SLA compliance metrics

## Service: interop-hub (port 3032)

### Connectors (priority order per AU-IBAR)
1. **WAHIS-ready** — Export validated animal health events, 6-monthly monitoring, annual + SV capacities
2. **EMPRES-ready** — Feed verified signals with confidence, context, georeferencing
3. **FAOSTAT-anchored** — Import/reconcile denominators (versioned)
4. **FishStatJ-aligned** — Export captures/aquaculture in FAO structures
5. **CITES/WDPA/GBIF** — Import reference layers

### Endpoints
- `POST /interop/wahis/export` — Generate WAHIS-ready package for a country/period
- `GET /interop/wahis/exports` — List past exports
- `POST /interop/empres/feed` — Push signal to EMPRES format
- `POST /interop/faostat/sync` — Sync denominators from FAOSTAT
- `GET /interop/connectors` — List available connectors and their status
- `GET /interop/health` — Connector health checks

### Kafka Topics
- `au.interop.wahis.exported.v1`
- `au.interop.empres.fed.v1`
- `au.interop.faostat.synced.v1`

## Dependencies
- `@aris/shared-types`, `@aris/kafka-client`, `@aris/auth-middleware`, `@aris/quality-rules`
- `ajv` (JSON Schema validation for data contracts)
- `turf` (geospatial validation for geographic consistency)
- `fuse.js` (fuzzy matching for deduplication)
