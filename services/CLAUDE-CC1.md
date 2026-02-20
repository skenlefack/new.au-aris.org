# CLAUDE.md — CC-1 Platform Core

## Your Scope
You own ALL shared packages and platform services:
- `packages/shared-types/` — TS types, DTOs, Kafka event contracts, enums
- `packages/kafka-client/` — Generic Kafka producer/consumer with DLQ
- `packages/auth-middleware/` — JWT RS256 validation, RBAC guards, tenant extraction
- `packages/db-schemas/` — Prisma schemas and migrations (one schema per service)
- `packages/quality-rules/` — Shared data quality gate rule definitions
- `packages/test-utils/` — Test factories, Testcontainers helpers
- `services/tenant/` (port 3001) — Multi-tenant hierarchy management
- `services/credential/` (port 3002) — Authentication, authorization, user management
- `services/message/` (port 3006) — Multi-channel notifications
- `services/drive/` (port 3007) — File/document storage (MinIO S3)
- `services/realtime/` (port 3008) — WebSocket real-time sync

## Critical: You Are the Foundation
Every other CC instance depends on your packages. Quality and stability here is paramount.
- `@aris/shared-types` is the single source of truth for all inter-service contracts
- `@aris/kafka-client` is used by EVERY service — idempotent producer, manual commit consumer, DLQ
- `@aris/auth-middleware` protects EVERY endpoint — JWT RS256, RBAC, tenant isolation
- `@aris/db-schemas` owns ALL Prisma migrations — other CCs describe what they need, you implement

## Key Entities

### Tenant (services/tenant/)
```typescript
interface Tenant {
  id: string;            // UUID
  name: string;          // "Republic of Kenya", "IGAD", "AU-IBAR"
  code: string;          // "KE", "IGAD", "AU"
  level: TenantLevel;    // CONTINENTAL | REC | MEMBER_STATE
  parentId?: string;     // Parent tenant UUID (null for AU-IBAR)
  countryCode?: string;  // ISO 3166-1 alpha-2 (for MS only)
  recCode?: string;      // REC identifier (for REC and MS)
  domain: string;        // Subdomain: "ke.aris.africa"
  config: JsonValue;     // Tenant-specific configuration
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
Endpoints: `POST /tenants`, `GET /tenants`, `GET /tenants/:id`, `PATCH /tenants/:id`, `GET /tenants/:id/children`

### User (services/credential/)
```typescript
interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;    // bcrypt
  firstName: string;
  lastName: string;
  role: UserRole;           // 8 roles (see root CLAUDE.md)
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /users`, `GET /users/me`, `PATCH /users/:id`

Auth flow: Login → bcrypt verify → generate JWT (RS256, 15min) + refresh token (Redis, 7d) → return tokens.
JWT payload: `{ sub, email, role, tenantId, tenantLevel, iat, exp }`

## Kafka Topics Produced
- `sys.tenant.created.v1` / `sys.tenant.updated.v1`
- `sys.credential.user.created.v1` / `sys.credential.user.authenticated.v1`
- `sys.message.notification.sent.v1` / `sys.message.notification.failed.v1`
- `sys.drive.file.uploaded.v1`

## Kafka Topics Consumed
- `au.workflow.validation.completed.v1` → trigger notifications
- `ms.collecte.form.submitted.v1` → trigger notifications to supervisors

## Package: @aris/shared-types
Must export:
- All enums: `TenantLevel`, `UserRole`, `DataClassification`, `WorkflowLevel`, `WorkflowStatus`, `QualityGateResult`, `OutbreakStatus`, `SurveillanceType`, etc.
- All DTOs: `CreateTenantDto`, `LoginDto`, `TokenResponse`, `PaginatedResponse<T>`, `ApiResponse<T>`, etc.
- Kafka contracts: `KafkaEvent<T>`, `KafkaHeaders`, `DomainEvent`, topic name constants
- Master Data types: `Country`, `AdminLevel`, `Species`, `Disease`, `Unit`, `Denominator`
- Quality types: `QualityReport`, `QualityViolation`, `ConfidenceLevel`

## Package: @aris/kafka-client
- `KafkaProducerService`: idempotent (`enable.idempotence=true`), JSON serialization, schema version in headers, retry with exponential backoff
- `KafkaConsumerService`: manual commit (no auto-commit), `@KafkaSubscribe(topic, groupId)` decorator, DLQ after 3 failures, deserialization + validation
- `KafkaModule.forRoot(config)`: NestJS dynamic module

## Package: @aris/auth-middleware
- `AuthGuard`: validates JWT RS256, extracts user from payload
- `RolesGuard`: checks `@Roles(UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)`
- `TenantGuard`: ensures user can only access their tenant + children
- `ClassificationGuard`: checks user role meets data classification level
- `@CurrentUser()` decorator: injects authenticated user
- `@CurrentTenant()` decorator: injects tenant context
- Rate limiting: configurable per-endpoint

## Testing
- Unit: Vitest, mock Prisma/Kafka/Redis
- Integration: Testcontainers with real PG + Kafka + Redis
- All packages must have >90% coverage (they're shared foundations)

## Dependencies
- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@prisma/client`, `prisma`
- `kafkajs`
- `ioredis`
- `bcrypt`, `jsonwebtoken`
- `class-validator`, `class-transformer`
- `@nestjs/websockets`, `socket.io` (for realtime)
- `minio` (for drive)
- `nodemailer` (for message/email)
