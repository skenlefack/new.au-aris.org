# Governance Service

ARIS 4.0 Governance & Capacities domain service (port 3026).

Covers legal frameworks, institutional capacities, veterinary services evaluations, and stakeholder registry for AU Member States.

## Tech Stack

- **Runtime**: Fastify 5 + TypeScript
- **ORM**: Prisma (PostgreSQL via PgBouncer)
- **Events**: Apache Kafka (StandaloneKafkaProducer)
- **Auth**: JWT RS256 via `@aris/auth-middleware/fastify`
- **Validation**: `@sinclair/typebox` JSON schemas

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/governance/legal-frameworks` | Create legal framework |
| GET | `/api/v1/governance/legal-frameworks` | List legal frameworks |
| GET | `/api/v1/governance/legal-frameworks/:id` | Get legal framework |
| PATCH | `/api/v1/governance/legal-frameworks/:id` | Update legal framework |
| POST | `/api/v1/governance/legal-frameworks/:id/adopt` | Adopt legal framework |
| POST | `/api/v1/governance/capacities` | Create capacity record |
| GET | `/api/v1/governance/capacities` | List capacity records |
| GET | `/api/v1/governance/capacities/:id` | Get capacity record |
| PATCH | `/api/v1/governance/capacities/:id` | Update capacity record |
| POST | `/api/v1/governance/vet-evaluations` | Create veterinary evaluation |
| GET | `/api/v1/governance/vet-evaluations` | List veterinary evaluations |
| GET | `/api/v1/governance/vet-evaluations/:id` | Get veterinary evaluation |
| PATCH | `/api/v1/governance/vet-evaluations/:id` | Update veterinary evaluation |
| POST | `/api/v1/governance/stakeholders` | Create stakeholder |
| GET | `/api/v1/governance/stakeholders` | List stakeholders |
| GET | `/api/v1/governance/stakeholders/:id` | Get stakeholder |
| PATCH | `/api/v1/governance/stakeholders/:id` | Update stakeholder |

## Kafka Topics

- `ms.governance.framework.created.v1`
- `ms.governance.framework.adopted.v1`
- `ms.governance.framework.updated.v1`
- `ms.governance.capacity.created.v1`
- `ms.governance.capacity.updated.v1`
- `ms.governance.vet-evaluation.created.v1`
- `ms.governance.vet-evaluation.updated.v1`
- `ms.governance.stakeholder.created.v1`
- `ms.governance.stakeholder.updated.v1`

## Development

```bash
pnpm dev          # Start with hot reload (tsx watch)
pnpm test         # Run unit tests
pnpm build        # TypeScript build
```

## Data Classification Defaults

| Entity | Default |
|--------|---------|
| LegalFramework | PUBLIC |
| InstitutionalCapacity | PARTNER |
| VetEvaluation | PARTNER |
| StakeholderRegistry | PUBLIC |

## Business Rules

- **Capacity uniqueness**: One record per tenant + year + organization name (409 on duplicate)
- **Framework adoption**: `POST /:id/adopt` transitions status to ADOPTED and sets `adoptionDate` to current timestamp
- **Stakeholder domains**: Array field filtered with Prisma `{ has }` operator
- **Tenant isolation**: MEMBER_STATE sees own data only; REC sees own; CONTINENTAL sees all
