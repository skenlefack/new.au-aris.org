# ADR-006: 4-Level Workflow Validation Engine

## Status

Accepted

## Date

2024-06-01

## Context

ARIS serves the African Union's institutional hierarchy spanning 55 Member States, 8 Regional Economic
Communities (RECs), and the continental AU-IBAR secretariat. Data submitted by national-level actors
(field agents, data stewards, CVOs) must undergo progressive validation before it can be published
on continental dashboards or exported to international reporting systems such as WAHIS and EMPRES.

AU-IBAR Annex B section B4.1 mandates a structured validation pipeline that reflects the political
and institutional reality of the African Union. National sovereignty over animal resource data must
be respected: no data may be published internationally without explicit national-level approval.
At the same time, regional and continental bodies require harmonized, quality-assured datasets for
cross-border analysis, early warning, and policy formulation.

A single-step approval workflow is insufficient because it conflates technical data quality checks
with official national endorsement. A two-level workflow (national + continental) would bypass the
RECs, which play a critical coordination role in cross-border disease surveillance and trade
harmonization. The workflow must also support two distinct publication tracks: the official track
(WAHIS/EMPRES reporting under national sovereignty) and the analytical track (continental dashboards
and policy briefs published by AU-IBAR with appropriate disclaimers).

## Decision

We adopt a 4-level validation engine implemented in the `workflow` service (port 3012). Each record
progresses through four sequential validation levels, with two parallel publication tracks branching
at specific points.

### Validation Levels

| Level | Name | Actors | Purpose |
|-------|------|--------|---------|
| L1 | NATIONAL_TECHNICAL | DATA_STEWARD, NATIONAL_ADMIN | Automated quality gate checks (8 mandatory gates per ADR-009). Auto-advances when all gates pass. Manual override with justification allowed. |
| L2 | NATIONAL_OFFICIAL | NATIONAL_ADMIN, WAHIS_FOCAL_POINT | Official national endorsement. The CVO or designated authority confirms the data is ready for international reporting. Triggers the Official Track. |
| L3 | REC_HARMONIZATION | REC_ADMIN, DATA_STEWARD (REC-level) | Regional consistency check. Ensures cross-border coherence (e.g., the same outbreak reported by two countries is linked). Validates regional aggregation. |
| L4 | CONTINENTAL_PUBLICATION | CONTINENTAL_ADMIN, SUPER_ADMIN | Final continental review. Data is cleared for AU-IBAR dashboards, policy briefs, and analytical products. Triggers the Analytical Track. |

### Publication Tracks

- **Official Track**: Activated after L2 approval. The WAHIS Focal Point can trigger WAHIS-ready
  export packages via the interop-hub service. This track operates under national sovereignty;
  AU-IBAR has no authority to modify or block these exports.
- **Analytical Track**: Activated after L4 approval. AU-IBAR publishes data on continental
  dashboards and analytical products. All analytical publications carry provenance metadata and
  disclaimers noting the data source and validation status.

### Auto-Advance at L1

When all 8 quality gates (completeness, temporal consistency, geographic consistency, codes and
vocabularies, units, deduplication, auditability, confidence score) return PASSED, L1 automatically
advances to L2 without manual intervention. If any gate returns FAILED, the record enters the
correction loop (48-hour SLA for correction, 7-day escalation).

### SLA Deadlines and Auto-Escalation

Each level has configurable SLA deadlines (default: L1 = 24h, L2 = 72h, L3 = 5 business days,
L4 = 5 business days). When a deadline expires without action, the system publishes an escalation
event to Kafka (`sys.workflow.escalation.triggered.v1`) and sends notifications via the message
service to the actor's supervisor and the next-level administrator.

### State Machine

Records follow a strict state machine: DRAFT -> L1_PENDING -> L1_PASSED -> L2_PENDING ->
L2_APPROVED -> L3_PENDING -> L3_HARMONIZED -> L4_PENDING -> PUBLISHED. Rejection at any level
returns the record to CORRECTION_REQUIRED with a mandatory reason field. Re-submission re-enters
the pipeline at L1.

### Kafka Events

Each state transition emits a Kafka event following the topic convention:
- `ms.workflow.record.submitted.v1` (DRAFT -> L1_PENDING)
- `ms.workflow.record.validated.v1` (L1 pass)
- `ms.workflow.record.approved.v1` (L2 approval)
- `rec.workflow.record.harmonized.v1` (L3 harmonization)
- `au.workflow.record.published.v1` (L4 publication)
- `ms.workflow.record.rejected.v1` (rejection at any level)

## Consequences

### Positive

- Respects AU institutional hierarchy and national data sovereignty.
- Separates technical validation (automated) from political endorsement (manual).
- Enables parallel official and analytical publication without blocking either track.
- Auto-advance at L1 reduces manual burden for high-quality submissions.
- SLA enforcement prevents data from stalling in the pipeline.
- Full audit trail of every state transition supports accountability.

### Negative

- Four levels introduce latency between data submission and continental publication.
- Requires training for actors at each level to understand their responsibilities.
- SLA configuration must be tuned per domain and country context to avoid false escalations.
- Re-submission after rejection restarts from L1, which may feel punitive for minor corrections.

### Neutral

- The workflow engine is domain-agnostic; domain-specific validation logic resides in the
  data-quality service and quality-rules package.
- The state machine is extensible: additional levels or branching can be added in future versions
  if the AU governance model evolves.

## Alternatives Considered

1. **2-Level Validation (National + Continental)**: Simpler but bypasses RECs entirely, which
   contradicts AU subsidiary principles and loses cross-border harmonization.
2. **Single Approval with Quality Gates Only**: Conflates technical checks with official
   endorsement. National CVOs would not have a formal sign-off step.
3. **Free-form Workflow (BPMN Engine)**: Maximum flexibility but excessive complexity for a
   well-defined institutional hierarchy. Risk of per-country workflow drift.
4. **5+ Levels (Adding Sub-national)**: Would add district/provincial validation. Deferred to
   Phase 2 as most countries lack digital infrastructure at sub-national level.
