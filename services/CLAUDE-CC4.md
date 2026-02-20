# CLAUDE.md — CC-4 Domain Services

## Your Scope
You own ALL business domain services + data/integration services:
- `services/animal-health/` (port 3020) — **Priority: Phase 3 flagship**
- `services/livestock-prod/` (port 3021) — Phase 4
- `services/fisheries/` (port 3022) — Phase 4
- `services/wildlife/` (port 3023) — Phase 5
- `services/apiculture/` (port 3024) — Phase 5
- `services/trade-sps/` (port 3025) — Phase 4
- `services/governance/` (port 3026) — Phase 5
- `services/climate-env/` (port 3027) — Phase 5
- `services/analytics/` (port 3030) — Phase 2+
- `services/geo-services/` (port 3031) — Phase 2+
- `services/knowledge-hub/` (port 3033) — Phase 5

## Common Pattern for ALL Domain Services
Every domain service follows the same architecture:
```
DomainModule
  ├── dto/           # CreateXDto, UpdateXDto (class-validator)
  ├── entities/      # Prisma models (defined in db-schemas)
  ├── controllers/   # REST endpoints
  ├── services/      # Business logic + Kafka events + quality gate calls
  ├── repositories/  # Prisma access (always filtered by tenantId)
  └── consumers/     # Kafka event handlers
```

Every entity MUST have:
- `tenantId` (UUID, mandatory, from JWT)
- `dataClassification` (DataClassification enum)
- `createdBy` / `updatedBy` (user ID for audit)
- `createdAt` / `updatedAt` (timestamps)

Every mutation MUST:
1. Validate via class-validator DTO
2. Request quality validation from `data-quality` service (HTTP or Kafka)
3. Publish domain event to Kafka
4. Log audit trail entry

## Service: animal-health (port 3020) — FLAGSHIP

### Key Entities (MDS from ARIS document §5.3)
```typescript
// Outbreak/Event
interface HealthEvent {
  id: string; tenantId: string;
  diseaseId: string;           // From Master Data
  eventType: 'SUSPECT' | 'CONFIRMED' | 'RESOLVED';
  speciesIds: string[];        // Domestic + wildlife
  dateOnset?: Date; dateSuspicion: Date; dateConfirmation?: Date; dateClosure?: Date;
  geoEntityId: string;         // Admin level from Master Data
  coordinates?: { lat: number; lng: number };
  holdingsAffected: number; susceptible: number; cases: number;
  deaths: number; killed: number; slaughtered: number;
  controlMeasures: ('QUARANTINE' | 'MOVEMENT_CONTROL' | 'VACCINATION' | 'STAMPING_OUT')[];
  confidenceLevel: 'RUMOR' | 'VERIFIED' | 'CONFIRMED';
  dataClassification: DataClassification;
  workflowInstanceId?: string;
  wahisReady: boolean;
}

// Laboratory
interface LabResult {
  id: string; tenantId: string;
  sampleId: string; sampleType: string;
  dateCollected: Date; dateReceived: Date;
  testType: string; result: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  labId: string;              // From Master Data identifiers
  turnaroundDays: number;
  eqaFlag: boolean;           // External Quality Assessment
  healthEventId?: string;
}

// Surveillance
interface SurveillanceActivity {
  id: string; tenantId: string;
  type: 'PASSIVE' | 'ACTIVE' | 'SENTINEL' | 'EVENT_BASED';
  diseaseId: string;
  designType?: 'CLUSTER' | 'RISK_BASED' | 'RANDOM';
  sampleSize: number; positivityRate?: number;
  period: { start: Date; end: Date };
  geoEntityId: string;
  mapLayerId?: string;
}

// Vaccination / PVE
interface VaccinationCampaign {
  id: string; tenantId: string;
  diseaseId: string; speciesId: string;
  vaccineType: string; vaccineBatch?: string;
  dosesDelivered: number; dosesUsed: number;
  targetPopulation: number; coverageEstimate: number;
  pveSerologyDone: boolean;
  period: { start: Date; end: Date };
  geoEntityId: string;
}

// Veterinary Services Capacities
interface SVCapacity {
  id: string; tenantId: string;
  year: number;
  epiStaff: number; labStaff: number;
  labTestsAvailable: string[];
  vaccineProductionCapacity?: number;
  pvsScore?: number;
}
```

### Business Rules
- If disease is WOAH-listed AND event confirmed → auto-publish `rec.health.outbreak.alert.v1`
- Coverage estimate = dosesUsed / denominator (from Master Data denominators, versioned)
- After Level 2 workflow approval → set `wahisReady: true`

### Kafka Topics
- `ms.health.event.created.v1` / `.updated.v1` / `.confirmed.v1`
- `ms.health.lab.result.created.v1`
- `ms.health.vaccination.completed.v1`
- `ms.health.surveillance.reported.v1`
- `rec.health.outbreak.alert.v1` (cross-border alert)

## Service: analytics (port 3030)

### Kafka Streams Consumer
Consumes domain events and computes aggregated KPIs:
- Active outbreaks by country/disease/species
- Vaccination coverage by country/disease (using versioned denominators)
- Lab turnaround time averages
- Surveillance positivity rates
- Quality gate pass rates
- Timeliness metrics (event to validation time)

Store aggregates in Redis (CQRS read model) for fast dashboard queries.

### Endpoints
- `GET /analytics/health/kpis` — Health domain KPIs (filter by country, period)
- `GET /analytics/health/trends` — Time series (outbreaks, vaccinations, lab)
- `GET /analytics/quality/dashboard` — Data quality metrics
- `GET /analytics/timeliness` — Workflow timeliness by level
- `GET /analytics/denominators` — Population denominators with source comparison

## Service: geo-services (port 3031)

### PostGIS + pg_tileserv
- Spatial queries: outbreaks within radius, admin boundary contains point
- Vector tile serving via pg_tileserv for web map layers
- Risk layers: outbreak density heatmaps, vaccination coverage choropleth
- Corridor overlays: transhumance routes, trade corridors

### Endpoints
- `GET /geo/tiles/{z}/{x}/{y}` — Vector tiles
- `GET /geo/layers` — Available map layers
- `GET /geo/query/within` — Entities within geometry
- `GET /geo/query/nearest` — Nearest entities to point
- `GET /geo/risk-map` — Generated risk layer for disease/period

## Dependencies
- `@aris/shared-types`, `@aris/kafka-client`, `@aris/auth-middleware`, `@aris/quality-rules`
- `@turf/turf` (geospatial calculations)
- Domain services talk to `data-quality` via HTTP for validation
- Domain services read from `master-data` for referentials (cached in Redis)
