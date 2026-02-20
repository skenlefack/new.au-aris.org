// Interfaces
export type {
  QualityReport,
  QualityViolation,
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
} from './interfaces/quality-report.interface';

// Gate implementations
export { CompletenessGate } from './gates/completeness.gate';
export { TemporalConsistencyGate } from './gates/temporal-consistency.gate';
export { GeographicConsistencyGate } from './gates/geographic-consistency.gate';
export { CodeValidationGate } from './gates/code-validation.gate';
export { UnitValidationGate } from './gates/unit-validation.gate';
export { DeduplicationGate } from './gates/deduplication.gate';
export { AuditabilityGate } from './gates/auditability.gate';
export { ConfidenceScoreGate } from './gates/confidence-score.gate';

// Engine
export { QualityEngine } from './engine/quality-engine';
