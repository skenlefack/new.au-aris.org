# API Routes Catalogue

> Complete HTTP endpoint reference for all 22 ARIS 3.0 microservices.
> All routes are versioned (`/api/v1/`) and return `{ data, meta?, errors? }`.

---

## Table of Contents

1. [Platform Services](#1-platform-services)
2. [Data Hub Services](#2-data-hub-services)
3. [Collecte & Workflow Services](#3-collecte--workflow-services)
4. [Domain Services](#4-domain-services)
5. [Data & Integration Services](#5-data--integration-services)
6. [Common Patterns](#6-common-patterns)

---

## 1. Platform Services

### Tenant Service (`:3001`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/tenants` | SUPER_ADMIN, CONTINENTAL_ADMIN | Create tenant |
| `GET` | `/api/v1/tenants` | Authenticated | List tenants (filtered by hierarchy) |
| `GET` | `/api/v1/tenants/:id` | Authenticated | Get tenant by ID |
| `PATCH` | `/api/v1/tenants/:id` | SUPER_ADMIN, CONTINENTAL_ADMIN | Update tenant |
| `GET` | `/api/v1/tenants/:id/children` | Authenticated | Get child tenants |

### Credential Service (`:3002`)

#### Authentication (`/api/v1/credential/auth`)

| Method | Route | Auth | Rate Limit | Description |
|--------|-------|------|------------|-------------|
| `POST` | `/api/v1/credential/auth/register` | SUPER_ADMIN, *_ADMIN | - | Register new user |
| `POST` | `/api/v1/credential/auth/login` | Public | 10/min | Login (returns JWT tokens) |
| `POST` | `/api/v1/credential/auth/refresh` | Public | 10/min | Refresh access token |
| `POST` | `/api/v1/credential/auth/logout` | Authenticated | - | Logout (invalidate token) |

#### Users (`/api/v1/credential/users`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/credential/users` | Authenticated + TenantGuard | List users (paginated) |
| `GET` | `/api/v1/credential/users/me` | Authenticated | Get current user profile |
| `PUT` | `/api/v1/credential/users/me/locale` | Authenticated | Update locale preference |
| `PATCH` | `/api/v1/credential/users/:id` | SUPER_ADMIN, *_ADMIN | Update user |

#### MFA (`/api/v1/auth/mfa`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/auth/mfa/setup` | Authenticated | Generate TOTP secret + QR code |
| `POST` | `/api/v1/auth/mfa/verify` | Authenticated | Verify TOTP code |
| `POST` | `/api/v1/auth/mfa/disable` | Authenticated | Disable MFA (requires TOTP code) |

#### i18n (`/api/v1/i18n`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/i18n/enums?locale=en` | Public | Get translated enum labels |
| `GET` | `/api/v1/i18n/locales` | Public | List supported locales (EN, FR, PT, AR) |

### Message Service (`:3006`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/messages` | Authenticated | List notifications |
| `GET` | `/api/v1/messages/unread-count` | Authenticated | Get unread notification count |
| `PATCH` | `/api/v1/messages/:id/read` | Authenticated | Mark notification as read |
| `POST` | `/api/v1/messages/send` | Admin roles | Send manual notification |
| `GET` | `/api/v1/messages/preferences` | Authenticated | Get notification preferences |
| `POST` | `/api/v1/messages/preferences` | Authenticated | Upsert notification preference |

### Drive Service (`:3007`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/drive/upload` | Authenticated | Upload file to MinIO |
| `POST` | `/api/v1/drive/presign` | Authenticated | Get presigned upload URL |
| `GET` | `/api/v1/drive/files` | Authenticated | List files |
| `GET` | `/api/v1/drive/files/:id` | Authenticated | Get file metadata |
| `GET` | `/api/v1/drive/files/:id/download` | Authenticated | Get presigned download URL |
| `DELETE` | `/api/v1/drive/files/:id` | Authenticated | Soft delete file |

### Realtime Service (`:3008`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/realtime/health` | Public | Health check |
| `GET` | `/api/v1/realtime/stats` | Authenticated | WebSocket connection stats |

> WebSocket endpoint: `ws://localhost:3008/socket.io` (Socket.IO protocol)

### Offline Sync Service (`:3040`)

#### Sessions (`/api/v1/offline/sessions`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/offline/sessions/init` | Authenticated | Initialize sync session for a device |
| `POST` | `/api/v1/offline/sessions/:sessionId/push` | Authenticated | Push deltas from device to server |
| `POST` | `/api/v1/offline/sessions/:sessionId/pull` | Authenticated | Pull deltas from server to device |
| `POST` | `/api/v1/offline/sessions/:sessionId/complete` | Authenticated | Complete sync session |
| `GET` | `/api/v1/offline/sessions/:sessionId` | Authenticated | Get session status |

#### Devices (`/api/v1/offline/devices`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/offline/devices/register` | Authenticated | Register or update a device |
| `GET` | `/api/v1/offline/devices/:deviceId` | Authenticated | Get device info |

#### Conflicts (`/api/v1/offline/conflicts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/offline/conflicts/:conflictId/resolve` | Admin + DATA_STEWARD | Resolve a sync conflict |
| `GET` | `/api/v1/offline/conflicts` | Admin + DATA_STEWARD | List pending conflicts |

> Sync flow: `init` → `push` → `pull` → `complete`. LWW auto-resolution for non-critical entities; manual resolution required for health events, outbreaks, SPS certificates.

### Support Service (`:3041`)

#### Tickets (`/api/v1/support/tickets`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/support/tickets` | Authenticated | Create support ticket (auto-ref SUP-YYYY-NNNNN) |
| `GET` | `/api/v1/support/tickets` | Authenticated | List tickets (paginated, filterable) |
| `GET` | `/api/v1/support/tickets/:id` | Authenticated | Get ticket with comments + SLA |
| `PATCH` | `/api/v1/support/tickets/:id` | Admin roles | Update ticket (status, assignee, priority) |
| `POST` | `/api/v1/support/tickets/:id/escalate` | Admin roles | Escalate to higher-level tenant |
| `POST` | `/api/v1/support/tickets/:id/comments` | Authenticated | Add comment to ticket |
| `GET` | `/api/v1/support/tickets/:id/comments` | Authenticated | List ticket comments |

#### SLA (`/api/v1/support/sla`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/support/sla/check` | SUPER_ADMIN, CONTINENTAL_ADMIN | Trigger SLA breach detection |
| `GET` | `/api/v1/support/sla/stats` | Admin roles | SLA compliance statistics |

> SLA deadlines auto-calculated from category × priority matrix. Kafka events: `ticket.created`, `ticket.assigned`, `ticket.escalated`, `sla.breached`.

---

## 2. Data Hub Services

### Master Data Service (`:3003`)

#### Geography (`/api/v1/master-data/geo`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/geo` | Admin roles | Create geo entity |
| `GET` | `/api/v1/master-data/geo` | Authenticated | List geo entities (paginated) |
| `GET` | `/api/v1/master-data/geo/:id` | Authenticated | Get geo entity |
| `GET` | `/api/v1/master-data/geo/code/:code` | Authenticated | Get geo entity by ISO code |
| `PATCH` | `/api/v1/master-data/geo/:id` | Admin roles | Update geo entity |
| `GET` | `/api/v1/master-data/geo/:id/children` | Authenticated | Get child entities (admin levels) |

#### Species (`/api/v1/master-data/species`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/species` | Admin roles | Create species |
| `GET` | `/api/v1/master-data/species` | Authenticated | List species |
| `GET` | `/api/v1/master-data/species/:id` | Authenticated | Get species |
| `PATCH` | `/api/v1/master-data/species/:id` | Admin roles | Update species |

#### Diseases (`/api/v1/master-data/diseases`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/diseases` | Admin roles | Create disease |
| `GET` | `/api/v1/master-data/diseases` | Authenticated | List diseases |
| `GET` | `/api/v1/master-data/diseases/:id` | Authenticated | Get disease |
| `PATCH` | `/api/v1/master-data/diseases/:id` | Admin roles | Update disease |

#### Units (`/api/v1/master-data/units`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/units` | Admin roles | Create unit |
| `GET` | `/api/v1/master-data/units` | Authenticated | List units |
| `GET` | `/api/v1/master-data/units/:id` | Authenticated | Get unit |
| `PATCH` | `/api/v1/master-data/units/:id` | Admin roles | Update unit |

#### Temporalities (`/api/v1/master-data/temporalities`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/temporalities` | Admin roles | Create temporality |
| `GET` | `/api/v1/master-data/temporalities` | Authenticated | List temporalities |
| `GET` | `/api/v1/master-data/temporalities/:id` | Authenticated | Get temporality |
| `PATCH` | `/api/v1/master-data/temporalities/:id` | Admin roles | Update temporality |

#### Identifiers (`/api/v1/master-data/identifiers`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/identifiers` | Admin roles | Create identifier |
| `GET` | `/api/v1/master-data/identifiers` | Authenticated | List identifiers |
| `GET` | `/api/v1/master-data/identifiers/:id` | Authenticated | Get identifier |
| `PATCH` | `/api/v1/master-data/identifiers/:id` | Admin roles | Update identifier |

#### Denominators (`/api/v1/master-data/denominators`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/denominators` | Admin roles | Create denominator |
| `GET` | `/api/v1/master-data/denominators` | Authenticated | List denominators |
| `GET` | `/api/v1/master-data/denominators/:id` | Authenticated | Get denominator |
| `PATCH` | `/api/v1/master-data/denominators/:id` | Admin roles | Update denominator |
| `POST` | `/api/v1/master-data/denominators/:id/validate` | DATA_STEWARD+ | Validate denominator |

#### Version & History

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/master-data/version` | Authenticated | Get dictionary version |
| `GET` | `/api/v1/master-data/:type/:id/history` | Authenticated | Get entity change history |
| `DELETE` | `/api/v1/master-data/:type/:id` | Admin roles | Soft delete entity |

#### Import / Export

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/master-data/import/csv` | Admin roles | Import data from CSV |
| `GET` | `/api/v1/master-data/export/csv` | Authenticated | Export data to CSV |
| `POST` | `/api/v1/master-data/import/faostat` | CONTINENTAL_ADMIN+ | Import FAOSTAT denominators |

### Data Quality Service (`:3004`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/data-quality/validate` | Authenticated | Validate a record (8 quality gates) |
| `GET` | `/api/v1/data-quality/reports` | Authenticated | List quality reports |
| `GET` | `/api/v1/data-quality/reports/:id` | Authenticated | Get quality report |
| `GET` | `/api/v1/data-quality/dashboard` | Authenticated | Quality dashboard KPIs |
| `POST` | `/api/v1/data-quality/rules` | Admin roles | Create quality rule |
| `GET` | `/api/v1/data-quality/rules` | Authenticated | List quality rules |
| `GET` | `/api/v1/data-quality/rules/:id` | Authenticated | Get quality rule |
| `PATCH` | `/api/v1/data-quality/rules/:id` | Admin roles | Update quality rule |
| `GET` | `/api/v1/data-quality/corrections` | Authenticated | List pending corrections |
| `GET` | `/api/v1/data-quality/corrections/:reportId` | Authenticated | Get correction by report |
| `PATCH` | `/api/v1/data-quality/corrections/:reportId/corrected` | DATA_STEWARD+ | Mark as corrected |
| `PATCH` | `/api/v1/data-quality/corrections/:reportId/assign` | Admin roles | Assign correction |

### Data Contract Service (`:3005`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/data-contracts` | Admin roles | Create data contract |
| `GET` | `/api/v1/data-contracts` | Authenticated | List data contracts |
| `GET` | `/api/v1/data-contracts/:id` | Authenticated | Get data contract |
| `PATCH` | `/api/v1/data-contracts/:id` | Admin roles | Update data contract |
| `GET` | `/api/v1/data-contracts/:id/compliance` | Authenticated | Get compliance metrics |

### Interop Hub Service (`:3032`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/interop/wahis/export` | WAHIS_FOCAL_POINT, Admin | Create WAHIS export package |
| `GET` | `/api/v1/interop/wahis/exports` | Authenticated | List WAHIS exports |
| `GET` | `/api/v1/interop/wahis/exports/:id` | Authenticated | Get WAHIS export |
| `POST` | `/api/v1/interop/empres/feed` | CONTINENTAL_ADMIN+ | Create EMPRES feed |
| `GET` | `/api/v1/interop/empres/feeds` | Authenticated | List EMPRES feeds |
| `POST` | `/api/v1/interop/faostat/sync` | CONTINENTAL_ADMIN+ | Trigger FAOSTAT sync |
| `GET` | `/api/v1/interop/faostat/syncs` | Authenticated | List FAOSTAT syncs |
| `GET` | `/api/v1/interop/connectors` | Authenticated | List available connectors |
| `GET` | `/api/v1/interop/health` | Public | Connector health status |

---

## 3. Collecte & Workflow Services

### Form Builder Service (`:3010`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/form-builder/templates` | Admin roles | Create form template |
| `GET` | `/api/v1/form-builder/templates` | Authenticated | List templates |
| `GET` | `/api/v1/form-builder/templates/:id` | Authenticated | Get template |
| `PATCH` | `/api/v1/form-builder/templates/:id` | Admin roles | Update template |
| `POST` | `/api/v1/form-builder/templates/:id/publish` | Admin roles | Publish template |
| `POST` | `/api/v1/form-builder/templates/:id/archive` | Admin roles | Archive template |
| `GET` | `/api/v1/form-builder/templates/:id/preview` | Authenticated | Preview template |

### Collecte Service (`:3011`)

#### Campaigns (`/api/v1/collecte/campaigns`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/collecte/campaigns` | Admin roles | Create campaign |
| `GET` | `/api/v1/collecte/campaigns` | Authenticated | List campaigns |
| `GET` | `/api/v1/collecte/campaigns/:id` | Authenticated | Get campaign with progress |
| `PATCH` | `/api/v1/collecte/campaigns/:id` | Admin roles | Update campaign |

#### Submissions (`/api/v1/collecte/submissions`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/collecte/submissions` | Authenticated | Submit form data |
| `GET` | `/api/v1/collecte/submissions` | Authenticated | List submissions |
| `GET` | `/api/v1/collecte/submissions/:id` | Authenticated | Get submission |

#### Sync (`/api/v1/collecte/sync`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/collecte/sync` | Authenticated | Delta sync (mobile offline) |

### Workflow Service (`:3012`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/workflow/instances` | Authenticated | Create workflow instance |
| `GET` | `/api/v1/workflow/instances` | Authenticated | List workflow instances |
| `GET` | `/api/v1/workflow/instances/:id` | Authenticated | Get workflow instance |
| `POST` | `/api/v1/workflow/instances/:id/approve` | Per-level roles | Approve (advance level) |
| `POST` | `/api/v1/workflow/instances/:id/reject` | Per-level roles | Reject (with reason) |
| `POST` | `/api/v1/workflow/instances/:id/return` | Per-level roles | Return for correction |
| `GET` | `/api/v1/workflow/dashboard` | Authenticated | Workflow dashboard KPIs |

---

## 4. Domain Services

### Animal Health Service (`:3020`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/animal-health/events` | DATA_STEWARD+ | Create health event |
| `GET` | `/api/v1/animal-health/events` | Authenticated | List health events |
| `GET` | `/api/v1/animal-health/events/:id` | Authenticated | Get health event |
| `PATCH` | `/api/v1/animal-health/events/:id` | DATA_STEWARD+ | Update health event |
| `POST` | `/api/v1/animal-health/events/:id/confirm` | NATIONAL_ADMIN+ | Confirm event |
| `POST` | `/api/v1/animal-health/lab-results` | DATA_STEWARD+ | Create lab result |
| `GET` | `/api/v1/animal-health/lab-results` | Authenticated | List lab results |
| `GET` | `/api/v1/animal-health/lab-results/:id` | Authenticated | Get lab result |
| `POST` | `/api/v1/animal-health/surveillance` | DATA_STEWARD+ | Create surveillance record |
| `GET` | `/api/v1/animal-health/surveillance` | Authenticated | List surveillance records |
| `POST` | `/api/v1/animal-health/vaccinations` | DATA_STEWARD+ | Create vaccination |
| `GET` | `/api/v1/animal-health/vaccinations` | Authenticated | List vaccinations |
| `GET` | `/api/v1/animal-health/vaccinations/:id/coverage` | Authenticated | Get vaccination coverage |
| `POST` | `/api/v1/animal-health/capacities` | DATA_STEWARD+ | Create capacity record |
| `GET` | `/api/v1/animal-health/capacities` | Authenticated | List capacity records |

### Livestock Production Service (`:3021`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/livestock/census` | DATA_STEWARD+ | Create census record |
| `GET` | `/api/v1/livestock/census` | Authenticated | List census records |
| `GET` | `/api/v1/livestock/census/:id` | Authenticated | Get census record |
| `PATCH` | `/api/v1/livestock/census/:id` | DATA_STEWARD+ | Update census |
| `POST` | `/api/v1/livestock/production` | DATA_STEWARD+ | Create production record |
| `GET` | `/api/v1/livestock/production` | Authenticated | List production records |
| `GET` | `/api/v1/livestock/production/:id` | Authenticated | Get production record |
| `PATCH` | `/api/v1/livestock/production/:id` | DATA_STEWARD+ | Update production |
| `POST` | `/api/v1/livestock/slaughter` | DATA_STEWARD+ | Create slaughter record |
| `GET` | `/api/v1/livestock/slaughter` | Authenticated | List slaughter records |
| `GET` | `/api/v1/livestock/slaughter/:id` | Authenticated | Get slaughter record |
| `PATCH` | `/api/v1/livestock/slaughter/:id` | DATA_STEWARD+ | Update slaughter |
| `POST` | `/api/v1/livestock/transhumance` | DATA_STEWARD+ | Create transhumance corridor |
| `GET` | `/api/v1/livestock/transhumance` | Authenticated | List corridors |
| `GET` | `/api/v1/livestock/transhumance/:id` | Authenticated | Get corridor |
| `PATCH` | `/api/v1/livestock/transhumance/:id` | DATA_STEWARD+ | Update corridor |

### Fisheries Service (`:3022`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/fisheries/captures` | DATA_STEWARD+ | Create capture record |
| `GET` | `/api/v1/fisheries/captures` | Authenticated | List captures |
| `GET` | `/api/v1/fisheries/captures/:id` | Authenticated | Get capture |
| `PATCH` | `/api/v1/fisheries/captures/:id` | DATA_STEWARD+ | Update capture |
| `POST` | `/api/v1/fisheries/vessels` | DATA_STEWARD+ | Register vessel |
| `GET` | `/api/v1/fisheries/vessels` | Authenticated | List vessels |
| `GET` | `/api/v1/fisheries/vessels/:id` | Authenticated | Get vessel |
| `PATCH` | `/api/v1/fisheries/vessels/:id` | DATA_STEWARD+ | Update vessel |
| `POST` | `/api/v1/fisheries/aquaculture/farms` | DATA_STEWARD+ | Create aquaculture farm |
| `GET` | `/api/v1/fisheries/aquaculture/farms` | Authenticated | List farms |
| `GET` | `/api/v1/fisheries/aquaculture/farms/:id` | Authenticated | Get farm |
| `PATCH` | `/api/v1/fisheries/aquaculture/farms/:id` | DATA_STEWARD+ | Update farm |
| `POST` | `/api/v1/fisheries/aquaculture/production` | DATA_STEWARD+ | Create aquaculture production |
| `GET` | `/api/v1/fisheries/aquaculture/production` | Authenticated | List production |
| `GET` | `/api/v1/fisheries/aquaculture/production/:id` | Authenticated | Get production |
| `PATCH` | `/api/v1/fisheries/aquaculture/production/:id` | DATA_STEWARD+ | Update production |

### Wildlife Service (`:3023`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/wildlife/inventories` | DATA_STEWARD+ | Create wildlife inventory |
| `GET` | `/api/v1/wildlife/inventories` | Authenticated | List inventories |
| `GET` | `/api/v1/wildlife/inventories/:id` | Authenticated | Get inventory |
| `PATCH` | `/api/v1/wildlife/inventories/:id` | DATA_STEWARD+ | Update inventory |
| `POST` | `/api/v1/wildlife/protected-areas` | Admin roles | Create protected area |
| `GET` | `/api/v1/wildlife/protected-areas` | Authenticated | List protected areas |
| `GET` | `/api/v1/wildlife/protected-areas/:id` | Authenticated | Get protected area |
| `PATCH` | `/api/v1/wildlife/protected-areas/:id` | Admin roles | Update protected area |
| `POST` | `/api/v1/wildlife/cites-permits` | DATA_STEWARD+ | Create CITES permit |
| `GET` | `/api/v1/wildlife/cites-permits` | Authenticated | List CITES permits |
| `GET` | `/api/v1/wildlife/cites-permits/:id` | Authenticated | Get CITES permit |
| `PATCH` | `/api/v1/wildlife/cites-permits/:id` | DATA_STEWARD+ | Update CITES permit |
| `POST` | `/api/v1/wildlife/crimes` | DATA_STEWARD+ | Report wildlife crime |
| `GET` | `/api/v1/wildlife/crimes` | Authenticated | List crime records |
| `GET` | `/api/v1/wildlife/crimes/:id` | Authenticated | Get crime record |
| `PATCH` | `/api/v1/wildlife/crimes/:id` | DATA_STEWARD+ | Update crime record |

### Apiculture Service (`:3024`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/apiculture/apiaries` | DATA_STEWARD+ | Create apiary |
| `GET` | `/api/v1/apiculture/apiaries` | Authenticated | List apiaries |
| `GET` | `/api/v1/apiculture/apiaries/:id` | Authenticated | Get apiary |
| `PATCH` | `/api/v1/apiculture/apiaries/:id` | DATA_STEWARD+ | Update apiary |
| `POST` | `/api/v1/apiculture/production` | DATA_STEWARD+ | Create honey production |
| `GET` | `/api/v1/apiculture/production` | Authenticated | List production records |
| `GET` | `/api/v1/apiculture/production/:id` | Authenticated | Get production |
| `PATCH` | `/api/v1/apiculture/production/:id` | DATA_STEWARD+ | Update production |
| `POST` | `/api/v1/apiculture/health` | DATA_STEWARD+ | Create colony health record |
| `GET` | `/api/v1/apiculture/health` | Authenticated | List colony health records |
| `GET` | `/api/v1/apiculture/health/:id` | Authenticated | Get colony health |
| `PATCH` | `/api/v1/apiculture/health/:id` | DATA_STEWARD+ | Update colony health |
| `POST` | `/api/v1/apiculture/training` | Admin roles | Create training record |
| `GET` | `/api/v1/apiculture/training` | Authenticated | List training records |
| `GET` | `/api/v1/apiculture/training/:id` | Authenticated | Get training |
| `PATCH` | `/api/v1/apiculture/training/:id` | Admin roles | Update training |

### Trade & SPS Service (`:3025`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/trade/flows` | DATA_STEWARD+ | Create trade flow |
| `GET` | `/api/v1/trade/flows` | Authenticated | List trade flows |
| `GET` | `/api/v1/trade/flows/:id` | Authenticated | Get trade flow |
| `PATCH` | `/api/v1/trade/flows/:id` | DATA_STEWARD+ | Update trade flow |
| `POST` | `/api/v1/trade/sps-certificates` | DATA_STEWARD+ | Create SPS certificate |
| `GET` | `/api/v1/trade/sps-certificates` | Authenticated | List SPS certificates |
| `GET` | `/api/v1/trade/sps-certificates/:id` | Authenticated | Get SPS certificate |
| `PATCH` | `/api/v1/trade/sps-certificates/:id` | DATA_STEWARD+ | Update SPS certificate |
| `POST` | `/api/v1/trade/sps-certificates/:id/issue` | NATIONAL_ADMIN+ | Issue SPS certificate |
| `POST` | `/api/v1/trade/market-prices` | DATA_STEWARD+ | Create market price |
| `GET` | `/api/v1/trade/market-prices` | Authenticated | List market prices |
| `GET` | `/api/v1/trade/market-prices/:id` | Authenticated | Get market price |
| `PATCH` | `/api/v1/trade/market-prices/:id` | DATA_STEWARD+ | Update market price |

### Governance Service (`:3026`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/governance/legal-frameworks` | Admin roles | Create legal framework |
| `GET` | `/api/v1/governance/legal-frameworks` | Authenticated | List legal frameworks |
| `GET` | `/api/v1/governance/legal-frameworks/:id` | Authenticated | Get legal framework |
| `PATCH` | `/api/v1/governance/legal-frameworks/:id` | Admin roles | Update legal framework |
| `POST` | `/api/v1/governance/legal-frameworks/:id/adopt` | NATIONAL_ADMIN+ | Adopt legal framework |
| `POST` | `/api/v1/governance/capacities` | Admin roles | Create institutional capacity |
| `GET` | `/api/v1/governance/capacities` | Authenticated | List capacities |
| `GET` | `/api/v1/governance/capacities/:id` | Authenticated | Get capacity |
| `PATCH` | `/api/v1/governance/capacities/:id` | Admin roles | Update capacity |
| `POST` | `/api/v1/governance/pvs-evaluations` | Admin roles | Create PVS evaluation |
| `GET` | `/api/v1/governance/pvs-evaluations` | Authenticated | List PVS evaluations |
| `GET` | `/api/v1/governance/pvs-evaluations/:id` | Authenticated | Get PVS evaluation |
| `PATCH` | `/api/v1/governance/pvs-evaluations/:id` | Admin roles | Update PVS evaluation |
| `POST` | `/api/v1/governance/stakeholders` | Admin roles | Create stakeholder |
| `GET` | `/api/v1/governance/stakeholders` | Authenticated | List stakeholders |
| `GET` | `/api/v1/governance/stakeholders/:id` | Authenticated | Get stakeholder |
| `PATCH` | `/api/v1/governance/stakeholders/:id` | Admin roles | Update stakeholder |

### Climate & Environment Service (`:3027`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/climate/water-stress` | DATA_STEWARD+ | Create water stress index |
| `GET` | `/api/v1/climate/water-stress` | Authenticated | List water stress records |
| `GET` | `/api/v1/climate/water-stress/:id` | Authenticated | Get water stress record |
| `PATCH` | `/api/v1/climate/water-stress/:id` | DATA_STEWARD+ | Update water stress |
| `POST` | `/api/v1/climate/rangelands` | DATA_STEWARD+ | Create rangeland condition |
| `GET` | `/api/v1/climate/rangelands` | Authenticated | List rangeland records |
| `GET` | `/api/v1/climate/rangelands/:id` | Authenticated | Get rangeland record |
| `PATCH` | `/api/v1/climate/rangelands/:id` | DATA_STEWARD+ | Update rangeland |
| `POST` | `/api/v1/climate/hotspots` | DATA_STEWARD+ | Create vulnerability hotspot |
| `GET` | `/api/v1/climate/hotspots` | Authenticated | List hotspots |
| `GET` | `/api/v1/climate/hotspots/:id` | Authenticated | Get hotspot |
| `PATCH` | `/api/v1/climate/hotspots/:id` | DATA_STEWARD+ | Update hotspot |
| `POST` | `/api/v1/climate/climate-data` | DATA_STEWARD+ | Create climate data point |
| `GET` | `/api/v1/climate/climate-data` | Authenticated | List climate data |
| `GET` | `/api/v1/climate/climate-data/:id` | Authenticated | Get climate data point |
| `PATCH` | `/api/v1/climate/climate-data/:id` | DATA_STEWARD+ | Update climate data |

---

## 5. Data & Integration Services

### Analytics Service (`:3030`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/health` | Public | Service health check |
| `GET` | `/analytics/health/kpis` | Authenticated | Animal health KPIs |
| `GET` | `/analytics/health/trends` | Authenticated | Health trends over time |
| `GET` | `/analytics/quality/dashboard` | Authenticated | Data quality dashboard |
| `GET` | `/analytics/workflow/timeliness` | Authenticated | Workflow timeliness metrics |
| `GET` | `/analytics/denominators` | Authenticated | Population denominators |
| `GET` | `/analytics/export/csv` | Authenticated | Export analytics as CSV |
| `GET` | `/analytics/cross-domain/correlations` | Authenticated | Cross-domain correlations |
| `GET` | `/analytics/cross-domain/risk-score` | Authenticated | Composite risk score |
| `GET` | `/analytics/livestock/population` | Authenticated | Livestock population stats |
| `GET` | `/analytics/fisheries/catches` | Authenticated | Fisheries catch data |
| `GET` | `/analytics/trade/balance` | Authenticated | Trade balance analytics |
| `GET` | `/analytics/wildlife/crime-trends` | Authenticated | Wildlife crime trends |
| `GET` | `/analytics/climate/alerts` | Authenticated | Climate alerts |
| `GET` | `/analytics/governance/pvs-scores` | Authenticated | PVS scores by country |

### Geo Services (`:3031`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/geo/layers` | Authenticated | List available map layers |
| `GET` | `/api/v1/geo/query/within` | Authenticated | Query features within geometry |
| `GET` | `/api/v1/geo/query/nearest` | Authenticated | Query nearest features |
| `GET` | `/api/v1/geo/query/contains` | Authenticated | Query features containing point |
| `GET` | `/api/v1/geo/risk-map` | Authenticated | Get risk map data |
| `GET` | `/api/v1/geo/admin-boundaries/:code` | Authenticated | Get admin boundary by code |

### Analytics Worker Service (`:3043`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/analytics-worker/metrics` | Authenticated | Query aggregate metrics (paginated) |
| `GET` | `/api/v1/analytics-worker/metrics/:domain` | Authenticated | Get domain-specific metrics |
| `GET` | `/api/v1/analytics-worker/dashboard` | Authenticated | Dashboard with domain breakdown |
| `POST` | `/api/v1/analytics-worker/aggregate` | Admin roles | Trigger aggregation for domains |
| `GET` | `/api/v1/analytics-worker/workers` | SUPER_ADMIN, CONTINENTAL_ADMIN | Kafka consumer worker states |

> Consumes 5 Kafka consumer groups: health events, collecte submissions, data quality, livestock census, trade flows.
> Tumbling windows: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY.
> Hierarchical aggregation: country → REC → continental.
> Redis cache (2min TTL) for CQRS reads by analytics service (port 3030).

### Knowledge Hub Service (`:3033`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/knowledge/publications` | Admin roles | Create publication |
| `GET` | `/api/v1/knowledge/publications` | Authenticated | List publications |
| `GET` | `/api/v1/knowledge/publications/:id` | Authenticated | Get publication |
| `PATCH` | `/api/v1/knowledge/publications/:id` | Admin roles | Update publication |
| `GET` | `/api/v1/knowledge/publications/:id/download` | Authenticated | Download publication file |
| `POST` | `/api/v1/knowledge/elearning` | Admin roles | Create e-learning module |
| `GET` | `/api/v1/knowledge/elearning` | Authenticated | List e-learning modules |
| `GET` | `/api/v1/knowledge/elearning/my-courses` | Authenticated | Get enrolled courses |
| `GET` | `/api/v1/knowledge/elearning/:id` | Authenticated | Get e-learning module |
| `PATCH` | `/api/v1/knowledge/elearning/:id` | Admin roles | Update e-learning module |
| `GET` | `/api/v1/knowledge/elearning/:id/enroll` | Authenticated | Enroll in course |
| `PATCH` | `/api/v1/knowledge/elearning/:id/progress` | Authenticated | Update learning progress |
| `POST` | `/api/v1/knowledge/faq` | Admin roles | Create FAQ |
| `GET` | `/api/v1/knowledge/faq` | Authenticated | List FAQs |
| `GET` | `/api/v1/knowledge/faq/:id` | Authenticated | Get FAQ |
| `PATCH` | `/api/v1/knowledge/faq/:id` | Admin roles | Update FAQ |

---

## 6. Common Patterns

### Pagination

All list endpoints support pagination via query parameters:

```
GET /api/v1/{service}/{entity}?page=1&limit=20&sort=createdAt&order=desc
```

Response format:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Filtering

Domain-specific filters via query parameters:

```
GET /api/v1/animal-health/events?status=confirmed&country=KE&diseaseId=uuid
GET /api/v1/livestock/census?year=2025&speciesId=uuid
GET /api/v1/trade/flows?origin=KE&destination=ET&year=2025
```

### Error Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "tenantId", "message": "Required" }
  ]
}
```

### Authentication Header

All authenticated endpoints require:

```
Authorization: Bearer <access_token>
```

### Traefik Gateway

All services are accessible through the Traefik API gateway on port `4000`:

```
http://localhost:4000/api/v1/credential/auth/login
http://localhost:4000/api/v1/master-data/species
http://localhost:4000/api/v1/animal-health/events
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total microservices | 24 |
| Total controllers | 69 |
| Total HTTP endpoints | 315+ |
| API version | v1 |
| Authentication | JWT RS256 (Bearer token) |
| Standard CRUD pattern | POST, GET, GET/:id, PATCH/:id |
