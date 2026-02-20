# ARIS 3.0 — Prompts Semaine 1 (Phase 0)
# Instructions pour chaque instance Claude Code

---

## CC-1 — Platform Core — Semaine 1

### Prompt 1.1 — Packages Foundation
```
Read CLAUDE.md at the project root, then your instance CLAUDE-CC1.md in services/.

Create the following packages with full TypeScript strict configuration:

1. packages/shared-types/
   - src/enums/tenant-level.enum.ts (CONTINENTAL, REC, MEMBER_STATE)
   - src/enums/user-role.enum.ts (8 roles per CLAUDE.md)
   - src/enums/data-classification.enum.ts (PUBLIC, PARTNER, RESTRICTED, CONFIDENTIAL)
   - src/enums/workflow-level.enum.ts (4 levels)
   - src/enums/workflow-status.enum.ts
   - src/enums/quality-gate.enum.ts
   - src/dto/api-response.dto.ts (ApiResponse<T>, PaginatedResponse<T>)
   - src/dto/pagination.dto.ts (PaginationQuery)
   - src/kafka/kafka-event.interface.ts (KafkaEvent<T> with headers, timestamp, version)
   - src/kafka/topic-names.ts (all topic name constants from docker-compose kafka-init)
   - src/index.ts (barrel export)
   - package.json (@aris/shared-types)
   - tsconfig.json (strict: true, composite: true)

2. packages/kafka-client/
   - src/kafka.module.ts (NestJS dynamic module KafkaModule.forRoot(config))
   - src/kafka-producer.service.ts (idempotent, JSON serialization, retry with exponential backoff)
   - src/kafka-consumer.service.ts (manual commit, DLQ after 3 failures, @KafkaSubscribe decorator)
   - src/kafka.config.ts (KafkaConfig interface)
   - src/decorators/kafka-subscribe.decorator.ts
   - src/index.ts
   - package.json (@aris/kafka-client, peer dep on @aris/shared-types)
   - tsconfig.json

3. packages/auth-middleware/
   - src/auth.module.ts (NestJS module)
   - src/guards/auth.guard.ts (JWT RS256 validation)
   - src/guards/roles.guard.ts (@Roles decorator check)
   - src/guards/tenant.guard.ts (tenant isolation: user can only access own tenant + children)
   - src/guards/classification.guard.ts (data classification access check)
   - src/decorators/current-user.decorator.ts
   - src/decorators/current-tenant.decorator.ts
   - src/decorators/roles.decorator.ts
   - src/interfaces/jwt-payload.interface.ts
   - src/index.ts
   - package.json (@aris/auth-middleware)
   - tsconfig.json

Every file must compile. Every export must be typed. Add vitest unit tests for guards.
```

### Prompt 1.2 — Tenant Service
```
Read CLAUDE.md root and CLAUDE-CC1.md.

Create services/tenant/ as a NestJS 10 application (port 3001):

Structure:
  src/
    app.module.ts
    main.ts (bootstrap NestJS, port from env)
    tenant/
      tenant.module.ts
      tenant.controller.ts
      tenant.service.ts
      dto/create-tenant.dto.ts
      dto/update-tenant.dto.ts
      entities/ (Prisma model reference)

Prisma schema in packages/db-schemas/prisma/tenant.prisma:
  - Tenant model with all fields from CLAUDE-CC1.md
  - Seed: AU-IBAR (CONTINENTAL) + 8 RECs (IGAD, ECOWAS, SADC, EAC, ECCAS, UMA, CEN-SAD, COMESA) + 5 pilot MS (Kenya, Ethiopia, Nigeria, Senegal, South Africa)

Endpoints:
  POST /api/v1/tenants — Create tenant (SUPER_ADMIN only)
  GET /api/v1/tenants — List tenants (filtered by user's tenant + children)
  GET /api/v1/tenants/:id — Get tenant by ID
  PATCH /api/v1/tenants/:id — Update tenant
  GET /api/v1/tenants/:id/children — Get child tenants

Use @aris/auth-middleware guards. Publish Kafka events via @aris/kafka-client.
Add vitest unit tests for service layer.
```

