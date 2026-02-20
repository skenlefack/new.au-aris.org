import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 4: CODES_VOCABULARIES
 * Validates that species, disease, zone codes etc. exist in Master Data referentials.
 * Config maps field names to referential types (e.g. { speciesCode: 'species', diseaseCode: 'disease' }).
 * Valid code sets are injected at runtime via config.validCodes.
 */
export class CodeValidationGate implements QualityGateHandler {
  readonly gate = QualityGate.CODES_VOCABULARIES;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const codeFields = config.codeFields ?? {};
    const fieldEntries = Object.entries(codeFields);

    if (fieldEntries.length === 0) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    const validCodes = config.validCodes ?? {};

    for (const [field, referentialType] of fieldEntries) {
      const value = record[field];
      if (value == null) continue; // completeness gate handles missing

      const codeStr = String(value);
      const codeSet = validCodes[referentialType];

      if (!codeSet) {
        violations.push({
          gate: this.gate,
          field,
          message: `No valid code set available for referential "${referentialType}". Cannot validate "${field}".`,
          severity: 'WARNING',
        });
        continue;
      }

      if (!codeSet.has(codeStr)) {
        violations.push({
          gate: this.gate,
          field,
          message: `"${field}" value "${codeStr}" is not a valid ${referentialType} code`,
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
