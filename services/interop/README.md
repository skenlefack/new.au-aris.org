# Interop V2 Service

**Port**: 3042 | **Prefix**: `/api/v1/interop-v2`

Next-generation interoperability service for ARIS 4.0. Manages connections to external animal health systems with a pluggable adapter architecture, JSONata transformation engine, and native FHIR R4 endpoints.

## Supported External Systems

| System | Adapter | Description |
|--------|---------|-------------|
| WAHIS | `WahisAdapter` | WOAH World Animal Health Information System |
| DHIS2 | `Dhis2Adapter` | District Health Information Software 2 |
| FHIR | `FhirAdapter` | FHIR R4 (HL7) - Patient, Observation, DiagnosticReport |
| OMS | `OmsAdapter` | WHO Global Health Observatory |
| EMPRES | `EmpresAdapter` | FAO Emergency Prevention System |
| FAOSTAT | `FaostatAdapter` | FAO Statistical Database |

## API Routes

### Connections
```
POST   /connections          Create connection
GET    /connections          List connections
GET    /connections/:id      Get connection
PATCH  /connections/:id      Update connection
DELETE /connections/:id      Deactivate connection
POST   /connections/:id/test Test connection
POST   /connections/:id/sync Trigger sync
```

### Mappings
```
POST   /connections/:id/mappings       Create mapping
GET    /connections/:id/mappings       List mappings
PATCH  /connections/:id/mappings/:mid  Update mapping
DELETE /connections/:id/mappings/:mid  Delete mapping
```

### Transactions
```
GET    /transactions          List transactions
GET    /transactions/:id      Get transaction
POST   /transactions/:id/retry Retry failed transaction
```

### Transform
```
POST   /transform            Test JSONata expression
```

### FHIR R4
```
GET    /fhir/Patient              Search patients
GET    /fhir/Patient/:id          Get patient
GET    /fhir/Observation          Search observations
GET    /fhir/Observation/:id      Get observation
GET    /fhir/DiagnosticReport     Search diagnostic reports
GET    /fhir/DiagnosticReport/:id Get diagnostic report
```

## Adding a New Adapter

1. Create `src/adapters/mySystem.adapter.ts` extending `BaseAdapter`:

```typescript
import { BaseAdapter, type AdapterConfig, ... } from './base.adapter.js';

export class MySystemAdapter extends BaseAdapter {
  readonly system = 'MY_SYSTEM';
  readonly displayName = 'My System';

  async connect(config: AdapterConfig): Promise<void> { }
  async disconnect(): Promise<void> { }
  async testConnection(config: AdapterConfig): Promise<ConnectionTestResult> { ... }
  async push(records: unknown[], config: AdapterConfig): Promise<SyncResult> { ... }
  async pull(params: PullParams, config: AdapterConfig): Promise<PullResult> { ... }
  validate(record: unknown): ValidationResult { ... }
  mapToInternal(externalRecord: unknown, entityType: string): unknown { ... }
  mapToExternal(internalRecord: unknown, entityType: string): unknown { ... }
}
```

2. Register in `src/adapters/index.ts`:
```typescript
import { MySystemAdapter } from './mySystem.adapter.js';
adapterRegistry.set('MY_SYSTEM', new MySystemAdapter());
```

3. Add to `ExternalSystem` enum in `packages/db-schemas/prisma/interop-v2.prisma`

4. Add tests in `src/__tests__/adapters/mySystem.adapter.spec.ts`

## FHIR R4 Mapping Reference

| ARIS Entity | FHIR Resource | Key Fields |
|-------------|---------------|------------|
| Animal record | Patient | identifier, species (extension), active |
| Surveillance/lab result | Observation | code, subject, effectiveDateTime, valueQuantity |
| Lab report | DiagnosticReport | code, status, issued, conclusion |

## Development

```bash
pnpm dev          # Start with hot reload (tsx watch)
pnpm test         # Run tests
pnpm build        # TypeScript build
```