### Prompt 1.3 — Credential Service
```
Read CLAUDE.md root and CLAUDE-CC1.md.

Create services/credential/ as a NestJS 10 application (port 3002):

Auth flow:
  POST /api/v1/auth/register — Create user (requires NATIONAL_ADMIN+)
  POST /api/v1/auth/login — Email + password → bcrypt verify → JWT RS256 (15min) + refresh token (Redis 7d)
  POST /api/v1/auth/refresh — Refresh token → new JWT + new refresh
  POST /api/v1/auth/logout — Invalidate refresh token in Redis
  GET /api/v1/users — List users (tenant-scoped)
  GET /api/v1/users/me — Current user profile
  PATCH /api/v1/users/:id — Update user (role changes require SUPER_ADMIN)

JWT payload: { sub, email, role, tenantId, tenantLevel, iat, exp }
Password: bcrypt with 12 rounds.
Refresh tokens stored in Redis with key pattern: refresh:{userId}:{tokenId}

Prisma schema: packages/db-schemas/prisma/credential.prisma
Seed: 1 SUPER_ADMIN for AU-IBAR, 1 NATIONAL_ADMIN per pilot MS.

Publish: sys.credential.user.created.v1, sys.credential.user.authenticated.v1
Add unit tests + integration test with Testcontainers (PG + Redis).
```

---

## CC-2 — Data Hub — Semaine 1

### Prompt 2.1 — Master Data Service
```
Read CLAUDE.md root and CLAUDE-CC2.md.

Create services/master-data/ (port 3003):

Priority: This is the FOUNDATION — every other service depends on Master Data referentials.

Implement the 7 referential tables per CLAUDE-CC2.md:
  1. GeoEntity (countries ISO 3166 + admin levels, PostGIS geometry)
  2. Species (domestic/wildlife/aquatic/apiculture, WOAH codes)
  3. Disease (WOAH list + emerging, WAHIS codes)
  4. Unit (SI + sectoral)
  5. Temporality (epidemiological calendars)
  6. Identifier (labs, markets, border points, protected areas)
  7. Denominator (FAOSTAT vs national census, versioned!)

All referentials are VERSIONED (version field, audit trail on every change).

Seed data (critical for dev):
  - 55 AU Member States with ISO codes
  - 8 RECs with member mapping
  - Admin Level 1 for 5 pilot countries (from GADM)
  - Top 30 WOAH-listed diseases
  - Top 50 domestic species (cattle, sheep, goats, poultry, camels, etc.)
  - Standard units (heads, doses, tonnes, liters, km², etc.)
  - FAOSTAT denominators 2020-2023 for 5 pilot countries (cattle, sheep, goats, poultry)

Endpoints per CLAUDE-CC2.md. Use @aris/auth-middleware, @aris/kafka-client.
Add vitest unit tests. Add integration test for PostGIS geo queries.
```

---

## CC-3 — Collecte & Workflow — Semaine 1

### Prompt 3.1 — Form Builder Service
```
Read CLAUDE.md root and CLAUDE-CC3.md.

Create services/form-builder/ (port 3010):

Core: JSON Schema-based form template system with ARIS extensions.

Implement:
  - FormTemplate CRUD (create, list, get, update, publish, archive)
  - Template inheritance (AU base → REC extends → MS customizes)
  - Version management (new version on each publish)
  - Domain-specific components: geo-picker, species-selector, disease-selector,
    admin-cascader, photo-capture, signature-pad, lab-result-panel

Prisma schema: form_builder schema with FormTemplate table.
Seed: 1 base template "Animal Disease Event Report" (AU-IBAR level) with fields:
  country, admin1, admin2, disease (from master-data), species, date_onset,
  date_suspicion, cases, deaths, control_measures, gps_location, photos

Endpoints per CLAUDE-CC3.md. Kafka events on create/publish.
Unit tests for template inheritance resolution and version management.
```

---

## CC-4 — Domain Services — Semaine 1

