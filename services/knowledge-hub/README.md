# Knowledge Hub Service

**Port:** 3033
**Package:** `@aris/knowledge-hub-service`

## Description

The Knowledge Hub service manages the ARIS 4.0 knowledge management domain. It provides CRUD operations for publications (policy briefs, reports, guidelines, bulletins), FAQ management, and e-learning module management with enrollment and progress tracking. All mutations publish Kafka events for cross-service integration and analytics.

Built on Fastify with Prisma ORM and multi-tenant isolation enforced at the service layer.

## Tech Stack

- **Runtime:** Fastify 5
- **ORM:** PrismaClient (via `@prisma/client`)
- **Events:** StandaloneKafkaProducer (`@aris/kafka-client`)
- **Auth:** JWT RS256 validation + RBAC via `@aris/auth-middleware`
- **Validation:** TypeBox (`@sinclair/typebox`) schemas
- **IDs:** uuid v4

## API Routes

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

### Publications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/knowledge/publications` | Authenticated | List publications (paginated, filterable) |
| POST | `/api/v1/knowledge/publications` | Admin roles | Create a publication |
| GET | `/api/v1/knowledge/publications/:id` | Authenticated | Get publication by ID |
| PATCH | `/api/v1/knowledge/publications/:id` | Admin roles | Update a publication |
| GET | `/api/v1/knowledge/publications/:id/download` | Authenticated | Get download URL for publication file |

### E-Learning

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/knowledge/elearning` | Authenticated | List e-learning modules (paginated) |
| POST | `/api/v1/knowledge/elearning` | Admin roles | Create an e-learning module |
| GET | `/api/v1/knowledge/elearning/my-courses` | Authenticated | Get current user's enrolled courses |
| GET | `/api/v1/knowledge/elearning/:id` | Authenticated | Get e-learning module by ID |
| PATCH | `/api/v1/knowledge/elearning/:id` | Admin roles | Update an e-learning module |
| GET | `/api/v1/knowledge/elearning/:id/enroll` | Authenticated | Enroll in an e-learning module |
| PATCH | `/api/v1/knowledge/elearning/:id/progress` | Authenticated | Update learning progress |

### FAQ

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/knowledge/faq` | Authenticated | List FAQs (paginated, filterable) |
| POST | `/api/v1/knowledge/faq` | Admin roles | Create a FAQ entry |
| GET | `/api/v1/knowledge/faq/:id` | Authenticated | Get FAQ by ID |
| PATCH | `/api/v1/knowledge/faq/:id` | Admin roles | Update a FAQ entry |

## Multi-Tenant Access

- **CONTINENTAL** users see all records across tenants.
- **REC** users see records within their own tenant.
- **MEMBER_STATE** users see only their own tenant's records.
- Unauthorized access returns 404 (not 403) to avoid leaking resource existence.

## Kafka Topics

| Topic | Trigger |
|-------|---------|
| `au.knowledge.publication.created.v1` | Publication created |
| `au.knowledge.publication.updated.v1` | Publication updated |
| `au.knowledge.elearning.created.v1` | E-Learning module created |
| `au.knowledge.elearning.updated.v1` | E-Learning module updated |
| `au.knowledge.faq.created.v1` | FAQ created |
| `au.knowledge.faq.updated.v1` | FAQ updated |

## Development

```bash
# Install dependencies
pnpm install

# Start in development mode (hot reload)
pnpm dev

# Build for production
pnpm build

# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KNOWLEDGE_HUB_PORT` | Service port | `3033` |
| `DATABASE_URL` | PostgreSQL connection string (via PgBouncer) | - |
| `KAFKA_BROKERS` | Comma-separated Kafka broker addresses | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `knowledge-hub-service` |
| `JWT_PUBLIC_KEY` | RS256 public key for JWT validation | - |
| `DRIVE_SERVICE_URL` | URL of the Drive service for file downloads | `http://localhost:3007` |
