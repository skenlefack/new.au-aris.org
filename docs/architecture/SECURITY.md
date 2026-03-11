# Security Architecture

> Authentication, authorization, data classification, and encryption for ARIS 4.0.

## 1. Authentication Flow

### JWT RS256 Token Flow

ARIS uses **custom JWT RS256** authentication (no external IdP dependency) via the credential service.

```mermaid
sequenceDiagram
    participant Client
    participant Credential as Credential Service :3002
    participant Service as Any Service
    participant AuthMW as @aris/auth-middleware

    Client->>Credential: POST /api/v1/credential/auth/login {email, password}
    Credential->>Credential: Verify bcrypt hash
    Credential->>Credential: Sign JWT with RS256 private key
    Credential-->>Client: {accessToken, refreshToken, expiresIn}

    Client->>Service: GET /api/v1/... (Authorization: Bearer <token>)
    Service->>AuthMW: Validate JWT with RS256 public key
    AuthMW->>AuthMW: Extract userId, role, tenantId, tenantLevel
    AuthMW-->>Service: AuthenticatedUser object
    Service-->>Client: Response {data, meta}

    Note over Client: Token expires (15 min default)
    Client->>Credential: POST /api/v1/credential/auth/refresh {refreshToken}
    Credential-->>Client: {accessToken, refreshToken, expiresIn}
```

### Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@ke.gov",
  "role": "DATA_STEWARD",
  "tenantId": "tenant-uuid",
  "tenantLevel": "MEMBER_STATE",
  "iat": 1700000000,
  "exp": 1700000900,
  "iss": "aris-credential-service"
}
```

### Key Management

| Item | Details |
|------|---------|
| Algorithm | RS256 (RSA + SHA-256) |
| Key size | 2048-bit minimum |
| Private key | `JWT_PRIVATE_KEY_PATH` — used by credential service only |
| Public key | `JWT_PUBLIC_KEY_PATH` — distributed to all services |
| Access token TTL | 15 minutes (`JWT_ACCESS_EXPIRES_IN`) |
| Refresh token TTL | 7 days (`JWT_REFRESH_EXPIRES_IN`) |
| Key rotation | Manual; update key pair, restart services |

### Password Security

| Item | Details |
|------|---------|
| Hashing | bcrypt with salt rounds = 12 |
| MFA | TOTP-based (mfaEnabled, mfaSecret on User model) |
| Rate limiting | Per-IP and per-user on login endpoint |

## 2. RBAC — Role-Based Access Control

### 8 Roles

```mermaid
graph TD
    SA[SUPER_ADMIN<br/>AU-IBAR System Admin] --> CA[CONTINENTAL_ADMIN<br/>AU-IBAR Program Officers]
    CA --> RA[REC_ADMIN<br/>REC Coordinators]
    RA --> NA[NATIONAL_ADMIN<br/>National Administrators / CVO]
    NA --> DS[DATA_STEWARD<br/>Data Quality Officers]
    NA --> WFP[WAHIS_FOCAL_POINT<br/>Authorized WOAH Reporters]
    DS --> AN[ANALYST<br/>Read-Only Analysts]
    NA --> FA[FIELD_AGENT<br/>Mobile Data Collectors]
```

| Role | Level | Permissions |
|------|-------|------------|
| `SUPER_ADMIN` | Continental | Full system access, user management, configuration |
| `CONTINENTAL_ADMIN` | Continental | All data read/write, contract management, interop |
| `REC_ADMIN` | REC | REC + child Member State data, workflow L3 |
| `NATIONAL_ADMIN` | Member State | National data CRUD, user management, workflow L2 |
| `DATA_STEWARD` | Member State/REC | Quality validation, correction, workflow L1/L3 |
| `WAHIS_FOCAL_POINT` | Member State | WAHIS export, SPS certification |
| `ANALYST` | Any | Read-only access to published/analytical data |
| `FIELD_AGENT` | Member State | Mobile data submission, offline sync |

### Workflow RBAC Mapping

| Workflow Level | Authorized Roles |
|---------------|-----------------|
| NATIONAL_TECHNICAL (L1) | DATA_STEWARD, NATIONAL_ADMIN |
| NATIONAL_OFFICIAL (L2) | NATIONAL_ADMIN, WAHIS_FOCAL_POINT |
| REC_HARMONIZATION (L3) | REC_ADMIN, DATA_STEWARD |
| CONTINENTAL_PUBLICATION (L4) | CONTINENTAL_ADMIN, SUPER_ADMIN |

### Auth Guards (NestJS)

Every protected endpoint uses three guards from `@aris/auth-middleware`:

```typescript
@UseGuards(AuthGuard)      // Validates JWT, extracts user
@UseGuards(TenantGuard)    // Enforces tenant isolation
@UseGuards(RolesGuard)     // Checks role against @Roles() decorator
@Roles(UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)
```

## 3. Multi-Tenant Isolation

### Tenant Hierarchy

```
AU-IBAR (CONTINENTAL)
  ├── IGAD (REC)
  │   ├── Kenya (MEMBER_STATE)
  │   ├── Ethiopia (MEMBER_STATE)
  │   └── ...
  ├── ECOWAS (REC)
  │   ├── Nigeria (MEMBER_STATE)
  │   └── ...
  └── ... (8 RECs total)
