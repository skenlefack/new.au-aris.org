import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 2: TEMPORAL_CONSISTENCY
 * Ensures date ordering: confirmation >= suspicion, closure after confirmation, etc.
 * Config provides pairs of [earlierField, laterField].
 */
export class TemporalConsistencyGate implements QualityGateHandler {
  readonly gate = QualityGate.TEMPORAL_CONSISTENCY;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const pairs = config.temporalPairs ?? [];

    if (pairs.length === 0) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    for (const [earlierField, laterField] of pairs) {
      const earlierVal = record[earlierField];
      const laterVal = record[laterField];

      // Both must be present to compare
      if (earlierVal == null || laterVal == null) continue;

      const earlierDate = toDate(earlierVal);
      const laterDate = toDate(laterVal);

      if (earlierDate === null) {
        violations.push({
          gate: this.gate,
          field: earlierField,
          message: `"${earlierField}" is not a valid date`,
          severity: 'FAIL',
        });
        continue;
      }

      if (laterDate === null) {
        violations.push({
          gate: this.gate,
          field: laterField,
          message: `"${laterField}" is not a valid date`,
          severity: 'FAIL',
        });
        continue;
      }

      if (laterDate.getTime() < earlierDate.getTime()) {
        violations.push({
          gate: this.gate,
          field: laterField,
          message: `"${laterField}" (${laterDate.toISOString()}) must not be before "${earlierField}" (${earlierDate.toISOString()})`,
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

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
