import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 8: CONFIDENCE_SCORE
 * Auto-calculates confidence level for event-based data.
 *
 * Levels:
 * - CONFIRMED: lab results + official confirmation
 * - VERIFIED: field investigation completed
 * - RUMOR: no supporting evidence
 *
 * The gate checks that:
 * 1. A confidence level field is present
 * 2. The level is consistent with available evidence fields
 */
const VALID_CONFIDENCE_LEVELS = new Set(['RUMOR', 'VERIFIED', 'CONFIRMED']);

export class ConfidenceScoreGate implements QualityGateHandler {
  readonly gate = QualityGate.CONFIDENCE_SCORE;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const levelField = config.confidenceLevelField;

    if (!levelField) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    const level = record[levelField];

    // 1. Level must be present
    if (level == null || level === '') {
      violations.push({
        gate: this.gate,
        field: levelField,
        message: `Confidence level field "${levelField}" is missing`,
        severity: 'FAIL',
      });
      return {
        gate: this.gate,
        result: QualityGateResult.FAIL,
        violations,
        durationMs: Date.now() - start,
      };
    }

    // 2. Level must be valid
    const levelStr = String(level).toUpperCase();
    if (!VALID_CONFIDENCE_LEVELS.has(levelStr)) {
      violations.push({
        gate: this.gate,
        field: levelField,
        message: `Confidence level "${level}" is not valid. Expected: RUMOR, VERIFIED, or CONFIRMED`,
        severity: 'FAIL',
      });
    }

    // 3. Evidence consistency check
    const evidenceFields = config.confidenceEvidenceFields ?? [];
    const evidenceCount = evidenceFields.filter((f) => {
      const v = record[f];
      return v !== undefined && v !== null && v !== '' && v !== false;
    }).length;

    if (levelStr === 'CONFIRMED' && evidenceCount === 0 && evidenceFields.length > 0) {
      violations.push({
        gate: this.gate,
        field: levelField,
        message: `Confidence level is CONFIRMED but no evidence fields are populated (expected: ${evidenceFields.join(', ')})`,
        severity: 'WARNING',
      });
    }

    if (levelStr === 'RUMOR' && evidenceCount === evidenceFields.length && evidenceFields.length > 0) {
      violations.push({
        gate: this.gate,
        field: levelField,
        message: `Confidence level is RUMOR but all evidence fields are populated — consider upgrading to VERIFIED or CONFIRMED`,
        severity: 'WARNING',
      });
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
