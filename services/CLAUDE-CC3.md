# CLAUDE.md — CC-3 Collecte & Workflow

## Your Scope
- `services/form-builder/` (port 3010) — No-Code form builder
- `services/collecte/` (port 3011) — Campaign orchestration, submissions, offline sync
- `services/workflow/` (port 3012) — 4-level validation engine

## Service: form-builder (port 3010)

### Form Template System
Templates use JSON Schema with ARIS extensions for domain-specific components.
Templates support **inheritance**: AU-IBAR defines base templates → RECs can extend → MS can customize.

```typescript
interface FormTemplate {
  id: string;
  tenantId: string;
  name: string;
  domain: string;             // health, livestock, fisheries, etc.
  version: number;
  parentTemplateId?: string;  // Inheritance chain
  schema: JsonSchema;         // JSON Schema with UI hints
  uiSchema: object;           // Layout, widgets, conditional logic
  dataContractId?: string;    // Linked data contract for validation
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdBy: string;
  publishedAt?: Date;
}
```

Domain-specific components (beyond standard text/number/date):
- `geo-picker` — Map-based location selection + GPS auto-fill
- `species-selector` — Searchable from Master Data species referential
- `disease-selector` — Searchable from Master Data diseases referential
- `admin-cascader` — Country → Admin1 → Admin2 → Admin3 cascade
- `photo-capture` — Camera with GPS EXIF + compression
- `signature-pad` — Digital signature for validation
- `lab-result-panel` — Test type + result + quality indicators

### Endpoints
- `POST /form-builder/templates` — Create template
- `GET /form-builder/templates` — List templates (filter by domain, status, tenant)
- `GET /form-builder/templates/:id` — Get template with resolved inheritance
- `PATCH /form-builder/templates/:id` — Update (creates new version)
- `POST /form-builder/templates/:id/publish` — Publish template
- `GET /form-builder/templates/:id/preview` — Preview rendered form

### Kafka Topics
- `ms.formbuilder.template.created.v1`
- `ms.formbuilder.template.published.v1`

## Service: collecte (port 3011)

### Campaign System
```typescript
interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  templateId: string;           // Linked form template
  startDate: Date;
  endDate: Date;
  targetZones: string[];        // Admin level IDs from Master Data
  assignedAgents: string[];     // User IDs (FIELD_AGENT role)
  targetSubmissions?: number;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

interface Submission {
  id: string;
  tenantId: string;
  campaignId: string;
  templateId: string;
  data: JsonValue;             // Form data (validated against JSON Schema)
  submittedBy: string;         // User ID
  submittedAt: Date;
  deviceId?: string;
  gpsLocation?: { lat: number; lng: number; accuracy: number };
  offlineCreatedAt?: Date;     // When created offline (before sync)
  syncedAt?: Date;
  qualityReportId?: string;    // Link to data-quality report
  workflowInstanceId?: string; // Link to workflow validation
  status: 'DRAFT' | 'SUBMITTED' | 'VALIDATING' | 'VALIDATED' | 'REJECTED';
  dataClassification: DataClassification;
}
```

### Offline Sync (critical for Africa — Annex A slide 17)
Mobile app stores submissions locally (IndexedDB/Room). When connectivity returns:
1. Client sends delta: `POST /collecte/sync` with `{ submissions[], lastSyncAt }`
2. Server processes each submission, runs quality gates via data-quality service
3. Server responds with `{ accepted[], rejected[], conflicts[] }`
4. Conflicts resolved by **last-write-wins** or manual merge (configurable in data contract)

### Endpoints
- `POST /collecte/campaigns` — Create campaign
- `GET /collecte/campaigns` — List campaigns (filter by domain, status)
- `GET /collecte/campaigns/:id` — Campaign details with progress stats
- `POST /collecte/submissions` — Submit form data
- `POST /collecte/sync` — Offline delta sync endpoint
- `GET /collecte/submissions` — List submissions (filter by campaign, status, agent)
- `GET /collecte/submissions/:id` — Submission details with quality report

### Kafka Topics
- `ms.collecte.campaign.created.v1`
- `ms.collecte.form.submitted.v1`
- `ms.collecte.form.synced.v1`

## Service: workflow (port 3012)

### 4-Level Validation Engine (Annex B §B4.1)
```typescript
interface WorkflowInstance {
  id: string;
  tenantId: string;
  entityType: string;       // 'submission', 'outbreak', 'vaccination', etc.
  entityId: string;
  domain: string;
  currentLevel: WorkflowLevel;
  status: WorkflowStatus;
  transitions: WorkflowTransition[];
  qualityReportId?: string;
  createdAt: Date;
  updatedAt: Date;
}

enum WorkflowLevel {
  TECHNICAL_VALIDATION = 1,   // National Data Steward
  OFFICIAL_APPROVAL = 2,      // Data Owner / CVO
  REGIONAL_HARMONIZATION = 3, // REC Data Steward
  CONTINENTAL_ANALYTICS = 4   // AU-IBAR
}

enum WorkflowStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',     // Returned for correction
  ESCALATED = 'ESCALATED'    // SLA breached
}

interface WorkflowTransition {
  id: string;
  fromLevel: WorkflowLevel;
  toLevel: WorkflowLevel;
  action: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE';
  actor: { userId: string; role: UserRole };
  comment?: string;
  timestamp: Date;
}
```

### Auto-escalation Rules
- If no action within SLA → auto-notify next level
- Configurable per data contract
- Escalation chain: Steward → CVO → REC → AU-IBAR

### Two Publication Tracks
After Level 2 (Official Approval):
- Entity marked `wahisReady: true`
- WAHIS Focal Point can trigger export via interop-hub
- This is the **official track** — respects national sovereignty

After Level 4 (Continental Analytics):
- Entity marked `analyticsReady: true`
- Published to dashboards with provenance metadata
- This is the **analytical track** — includes disclaimers

### Endpoints
- `GET /workflow/instances` — List workflow instances (filter by level, status, domain)
- `GET /workflow/instances/:id` — Instance details with transitions
- `POST /workflow/instances/:id/approve` — Approve at current level
- `POST /workflow/instances/:id/reject` — Reject with reason
- `POST /workflow/instances/:id/return` — Return for correction
- `GET /workflow/dashboard` — Pending actions per level, SLA compliance

### Kafka Topics
- `au.workflow.validation.submitted.v1`
- `au.workflow.validation.approved.v1`
- `au.workflow.validation.rejected.v1`
- `au.workflow.validation.escalated.v1`
- `au.workflow.wahis.ready.v1` (triggers interop-hub)
- `au.workflow.analytics.ready.v1` (triggers dashboards)

## Dependencies
- `@aris/shared-types`, `@aris/kafka-client`, `@aris/auth-middleware`
- `ajv` (JSON Schema validation for form submissions)
- `cron` (for campaign scheduling and SLA monitoring)