### Prompt 4.1 — Analytics Foundation
```
Read CLAUDE.md root and CLAUDE-CC4.md.

Create services/analytics/ (port 3030) — skeleton only for Week 1:

Implement:
  - NestJS app with Kafka consumer setup
  - Consumer group for health domain events
  - Redis-based KPI store (CQRS read model)
  - GET /api/v1/analytics/health/kpis — Returns mock KPIs:
    { activeOutbreaks, vaccinationCoverage, avgLabTurnaround, qualityPassRate }
  - Health check endpoint

This is a foundation — real Kafka Streams processing comes in Phase 2.
For now, consume ms.health.event.created.v1 and increment a Redis counter.
Unit tests for KPI calculation logic.
```

---

## CC-5 — Frontend Web — Semaine 1

### Prompt 5.1 — App Shell + Auth
```
Read CLAUDE.md root and CLAUDE-CC5.md.

Create apps/web/ as Next.js 14 (App Router):

Implement:
  1. Auth pages: /login (email + password form), /register
  2. Dashboard layout with:
     - Sidebar: Home, Animal Health, Collecte, Workflow, Master Data, Quality, Interop, Settings
     - Header: user avatar + role badge, tenant selector (AU → REC → MS cascade)
     - Breadcrumbs
  3. Home dashboard page with 4 KPI cards (placeholder data):
     - Active Outbreaks, Vaccination Coverage, Pending Validations, Data Quality Score
  4. Leaflet map component (continental Africa, placeholder markers)

Use Shadcn/UI + Tailwind. ARIS color scheme: AU green primary, teal secondary, orange accent.
React Query for API calls. Zustand for auth state + tenant context.
API base URL from environment variable.
```

Create packages/ui-components/ with:
  - KpiCard, DataTable, MapView, TenantSelector, WorkflowStatusBadge, QualityIndicator
  - Storybook configuration for component development
  - ARIS theme tokens (colors, typography, spacing)

---

## CC-6 — Mobile Kotlin — Semaine 1

### Prompt 6.1 — Android Shell + Offline DB
```
Read CLAUDE.md root and CLAUDE-CC6.md.

Create apps/mobile/ as Android Kotlin project:

Implement:
  1. Project setup: Kotlin 1.9+, Jetpack Compose, Material 3, Hilt, Room, Ktor
  2. Login screen (email + password → JWT stored in EncryptedSharedPreferences)
  3. Room database with tables:
     - CampaignEntity, SubmissionEntity, FormTemplateEntity
     - SpeciesEntity, DiseaseEntity, GeoEntity (Master Data cache)
  4. Repository pattern: LocalDataSource (Room) + RemoteDataSource (Ktor)
  5. Sync indicator in top bar (last sync time, pending count)
  6. Navigation: Login → Campaign List → (placeholder) Form Fill → Submissions

Target: Android 8+ (API 26), min RAM 2GB.
Material 3 theme with ARIS colors.
Unit tests with MockK for repository layer.
```

---

# Ordre d'exécution recommandé

## Jour 1-2: Fondations parallèles
- CC-1: Prompt 1.1 (packages shared-types, kafka-client, auth-middleware)
- CC-5: Prompt 5.1 partie packages/ui-components (design system)

## Jour 2-3: Services core
- CC-1: Prompt 1.2 (tenant service) — BLOQUANT pour les autres
- CC-1: Prompt 1.3 (credential service) — BLOQUANT pour l'auth

## Jour 3-4: Hub + Collecte
- CC-2: Prompt 2.1 (master-data) — BLOQUANT pour domain services
- CC-3: Prompt 3.1 (form-builder)

## Jour 4-5: Front + Mobile + Analytics
- CC-4: Prompt 4.1 (analytics skeleton)
- CC-5: Prompt 5.1 partie apps/web (shell + auth + dashboard)
- CC-6: Prompt 6.1 (mobile shell)

## Validation fin de semaine
- [ ] `docker compose up -d` → tous les containers healthy
- [ ] `pnpm install` → pas d'erreur
- [ ] `turbo build` → tous les packages compilent
- [ ] Tenant service: CRUD fonctionne (Postman/curl)
- [ ] Credential service: login → JWT → protected endpoint
- [ ] Master Data: GET /species retourne les 50 espèces seed
- [ ] Web app: login → dashboard avec KPI cards
- [ ] Mobile: login → campaign list (vide mais fonctionnel)
- [ ] Kafka UI (localhost:8080): tous les topics créés
