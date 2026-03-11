# Trade & SPS Service

ARIS 4.0 Trade, Markets & SPS microservice (port **3025**).

Manages trade flows, SPS certificates, and market price intelligence aligned with AfCFTA requirements.

## Domain Entities

| Entity | Prisma Model | Classification | Description |
|--------|-------------|---------------|-------------|
| Trade Flow | `tradeFlow` | PARTNER | Import/export/transit flows between countries |
| SPS Certificate | `spsCertificate` | RESTRICTED | Sanitary & phytosanitary certification |
| Market Price | `marketPrice` | PUBLIC | Commodity pricing at designated markets |

## API Routes

### Trade Flows

```
POST   /api/v1/trade/flows          Create trade flow
GET    /api/v1/trade/flows          List trade flows (paginated, filterable)
GET    /api/v1/trade/flows/:id      Get trade flow by ID
PATCH  /api/v1/trade/flows/:id      Update trade flow
```

### SPS Certificates

```
POST   /api/v1/trade/sps-certificates           Create SPS certificate (DRAFT)
GET    /api/v1/trade/sps-certificates           List SPS certificates
GET    /api/v1/trade/sps-certificates/:id       Get SPS certificate by ID
PATCH  /api/v1/trade/sps-certificates/:id       Update SPS certificate
POST   /api/v1/trade/sps-certificates/:id/issue Issue certificate (DRAFT -> ISSUED)
```

### Market Prices

```
POST   /api/v1/trade/market-prices          Create market price record
GET    /api/v1/trade/market-prices          List market prices (paginated, filterable)
GET    /api/v1/trade/market-prices/:id      Get market price by ID
PATCH  /api/v1/trade/market-prices/:id      Update market price
```

### Health

```
GET    /health    Service health check
```

## Kafka Topics

| Topic | Trigger |
|-------|---------|
| `ms.trade.flow.created.v1` | Trade flow created |
| `ms.trade.flow.updated.v1` | Trade flow updated |
| `ms.trade.sps.certified.v1` | SPS certificate created or issued |
| `ms.trade.sps.updated.v1` | SPS certificate updated |
| `ms.trade.price.recorded.v1` | Market price recorded |
| `ms.trade.price.updated.v1` | Market price updated |

## RBAC

| Entity | Allowed Roles |
|--------|--------------|
| Trade Flow | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD |
| SPS Certificate | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, WAHIS_FOCAL_POINT |
| Market Price | SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD |

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

## Architecture

```
Fastify HTTP
  -> Auth hook (JWT RS256 + RBAC)
  -> Routes (schema validation via TypeBox)
  -> Services (business logic)
    -> Prisma (PostgreSQL via PgBouncer)
    -> Kafka Producer (domain events)
    -> Audit Service (mutation logging)
```
