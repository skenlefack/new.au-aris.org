import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 1: COMPLETENESS
 * Checks that all required fields are present and non-empty.
 */
export class CompletenessGate implements QualityGateHandler {
  readonly gate = QualityGate.COMPLETENESS;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const requiredFields = config.requiredFields ?? [];

    if (requiredFields.length === 0) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    for (const field of requiredFields) {
      const value = getNestedValue(record, field);
      if (value === undefined || value === null || value === '') {
        violations.push({
          gate: this.gate,
          field,
          message: `Required field "${field}" is missing or empty`,
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

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
