# Phase 1 Completion Report — Sub-domains & Value Chains

**Date**: 2026-04-25
**Status**: Complete
**Owner**: CC-5 (Frontend) + CC-1 (Platform)

---

## 1. Deliverables Summary

### 1.1 Data Model (Prisma)
- `sub_domains` table in `governance` schema with unique constraint `(domain_id, code)`
- `value_chain_codes` table — 7 seeded codes (DAIRY, RED_MEAT, POULTRY, PORK, SMALL_RUMINANTS, FISHERIES_AQUA, APICULTURE)
- `SubDomainType` enum: `VALUE_CHAIN | ORGANIZATIONAL | PATHOLOGY | OTHER`
- Foreign keys: `sub_domains.domain_id → domains.id`, `sub_domains.value_chain_code → value_chain_codes.code`

### 1.2 Seeded Sub-domains

| Domain | Sub-domains | Type | Notes |
|--------|-------------|------|-------|
| Livestock Production | DAIRY, RED_MEAT, POULTRY, PORK, SMALL_RUMINANTS, APICULTURE | VALUE_CHAIN | APICULTURE: `active=false` (feature flag) |
| Veterinary Governance | CLINICS, SLAUGHTERHOUSES, LEGAL_FRAMEWORKS, VACCINATION, SURVEILLANCE, LABORATORIES | ORGANIZATIONAL | — |
| Economic & Trade | DAIRY_TRADE, RED_MEAT_TRADE, POULTRY_TRADE, PORK_TRADE, SMALL_RUMINANTS_TRADE, FISHERIES_AQUA_TRADE | VALUE_CHAIN | Tagged with corresponding value chain codes |

### 1.3 Backend API (Credential Service)

#### Admin CRUD (`/api/v1/credential/admin/sub-domains`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/sub-domains?page=&limit=&domainCode=&typeEnum=&active=&valueChainCode=` | Paginated list with filters |
| `POST` | `/admin/sub-domains` | Create sub-domain |
| `PATCH` | `/admin/sub-domains/:id` | Update sub-domain |
| `DELETE` | `/admin/sub-domains/:id` | Delete (409 if in use) |

#### Consultation endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/domains/:code/sub-domains` | Active sub-domains of a domain |
| `GET` | `/value-chain-codes/:code/sub-domains` | Transverse: all sub-domains sharing a value chain |
| `GET` | `/me/access` | User's resolved hierarchical permissions |

### 1.4 Kafka Topics
```
sys.credential.subdomain.created.v1
sys.credential.subdomain.updated.v1
sys.credential.subdomain.deleted.v1
sys.credential.subdomain.activated.v1
sys.credential.subdomain.deactivated.v1
```

Dynamic topic builder:
```typescript
import { domainSubDomainTopic } from '@aris/shared-types';
// domainSubDomainTopic('ms', 'livestock-prod', 'dairy', 'created')
// → "ms.livestock-prod.dairy.created.v1"
```

### 1.5 Frontend — Zustand Domain Store

**File**: `apps/web/src/lib/stores/domain-store.ts`

Key methods:
```typescript
useDomainStore.getState().hasAccess('livestock-prod')           // boolean
useDomainStore.getState().hasAccessToSubDomain('livestock-prod', 'DAIRY')  // boolean
useDomainStore.getState().hasAccessToValueChain('DAIRY')        // boolean
useDomainStore.getState().getSubDomainsOfDomain('livestock-prod')  // SubDomain[]
useDomainStore.getState().getSubDomainsByValueChain('DAIRY')    // SubDomain[] (cross-domain)
useDomainStore.getState().getAccessibleValueChainCodes()        // string[]
```

Hydrated from `/me/access` on login via `hydrateFromMeAccess()`.

### 1.6 Frontend — Hooks

**File**: `apps/web/src/hooks/use-sub-domains.ts`
```typescript
const subs = useSubDomains('livestock-prod');       // SubDomain[]
const vcSubs = useValueChainSubDomains('DAIRY');    // SubDomain[] cross-domain
const vcs = useAccessibleValueChains();             // ValueChainCode[]
```

### 1.7 Admin UI

**Routes**:
- `/admin/sub-domains` — List with filters (domain, type, active, value chain, text search), toggle active, pagination
- `/admin/sub-domains/new` — Create form with validation
- `/admin/sub-domains/[id]` — Detail view + edit + activate/deactivate + delete with 409 handling

**Access**: SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN only.

### 1.8 E2E Tests

**File**: `tests/e2e/scenarios/phase-1/sub-domains.spec.ts` (6 scenarios)

1. Admin creates a VALUE_CHAIN sub-domain
2. Focal point cannot see admin menu
3. Drill-down domain -> sub-domain
4. Transverse value chain view
5. Inactive sub-domain not visible
6. Admin activates sub-domain

---

## 2. Exit Criteria Checklist

- [x] Prisma schema contains `sub_domains` and `value_chain_codes`
- [x] 7 value_chain_codes seeded
- [x] Livestock Production: 6 sub-domains (Dairy, Red meat, Poultry, Pork, Small ruminants, Apiculture)
- [x] Apiculture: `active = false` by feature flag
- [x] Veterinary Governance: 6 sub-domains ORGANIZATIONAL
- [x] Economic & Trade: 6 sub-domains VALUE_CHAIN tagged
- [x] Credential service exposes CRUD sub-domains
- [x] Credential service exposes `/me/access`
- [x] Hierarchical JWT issued and validated across all microservices
- [x] Zustand store hydrates from `/me/access`
- [x] Admin UI creates/modifies/deletes sub-domains
- [x] Focal points cannot see admin menu item
- [x] Drill-down domain -> sub-domain works
- [x] Transverse `/value-chains/DAIRY` aggregates Livestock + Economic & Trade
- [x] Kafka topics: `subdomain.*` + dynamic generation helper
- [x] E2E tests written

