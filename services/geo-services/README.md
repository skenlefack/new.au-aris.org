# Geo Services

**Port:** 3031
**ARIS 4.0 Microservice** -- Centralized geospatial service for PostGIS spatial queries, boundary lookups, risk maps, reverse geocoding, and proximity analysis.

## Tech

| Component     | Technology                                  |
|---------------|---------------------------------------------|
| Runtime       | Node.js 22 LTS                              |
| Framework     | Fastify 5                                   |
| Database      | PostgreSQL 16 + PostGIS 3.4 (via `$queryRaw`) |
| ORM           | PrismaClient (raw SQL for PostGIS functions) |
| Cache         | Redis 7 via ioredis                         |
| Auth          | JWT RS256 (`@aris/auth-middleware`)          |
| Language      | TypeScript 5 (strict mode)                  |

## Routes

| Method | Path                                | Auth | Description                                      |
|--------|-------------------------------------|------|--------------------------------------------------|
| GET    | `/health`                           | No   | Health check                                     |
| GET    | `/api/v1/geo/layers`                | Yes  | List active map layers                           |
| GET    | `/api/v1/geo/query/within`          | Yes  | Spatial query by bounding box (ST_MakeEnvelope)  |
| GET    | `/api/v1/geo/query/nearest`         | Yes  | Proximity search (ST_DWithin + ST_MakePoint)     |
| GET    | `/api/v1/geo/query/contains`        | Yes  | Reverse geocode: admin hierarchy at a point      |
| GET    | `/api/v1/geo/risk-map`              | Yes  | Disease risk heatmap by admin boundary           |
| GET    | `/api/v1/geo/admin-boundaries/:code`| Yes  | Single admin boundary by code                    |

### Query Parameters

**`/api/v1/geo/query/within`**
- `minLng`, `minLat`, `maxLng`, `maxLat` (required) -- Bounding box coordinates
- `level` (optional) -- Admin level filter (e.g. `COUNTRY`, `ADMIN1`, `ADMIN2`)
- `limit` (optional, default 100)

**`/api/v1/geo/query/nearest`**
- `lat`, `lng` (required) -- Reference point
- `level` (optional) -- Admin level filter
- `maxDistance` (optional, default 100000 meters)
- `limit` (optional, default 5)

**`/api/v1/geo/query/contains`**
- `lat`, `lng` (required) -- Point to reverse geocode

**`/api/v1/geo/risk-map`**
- `diseaseId` (required) -- UUID of the disease
- `periodStart`, `periodEnd` (required) -- ISO date range
- `countryCode` (optional) -- Restrict to a single country
- `adminLevel` (optional, default `ADMIN2`) -- `ADMIN1` or `ADMIN2`

## Cache Strategy

All query results are cached in Redis with domain-aware keys:

| Data Type          | TTL       | Key Pattern                             |
|--------------------|-----------|-----------------------------------------|
| Map layers         | 1 hour    | `geo:layers`                            |
| Bounding box query | 5 minutes | `geo:within:{minLng}:{minLat}:...`      |
| Nearest query      | 5 minutes | `geo:nearest:{lat}:{lng}:...`           |
| Contains query     | 1 hour    | `geo:contains:{lat}:{lng}`              |
| Admin boundary     | 1 hour    | `geo:boundary:{code}`                   |
| Risk map           | 5 minutes | `geo:risk:{diseaseId}:{start}:{end}:...`|

## Environment Variables

| Variable             | Required | Default | Description                        |
|----------------------|----------|---------|------------------------------------|
| `GEO_SERVICES_PORT`  | No       | `3031`  | HTTP listen port                   |
| `DATABASE_URL`       | Yes      | --      | PostgreSQL connection (via PgBouncer, port 6432) |
| `REDIS_URL`          | Yes      | --      | Redis connection string            |
| `JWT_PUBLIC_KEY`     | Yes      | --      | RS256 public key for JWT validation|
| `JWT_PUBLIC_KEY_PATH`| No       | --      | Alternative: path to PEM key file  |
| `LOG_LEVEL`          | No       | `info`  | Pino log level                     |

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start the service in dev mode (with hot reload)
pnpm dev

# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build for production
pnpm build

# Start production build
pnpm start
```

## Project Structure

```
services/geo-services/
├── src/
│   ├── __tests__/
│   │   └── geo.service.spec.ts    # Unit tests for GeoService
│   ├── geo/
│   │   └── entities/
│   │       └── geo.entity.ts      # Types, helpers (buildFeature, classifySeverity)
│   ├── plugins/
│   │   ├── prisma.ts              # Fastify plugin: PrismaClient
│   │   └── redis.ts               # Fastify plugin: ioredis
│   ├── routes/
│   │   ├── health.routes.ts       # /health endpoint
│   │   └── geo.routes.ts          # All /api/v1/geo/* endpoints
│   ├── schemas/
│   │   └── geo.schema.ts          # TypeBox schemas for request validation
│   ├── services/
│   │   └── geo.service.ts         # Core business logic (PostGIS queries + caching)
│   ├── types/
│   │   └── fastify.d.ts           # Fastify type augmentations
│   ├── app.ts                     # Fastify app builder
│   └── server.ts                  # Entry point
├── package.json
├── tsconfig.json
└── vitest.config.ts
```
