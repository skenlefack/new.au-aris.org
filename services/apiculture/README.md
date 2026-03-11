# Apiculture Service

ARIS 4.0 domain service for apiculture management: apiaries, honey production, colony health inspections, and beekeeper training.

## Port

`3024` (configurable via `APICULTURE_PORT`)

## Architecture

Fastify 5 + Prisma + Kafka (standalone producer) + JWT RS256 auth.

No NestJS dependency -- plain TypeScript classes with constructor-based DI.

## API Routes

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health check |

### Apiaries
| Method | Path | Auth Roles | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/apiculture/apiaries` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, FIELD_AGENT | Create apiary |
| GET | `/api/v1/apiculture/apiaries` | Authenticated | List apiaries (paginated, filterable) |
| GET | `/api/v1/apiculture/apiaries/:id` | Authenticated | Get apiary by ID |
| PATCH | `/api/v1/apiculture/apiaries/:id` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD | Update apiary |

**Filters**: `hiveType`, `geoEntityId`

### Honey Production
| Method | Path | Auth Roles | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/apiculture/production` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, FIELD_AGENT | Record production |
| GET | `/api/v1/apiculture/production` | Authenticated | List production records |
| GET | `/api/v1/apiculture/production/:id` | Authenticated | Get production record by ID |
| PATCH | `/api/v1/apiculture/production/:id` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD | Update production record |

**Filters**: `apiaryId`, `quality`, `periodStart`, `periodEnd`

### Colony Health
| Method | Path | Auth Roles | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/apiculture/health` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, FIELD_AGENT | Create inspection |
| GET | `/api/v1/apiculture/health` | Authenticated | List inspections |
| GET | `/api/v1/apiculture/health/:id` | Authenticated | Get inspection by ID |
| PATCH | `/api/v1/apiculture/health/:id` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD | Update inspection |

**Filters**: `apiaryId`, `colonyStrength`, `disease`

### Beekeeper Training
| Method | Path | Auth Roles | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/apiculture/training` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, FIELD_AGENT | Create training |
| GET | `/api/v1/apiculture/training` | Authenticated | List trainings |
| GET | `/api/v1/apiculture/training/:id` | Authenticated | Get training by ID |
| PATCH | `/api/v1/apiculture/training/:id` | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD | Update training |

**Filters**: `beekeeperId`, `trainingType`

## Kafka Topics

| Topic | Trigger |
|-------|---------|
| `ms.apiculture.apiary.created.v1` | Apiary created |
| `ms.apiculture.apiary.updated.v1` | Apiary updated |
| `ms.apiculture.production.recorded.v1` | Honey production recorded |
| `ms.apiculture.production.updated.v1` | Production record updated |
| `ms.apiculture.health.inspected.v1` | Colony health inspection created |
| `ms.apiculture.health.updated.v1` | Colony health inspection updated |
| `ms.apiculture.training.created.v1` | Beekeeper training created |
| `ms.apiculture.training.updated.v1` | Beekeeper training updated |

## Data Classification Defaults

| Entity | Default |
|--------|---------|
| Apiary | PARTNER |
| Honey Production | PARTNER |
| Colony Health | PARTNER |
| Beekeeper Training | PUBLIC |

## Development

```bash
# Install dependencies
pnpm install

# Run in dev mode
pnpm --filter @aris/apiculture-service dev

# Run tests
pnpm --filter @aris/apiculture-service test

# Build
pnpm --filter @aris/apiculture-service build
```

## Enums

### HiveType
`LANGSTROTH` | `TOP_BAR` | `KENYAN_TOP_BAR` | `TRADITIONAL`

### HoneyQuality
`GRADE_A` | `GRADE_B` | `GRADE_C`

### ColonyStrength
`STRONG` | `MEDIUM` | `WEAK` | `DEAD`

### BeeDisease
`VARROA` | `AFB` | `EFB` | `NOSEMA` | `NONE`
