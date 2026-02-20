import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 7: AUDITABILITY
 * Verifies that the record carries mandatory audit metadata:
 * source system, responsible unit, validation status.
 * Configurable via config.auditFields (defaults to common fields).
 */
const DEFAULT_AUDIT_FIELDS = [
  'sourceSystem',
  'responsibleUnit',
  'validationStatus',
];

export class AuditabilityGate implements QualityGateHandler {
  readonly gate = QualityGate.AUDITABILITY;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const auditFields = config.auditFields ?? DEFAULT_AUDIT_FIELDS;

    for (const field of auditFields) {
      const value = record[field];
      if (value === undefined || value === null || value === '') {
        violations.push({
          gate: this.gate,
          field,
          message: `Audit field "${field}" is missing or empty`,
          severity: 'FAIL',
        });
      }
    }

    return {
      gate: this.gate,
      result: violations.length > 0 ? QualityGateResult.FAIL : QualityGateResult.PASS,
      violations,
      durationMs: Date.now() - start,
    };
  }
}