---

## 3. Onboarding Guide — Sub-domains Model

### Key Concepts

1. **Domain** = top-level business area (e.g., `livestock-prod`, `animal-health`). Defined in `governance.domains`.
2. **Sub-domain** = subdivision within a domain. Each has a `code`, `typeEnum`, and optional `valueChainCode`.
3. **Value Chain Code** = cross-domain tag. `DAIRY` can appear in both `livestock-prod` and `trade-sps`. Enables transverse views.
4. **Permissions** = hierarchical: `{ "livestock-prod": ["DAIRY", "RED_MEAT"] }` or `{ "livestock-prod": ["*"] }`.

### Adding a New Sub-domain (Backend)

1. Seed via API or directly in Prisma:
```typescript
await prisma.subDomain.create({
  data: {
    code: 'CAMELIDS',
    domainId: livestockDomain.id,
    typeEnum: 'VALUE_CHAIN',
    valueChainCode: null,  // or create a new ValueChainCode first
    labelFr: 'Camelides',
    labelEn: 'Camelids',
    active: true,
    displayOrder: 60,
  },
});
```

2. Or via Admin UI at `/admin/sub-domains/new`.

### Using Sub-domains in Frontend Code

```typescript
// In a domain page component:
import { useSubDomains } from '@/hooks/use-sub-domains';
import { useDomainStore } from '@/lib/stores/domain-store';

function LivestockPage() {
  const subs = useSubDomains('livestock-prod');
  const hasAccess = useDomainStore((s) => s.hasAccessToSubDomain);

  return (
    <div>
      {subs.map((sd) => (
        <SubDomainCard key={sd.id} subDomain={sd} />
      ))}
    </div>
  );
}
```

### Using Value Chains for Transverse Views

```typescript
import { useValueChainSubDomains, useAccessibleValueChains } from '@/hooks/use-sub-domains';

function DairyValueChainPage() {
  const subs = useValueChainSubDomains('DAIRY');
  // subs contains sub-domains from BOTH livestock-prod AND trade-sps

  return (
    <div>
      {subs.map((sd) => (
        <div key={sd.id}>
          {sd.labelEn} ({sd.domainCode})
        </div>
      ))}
    </div>
  );
}
```

### API Examples

```bash
# List all sub-domains (admin)
GET /api/v1/credential/admin/sub-domains?page=1&limit=20

# Filter by domain
GET /api/v1/credential/admin/sub-domains?domainCode=livestock-prod

# Filter by type
GET /api/v1/credential/admin/sub-domains?typeEnum=VALUE_CHAIN&active=true

# Get user's resolved access
GET /api/v1/credential/me/access
# Response: { userId, role, domains: { "livestock-prod": ["DAIRY","RED_MEAT"] }, subDomainsDetails: [...], valueChainCodes: [...] }

# Transverse query
GET /api/v1/credential/value-chain-codes/DAIRY/sub-domains
# Response: { data: [{ code: "DAIRY", domainCode: "livestock-prod", ... }, { code: "DAIRY_TRADE", domainCode: "trade-sps", ... }], valueChain: { code: "DAIRY", ... } }
```

### Kafka Integration

When a sub-domain is modified, the credential service publishes events:

```typescript
import {
  TOPIC_SYS_CREDENTIAL_SUBDOMAIN_CREATED,
  TOPIC_SYS_CREDENTIAL_SUBDOMAIN_ACTIVATED,
  domainSubDomainTopic,
} from '@aris/shared-types';

// Listen for sub-domain changes
consumer.subscribe({ topic: TOPIC_SYS_CREDENTIAL_SUBDOMAIN_CREATED });

// Build domain-specific topics dynamically
const topic = domainSubDomainTopic('ms', 'livestock-prod', 'dairy', 'created');
// → "ms.livestock-prod.dairy.created.v1"
```

---

## 4. Architecture Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin UI   │────▶│ Credential Svc   │────▶│   PostgreSQL    │
│ /admin/     │     │ /admin/sub-domains│     │ governance.*    │
│ sub-domains │◀────│ /me/access        │     │ sub_domains     │
└─────────────┘     └──────┬───────────┘     │ value_chain_codes│
                           │                  └─────────────────┘
                           │ Kafka
                           ▼
              ┌────────────────────────┐
              │ sys.credential.        │
              │   subdomain.created.v1 │
              │   subdomain.updated.v1 │
              │   subdomain.deleted.v1 │
              │   subdomain.activated  │
              │   subdomain.deactivated│
              └────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │ Domain Svcs  │          │ Frontend    │
     │ (consumers)  │          │ Zustand     │
     │ Invalidate   │          │ domain-store│
     │ local cache  │          │ hydrate from│
     └─────────────┘          │ /me/access  │
                              └─────────────┘
```

---

## 5. What's Next — Phase 2 Preview

- **Dynamic form builder integration**: Forms scoped to sub-domains
- **Data collection campaigns**: Filtered by sub-domain
- **Analytics dashboards**: Sub-domain level KPIs
- **Mobile sync**: Sub-domain aware offline data partitioning
