import type { QualityGate, QualityGateResult } from '@aris/shared-types';

/**
 * A single violation detected by a quality gate.
 */
export interface QualityViolation {
  /** Which gate produced this violation */
  gate: QualityGate;
  /** Which field(s) are affected */
  field: string;
  /** Human-readable violation message */
  message: string;
  /** Severity: FAIL = blocking, WARNING = advisory */
  severity: 'FAIL' | 'WARNING';
}

/**
 * Result of a single quality gate execution.
 */
export interface GateResult {
  gate: QualityGate;
  result: QualityGateResult;
  violations: QualityViolation[];
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Complete quality report for a record after all gates run.
 */
export interface QualityReport {
  /** UUID of the record being checked */
  recordId: string;
  /** Entity type (e.g. 'Outbreak', 'VaccinationCampaign') */
  entityType: string;
  /** Overall result: PASS only if ALL mandatory gates pass */
  overallResult: QualityGateResult;
  /** Results per gate */
  gates: GateResult[];
  /** All violations (convenience: flattened from all gates) */
  violations: QualityViolation[];
  /** Total execution time in ms */
  totalDurationMs: number;
  /** ISO timestamp when check ran */
  checkedAt: string;
}

/**
 * Domain-specific quality gate configuration.
 * Each domain can specify required fields, valid codes, etc.
 */
export interface QualityGateConfig {
  /** Required fields for COMPLETENESS gate */
  requiredFields?: string[];
  /** Date field pairs for TEMPORAL_CONSISTENCY gate: [earlier, later] */
  temporalPairs?: [string, string][];
  /** Fields that must contain valid geo codes */
  geoFields?: string[];
  /** Coordinate fields: [latField, lngField] */
  coordinateFields?: [string, string];
  /** Coordinate bounding box: [minLat, maxLat, minLng, maxLng] */
  coordinateBounds?: [number, number, number, number];
  /** Fields that must reference Master Data codes (field → referential type) */
  codeFields?: Record<string, string>;
  /** Valid code sets per referential type (injected at runtime) */
  validCodes?: Record<string, Set<string>>;
  /** Fields that must use valid units */
  unitFields?: string[];
  /** Valid unit codes (injected at runtime) */
  validUnits?: Set<string>;
  /** Fields used for deterministic dedup matching */
  dedupFields?: string[];
  /** Existing records for dedup comparison (injected at runtime) */
  existingRecords?: Record<string, unknown>[];
  /** Fuzzy match threshold (0-1, default 0.8) */
  fuzzyThreshold?: number;
  /** Auditability: required meta-fields */
  auditFields?: string[];
  /** Confidence level field name */
  confidenceLevelField?: string;
  /** Confidence evidence fields */
  confidenceEvidenceFields?: string[];
}

/**
 * Interface for a single quality gate implementation.
 */
export interface QualityGateHandler {
  readonly gate: QualityGate;
  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult;
}