```

### Isolation Rules

| User Level | Data Access |
|-----------|-------------|
| CONTINENTAL | All tenants (read everything) |
| REC | Own tenant + child Member State tenants |
| MEMBER_STATE | Own tenant only |

### Implementation

- Every DB query includes `WHERE tenant_id = ?`
- `tenantId` extracted from JWT by `TenantGuard`
- Parent-child resolution via tenant service
- Inter-service calls forward `x-tenant-id` header

## 4. Data Classification

### 4 Levels (Annex B &sect;B6)

| Level | Description | Access |
|-------|-------------|--------|
| `PUBLIC` | Open data, aggregated stats | All authenticated users |
| `PARTNER` | Shared with authorized orgs (WOAH, FAO) | ANALYST+ with partner agreements |
| `RESTRICTED` | Individual outbreak data, unconfirmed reports | DATA_STEWARD+, same tenant |
| `CONFIDENTIAL` | Credentials, security configs, national security | SUPER_ADMIN, NATIONAL_ADMIN only |

### Rules

- Classification is **inherited** by derived products (e.g., a dashboard from RESTRICTED data is RESTRICTED)
- Every entity has a `dataClassification` field
- Audit trail entries record the classification level
- Export packages respect classification (WAHIS exports only PARTNER+ data)

## 5. Kafka Security

### ACL Configuration

| Principal | Topic Pattern | Operations |
|-----------|--------------|------------|
| `animal-health-service` | `ms.health.*` | WRITE |
| `analytics-service` | `ms.health.*`, `au.workflow.*`, `ms.collecte.*` | READ |
| `workflow-service` | `au.workflow.*` | WRITE |
| `workflow-service` | `au.quality.*` | READ |
| `interop-hub-service` | `au.interop.*` | WRITE |
| `interop-hub-service` | `au.workflow.wahis.ready.*` | READ |
| `data-quality-service` | `au.quality.*` | WRITE |
| `collecte-service` | `ms.collecte.*` | WRITE |

### Message Security

- All Kafka messages include `tenantId` in headers
- Consumer services validate `tenantId` matches expected scope
- DLQ topics capture failed messages for manual review
- No PII in topic keys (use entity UUIDs only)

## 6. Encryption

### At Rest

| Component | Encryption |
|-----------|-----------|
| PostgreSQL | Filesystem-level encryption (LUKS/dm-crypt) |
| Redis | No built-in encryption (use network-level isolation) |
| MinIO | Server-side encryption (SSE-S3) |
| OpenSearch | Filesystem-level encryption |
| JWT private keys | File permissions (600), stored outside repo |

### In Transit

| Component | Encryption |
|-----------|-----------|
| Client ↔ API | TLS 1.3 (HTTPS) |
| Service ↔ PostgreSQL | SSL mode = `require` |
| Service ↔ Redis | TLS (optional, recommended for production) |
| Service ↔ Kafka | SASL_SSL (production) / PLAINTEXT (dev) |
| Service ↔ MinIO | TLS |

## 7. Audit Trail

Every mutation is logged with:

```typescript
interface AuditEntry {
  id: string;
  entityType: string;          // e.g., "HealthEvent", "User"
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';
  actor: {
    userId: string;
    role: UserRole;
    tenantId: string;
  };
  timestamp: Date;
  reason?: string;             // Required for DELETE, REJECT
  previousVersion?: object;    // Snapshot before change
  newVersion?: object;         // Snapshot after change
  dataClassification: DataClassification;
}
```

### Storage

- Master data audit: `MasterDataAudit` table in PostgreSQL
- Domain service audit: Kafka events (retained for compliance)
- Shared audit table: `audit.audit_log` with indexes on entity, actor, tenant, timestamp

## 8. PgBouncer Security

### Connection Pooling Isolation

PgBouncer provides an additional security layer between services and PostgreSQL:

| Aspect | Configuration |
|--------|--------------|
| **Authentication** | MD5 password authentication via `userlist.txt` |
| **Connection limit** | `max_client_conn = 500` prevents connection exhaustion attacks |
| **Admin access** | Restricted to `admin_users = aris` |
| **Stats access** | Restricted to `stats_users = aris` |
| **Network** | Runs on internal `aris-network` only; port 6432 exposed for host access |

### Production Hardening

- Use MD5-hashed passwords in `userlist.txt` (not plaintext)
- Restrict `admin_users` to a dedicated monitoring account
- Enable TLS between PgBouncer and PostgreSQL (`server_tls_sslmode = require`)
- Limit `max_client_conn` per service using separate PgBouncer instances or databases

## 9. Redis Cache Security

### Key Prefix Isolation

The `@aris/cache` package uses domain-aware key prefixes to logically isolate cache data:

```
aris:master-data:species:*       # Master data domain
aris:credential:session:*        # Session data
aris:animal-health:outbreak:*    # Animal health domain
aris:rate-limit:login:*          # Rate limiting
aris:lock:import:*               # Distributed locks
```

### Security Considerations

| Aspect | Implementation |
|--------|---------------|
| **Key isolation** | Domain prefix prevents cross-service key collisions |
| **Eviction policy** | `allkeys-lru` (512 MB max) — no sensitive data persists indefinitely |
| **No PII in cache** | Cache aggregated data; avoid caching personal information |
| **Rate limiting** | `incrWithTtl` for login attempt tracking per IP/user |
| **Lock tokens** | Random UUID tokens prevent lock theft between services |

### Production Hardening

- Enable Redis AUTH with a strong password
- Enable TLS (`tls-port 6380`)
- Use Redis ACLs to restrict command access per service
- Deploy Redis Sentinel or Cluster for HA

## 10. JWT Key Loading

The credential service supports loading RSA keys from PEM files with an inline environment variable fallback:

```
Priority:
1. File path: keys/private.pem, keys/public.pem (JWT_PRIVATE_KEY_PATH, JWT_PUBLIC_KEY_PATH)
2. Environment variable: JWT_PRIVATE_KEY, JWT_PUBLIC_KEY (inline PEM content)
```

### File-Based Keys (Recommended)

```env
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

