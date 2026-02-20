# ADR-009: 8 Mandatory Data Quality Gates

## Status

Accepted

## Date

2024-06-01

## Context

ARIS consolidates animal resource data from 55 Member States, each with varying levels of digital
maturity, data collection infrastructure, and institutional capacity. Data arrives through multiple
channels: web forms, mobile offline sync, bulk CSV imports, and interoperability connectors. The
quality of incoming data varies enormously, from well-structured digitally-native submissions to
manually transcribed paper records with missing fields and inconsistent coding.

AU-IBAR Annex B section B4.2 mandates that all data must pass minimum quality standards before
publication on continental dashboards or export to international systems (WAHIS, EMPRES, FAOSTAT).
Publishing low-quality data undermines the credibility of ARIS and, by extension, AU-IBAR's
mandate. At the same time, quality enforcement must not become a bottleneck that discourages
Member States from submitting data at all.

The quality framework must be: (a) automated where possible to reduce manual burden, (b) transparent
so that submitters understand why data was rejected, (c) configurable per domain because different
data types have different quality requirements, and (d) auditable so that every quality decision
is traceable.

## Decision

We implement 8 mandatory quality gates in the `data-quality` service (port 3004) and the
`@aris/quality-rules` shared package. Every record must pass all 8 gates before advancing beyond
L1 (NATIONAL_TECHNICAL) in the validation workflow (see ADR-006).

### Gate Definitions

| # | Gate | Description | Severity |
|---|------|-------------|----------|
| 1 | **Completeness** | All required fields for the record type are populated. Required field sets are defined per domain (e.g., an outbreak report requires species, disease, location, date, and case count). | FAIL |
| 2 | **Temporal Consistency** | Date fields follow logical ordering. Confirmation date >= suspicion date. Closure date >= confirmation date. Report date <= current date. No future dates unless explicitly allowed (e.g., vaccination campaign planned dates). | FAIL |
| 3 | **Geographic Consistency** | Administrative codes (country, admin1, admin2, admin3) exist in the master-data referential. GPS coordinates fall within the declared administrative boundary (tolerance: 5km buffer for boundary edge cases). | FAIL |
| 4 | **Codes & Vocabularies** | All coded fields (species, disease, diagnostic method, vaccine type, trade commodity) match entries in the master-data service. Version of the referential used is recorded for reproducibility. | FAIL |
| 5 | **Units** | Numeric values use valid units from the master-data units referential. Unit conversions are consistent (e.g., tonnes vs. kilograms). Values fall within plausible ranges (configurable per field). | FAIL |
| 6 | **Deduplication** | Deterministic matching on composite keys (e.g., same outbreak at same location on same date for same species). Probabilistic matching using Jaccard similarity on text fields when deterministic match is ambiguous. Suspected duplicates are flagged for manual review rather than auto-rejected. | WARNING |
| 7 | **Auditability** | Source system identifier is present. Responsible organizational unit is specified. Validation status field exists and is valid. Data classification (PUBLIC/PARTNER/RESTRICTED/CONFIDENTIAL) is assigned. | FAIL |
| 8 | **Confidence Score** | For event-based data (outbreaks, disease reports): auto-calculated score based on source type (rumor=0.3, verified=0.6, confirmed=0.9), diagnostic evidence (clinical=0.5, lab-confirmed=0.9), and corroboration (single source=0.5, multiple sources=0.8). Score is informational at L1 but used for prioritization at L3/L4. | INFO |

### Severity Levels

- **FAIL**: Record cannot advance to L2. Enters the correction loop.
- **WARNING**: Record can advance but the issue is flagged for review. The DATA_STEWARD at L1 may
  choose to accept with justification or return for correction.
- **INFO**: Informational only. Recorded in the quality report but does not block progression.

### Quality Report

Each quality gate execution produces a `QualityReport` object:

```
QualityReport {
  recordId:    UUID
  tenantId:    UUID
  executedAt:  DateTime
  overallStatus: PASSED | FAILED | WARNING
  gates: [
    {
      gateId:    String (e.g., "COMPLETENESS")
      status:    PASSED | FAILED | WARNING | INFO
      details:   String (human-readable explanation)
      fields:    String[] (affected field names)
      metadata:  JSONB (gate-specific data, e.g., dedup candidate IDs)
    }
  ]
  executionTimeMs: Number
}
```

Quality reports are persisted and linked to the record's audit trail. They are visible to the
submitter, the DATA_STEWARD, and all higher-level validators.

### Correction Loop

When a record fails one or more gates:

1. The record enters `CORRECTION_REQUIRED` status with a detailed quality report.
2. A notification is sent to the submitter (via message service) with specific instructions.
3. The submitter has 48 hours (configurable) to correct and re-submit.
4. If not corrected within 48 hours, an escalation notification is sent to the NATIONAL_ADMIN.
5. If not corrected within 7 days, the record is archived as `ABANDONED` with full audit trail.
6. Re-submission triggers a complete re-evaluation of all 8 gates.

### Custom Rules per Domain

The `@aris/quality-rules` package defines the 8 mandatory gates. In addition, DATA_STEWARDs at
the national or REC level can define supplementary rules via the data-quality service API. Custom
rules are scoped to a tenant and domain, and they execute after the mandatory gates. Custom rules
can only add strictness (WARNING or FAIL); they cannot override a mandatory FAIL to PASSED.

### Kafka Integration

Quality gate execution is triggered by Kafka events:
- **Input**: `ms.collecte.record.submitted.v1` triggers quality evaluation.
- **Output**: `ms.quality.record.passed.v1` or `au.quality.record.rejected.v1` with the full
  quality report in the event payload.

## Consequences

### Positive

- Consistent, automated quality baseline across all 55 Member States regardless of local capacity.
- Transparent feedback loop helps submitters understand and correct issues, building data literacy.
- Quality reports provide an auditable record of every quality decision.
- Custom rules allow domains and tenants to add context-specific validations without modifying
  the core gate logic.
- Deduplication as WARNING (not FAIL) avoids blocking legitimate records while flagging suspects.

### Negative

- 8 gates add processing time to every submission. Mitigation: gates are executed in parallel where
  possible, and geographic consistency uses pre-computed boundary indexes.
- The 48h/7d correction SLA may be too aggressive for countries with limited digital capacity.
  Mitigation: SLA durations are configurable per tenant.
- Probabilistic deduplication may produce false positives, requiring manual review effort.
- Custom rules created by DATA_STEWARDs could inadvertently block valid submissions if poorly
  defined. Mitigation: custom rules require approval by NATIONAL_ADMIN before activation.

### Neutral

- Quality gate definitions are versioned. When a gate definition changes, previously evaluated
  records are not retroactively re-evaluated unless explicitly requested.
- The confidence score (Gate 8) is domain-specific and currently only applies to event-based data.
  Extension to other data types (census, trade) is planned for future phases.

## Alternatives Considered

1. **Simple Field-Level Validation Only**: Validate required fields and data types at the API
   level using class-validator DTOs. Rejected because it cannot enforce cross-field consistency,
   geographic validation, deduplication, or confidence scoring. Necessary but insufficient.
2. **Great Expectations (Python)**: Mature data quality framework with rich rule definitions.
   Rejected because it requires a Python runtime, which conflicts with the all-TypeScript backend
   strategy and would add operational complexity. The quality-rules package provides equivalent
   functionality in TypeScript.
3. **dbt Tests (SQL-based)**: Data quality checks executed as SQL assertions in the analytics
   pipeline. Rejected for real-time use because dbt operates on batch schedules, not on individual
   record submission. However, dbt-style checks may be added to the analytics service for
   retrospective quality monitoring.
4. **Manual Quality Review Only**: Rely entirely on DATA_STEWARDs to manually review every
   submission. Rejected because it does not scale to 55 countries submitting data concurrently
   and introduces subjective variability in quality standards.
