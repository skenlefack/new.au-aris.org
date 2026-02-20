# ADR-008: Continental Multi-Tenant Hierarchy (AU -> REC -> Member State)

## Status

Accepted

## Date

2024-06-01

## Context

ARIS is a continental platform serving the entire African Union ecosystem. The system must enforce
strict data isolation and access control across three institutional levels: AU-IBAR at the
continental level, 8 Regional Economic Communities (RECs: IGAD, ECOWAS, ECCAS, SADC, EAC, AMU,
CEN-SAD, COMESA), and 55 Member States. Each Member State retains sovereignty over its animal
resource data, while RECs and AU-IBAR require aggregated visibility for coordination, early
warning, and policy formulation.

The multi-tenancy model must satisfy several constraints simultaneously:

- **Data Sovereignty**: A Member State's data must never be visible to another Member State unless
  explicitly shared through the validation workflow (L3/L4 approval).
- **Hierarchical Visibility**: A REC must see data from all its constituent Member States. AU-IBAR
  must see data from all RECs and all Member States. This is a strict containment hierarchy, not a
  peer-to-peer sharing model.
- **Cross-REC Membership**: Some countries belong to multiple RECs (e.g., Kenya is in both IGAD
  and EAC). The model must handle overlapping REC membership without duplicating data.
- **Performance**: TenantId-based filtering must not degrade query performance even as the dataset
  grows to millions of records across 55 countries over multiple years.
- **Simplicity**: The tenancy model must be understandable by developers across all 6 Claude Code
  instances and must not require specialized database expertise to maintain.

## Decision

We adopt a row-level tenancy model with UUID-based tenant identifiers and a hierarchical tenant
registry managed by the tenant service (port 3001).

### Tenant Registry

The tenant service maintains a `Tenant` table with the following structure:

```
Tenant {
  id:         UUID (PK)
  name:       String (e.g., "Kenya", "IGAD", "AU-IBAR")
  code:       String (ISO 3166-1 alpha-2 for MS, acronym for REC, "AU" for continental)
  level:      TenantLevel (CONTINENTAL | REC | MEMBER_STATE)
  parentId:   UUID (FK -> Tenant, nullable for AU-IBAR)
  status:     ACTIVE | SUSPENDED | ARCHIVED
  metadata:   JSONB (timezone, official languages, currency, etc.)
  createdAt:  DateTime
  updatedAt:  DateTime
}
```

For cross-REC membership, Member States have a single `parentId` pointing to their primary REC.
Secondary REC affiliations are tracked in a `TenantAffiliation` join table, which grants read
access but not administrative authority.

### TenantId on Every Entity

Every data entity across all services includes a non-nullable `tenantId` column (UUID, foreign key
to the tenant registry). This column is indexed and included in every query's WHERE clause without
exception. The `@aris/auth-middleware` package extracts the `tenantId` from the authenticated
user's JWT and injects it into the request context. Services use a `TenantGuard` that automatically
appends the tenant filter to all Prisma queries via middleware.

### Hierarchical Access Rules

| Actor Level | Can Read | Can Write |
|-------------|----------|-----------|
| MEMBER_STATE | Own tenant only | Own tenant only |
| REC | Own tenant + all child Member States | Own tenant only |
| CONTINENTAL | All tenants | Own tenant only (system-level records) |

Read access for parent tenants is implemented via a `getDescendantTenantIds(tenantId)` function
that returns all tenant IDs in the subtree. This set is cached in Redis with a 1-hour TTL and
invalidated when the tenant hierarchy changes.

### Tenant Context Propagation

The tenant context flows through the entire request lifecycle:

1. **HTTP Request**: JWT contains `tenantId` claim. Auth middleware extracts and validates it.
2. **Service Layer**: `@CurrentUser()` decorator provides the tenant context to service methods.
3. **Database Query**: Prisma middleware automatically appends `WHERE tenantId IN (...)` to all
   queries based on the user's access level.
4. **Kafka Events**: Every event payload includes `tenantId` in the header. Consumers filter
   events by tenant affiliation.
5. **Audit Trail**: Every audit entry records the `actor.tenantId` for accountability.

### Tenant Provisioning

New tenants (e.g., when a Member State joins the platform) are provisioned via the tenant service
API. Provisioning creates the tenant record, seeds initial RBAC roles (NATIONAL_ADMIN,
DATA_STEWARD), and publishes a `sys.tenant.created.v1` Kafka event that other services consume
to initialize tenant-specific resources (e.g., default quality rule configurations).

## Consequences

### Positive

- Simple mental model: every row has a `tenantId`, every query filters by it.
- Hierarchical visibility is naturally supported without complex join logic.
- Single database instance reduces operational complexity compared to per-tenant databases.
- Cross-REC membership is handled cleanly via the affiliation table.
- Redis caching of tenant hierarchies ensures parent-level queries remain performant.
- Tenant provisioning via Kafka events allows services to react to new tenants autonomously.

### Negative

- Row-level tenancy means all tenants share table space, which could create hot spots on heavily
  queried tables. Mitigation: composite indexes on `(tenantId, createdAt)` and table partitioning
  by `tenantId` for high-volume tables (e.g., outbreak events, census records).
- A bug in the tenant filter could expose data across tenants. Mitigation: the TenantGuard is
  implemented as Prisma middleware that cannot be bypassed, and integration tests verify tenant
  isolation for every service.
- The `getDescendantTenantIds` cache must be invalidated correctly when the hierarchy changes.
  Incorrect cache invalidation could grant or deny access incorrectly.

### Neutral

- The tenant hierarchy is relatively static (countries and RECs rarely change), so the overhead of
  hierarchy lookups is minimal in practice.
- The 3-level hierarchy (CONTINENTAL/REC/MEMBER_STATE) is fixed. Sub-national tenancy (provinces,
  districts) is explicitly out of scope for ARIS 3.0 but could be added as a fourth level in the
  future by extending the `TenantLevel` enum.

## Alternatives Considered

1. **Schema-per-Tenant (PostgreSQL Schemas)**: Each tenant gets a dedicated PostgreSQL schema.
   Provides strong isolation but creates operational complexity with 55+ schemas, complicates
   cross-tenant queries (needed for REC/continental aggregation), and makes schema migrations
   extremely challenging at scale.
2. **Database-per-Tenant**: Maximum isolation with separate database instances per tenant.
   Rejected due to prohibitive infrastructure costs (55+ database instances), inability to perform
   cross-tenant aggregation without a federation layer, and operational burden of managing
   migrations across all instances.
3. **Row-Level Security (PostgreSQL RLS)**: Database-enforced row filtering using PostgreSQL
   policies. Considered seriously but rejected because RLS policies are difficult to test, debug,
   and maintain across 20+ services. Application-level tenant filtering via Prisma middleware
   provides equivalent security with better developer ergonomics and testability.
4. **No Multi-Tenancy (Single-Tenant per Deployment)**: Deploy separate ARIS instances per country.
   Rejected because it defeats the purpose of a continental platform and makes aggregation,
   cross-border analysis, and centralized monitoring impossible.