- Keys directory is in `.gitignore`
- File permissions should be `600` (owner read/write only)
- In production, mount keys from Kubernetes Secrets or HashiCorp Vault

### Environment Variable Fallback

```env
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
```

Used in Docker Compose and CI/CD environments where file mounting is impractical.

## 11. NestJS Module Naming

To avoid NestJS dependency injection conflicts, service-specific modules must use unique names when the same module name exists in shared packages.

### Known Conflict: `AuthModule`

The `@aris/auth-middleware` package exports a `@Global()` `AuthModule`. The credential service also has its own auth module. To prevent injection conflicts:

```typescript
// packages/auth-middleware: @Global() AuthModule — validates JWTs
// services/credential: CredentialAuthModule — handles login/register

// services/credential/src/auth/auth.module.ts
@Module({ ... })
export class CredentialAuthModule {}  // NOT "AuthModule"
```

### Convention

- Shared package modules: Use generic names (`AuthModule`, `KafkaModule`, `CacheModule`)
- Service-specific modules: Prefix with service name (`CredentialAuthModule`, `MasterDataGeoModule`)

## 12. Security Checklist

- [x] JWT RS256 asymmetric key authentication
- [x] bcrypt password hashing (12 salt rounds)
- [x] RBAC with 8 roles and per-endpoint guards
- [x] Multi-tenant isolation (tenantId in every query)
- [x] Data classification on every entity
- [x] Audit trail for every mutation
- [x] Rate limiting on auth endpoints
- [x] MFA support (TOTP)
- [x] DLQ for failed message processing
- [x] PgBouncer connection pooling with MD5 auth
- [x] Redis key prefix isolation per domain
- [x] JWT RSA key loading from PEM files
- [x] NestJS module naming convention (no injection conflicts)
- [ ] Kafka SASL_SSL (production)
- [ ] TLS between all services (production)
- [ ] WAF (Web Application Firewall)
- [ ] SIEM integration
- [ ] Penetration testing
