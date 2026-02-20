import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 5: UNITS
 * Validates that unit fields contain recognized unit codes from Master Data.
 */
export class UnitValidationGate implements QualityGateHandler {
  readonly gate = QualityGate.UNITS;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const unitFields = config.unitFields ?? [];

    if (unitFields.length === 0) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    const validUnits = config.validUnits;

    for (const field of unitFields) {
      const value = record[field];
      if (value == null) continue; // completeness gate handles missing

      const unitCode = String(value);

      if (!validUnits) {
        violations.push({
          gate: this.gate,
          field,
          message: `No valid unit set available. Cannot validate "${field}".`,
          severity: 'WARNING',
        });
        continue;
      }

      if (!validUnits.has(unitCode)) {
        violations.push({
          gate: this.gate,
          field,
          message: `"${field}" value "${unitCode}" is not a recognized unit code`,
          severity: 'FAIL',
        });
      }
    }

    const hasFails = violations.some((v) => v.severity === 'FAIL');
    const hasWarnings = violations.some((v) => v.severity === 'WARNING');

    return {
      gate: this.gate,
      result: hasFails
        ? QualityGateResult.FAIL
        : hasWarnings
          ? QualityGateResult.WARNING
          : QualityGateResult.PASS,
      violations,
      durationMs: Date.now() - start,
    };
  }
}
