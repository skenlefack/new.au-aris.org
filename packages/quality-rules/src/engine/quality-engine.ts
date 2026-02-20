import { QualityGateResult } from '@aris/shared-types';
import type {
  QualityReport,
  QualityGateConfig,
  QualityGateHandler,
  GateResult,
  QualityViolation,
} from '../interfaces/quality-report.interface';
import { CompletenessGate } from '../gates/completeness.gate';
import { TemporalConsistencyGate } from '../gates/temporal-consistency.gate';
import { GeographicConsistencyGate } from '../gates/geographic-consistency.gate';
import { CodeValidationGate } from '../gates/code-validation.gate';
import { UnitValidationGate } from '../gates/unit-validation.gate';
import { DeduplicationGate } from '../gates/deduplication.gate';
import { AuditabilityGate } from '../gates/auditability.gate';
import { ConfidenceScoreGate } from '../gates/confidence-score.gate';

/**
 * QualityEngine runs all 8 quality gates on a record and produces a QualityReport.
 *
 * Usage:
 * ```typescript
 * const engine = new QualityEngine();
 * const report = engine.check(record, 'Outbreak', config);
 * if (report.overallResult === QualityGateResult.PASS) { ... }
 * ```
 */
export class QualityEngine {
  private readonly gates: QualityGateHandler[];

  constructor(customGates?: QualityGateHandler[]) {
    this.gates = customGates ?? [
      new CompletenessGate(),
      new TemporalConsistencyGate(),
      new GeographicConsistencyGate(),
      new CodeValidationGate(),
      new UnitValidationGate(),
      new DeduplicationGate(),
      new AuditabilityGate(),
      new ConfidenceScoreGate(),
    ];
  }

  /**
   * Run all quality gates against a record.
   */
  check(
    record: Record<string, unknown>,
    entityType: string,
    config: QualityGateConfig,
  ): QualityReport {
    const totalStart = Date.now();
    const recordId = String(record['id'] ?? 'unknown');

    const gateResults: GateResult[] = [];
    const allViolations: QualityViolation[] = [];

    for (const gate of this.gates) {
      const result = gate.execute(record, config);
      gateResults.push(result);
      allViolations.push(...result.violations);
    }

    const overallResult = computeOverallResult(gateResults);

    return {
      recordId,
      entityType,
      overallResult,
      gates: gateResults,
      violations: allViolations,
      totalDurationMs: Date.now() - totalStart,
      checkedAt: new Date().toISOString(),
    };
  }
}

function computeOverallResult(gates: GateResult[]): QualityGateResult {
  let hasWarning = false;

  for (const gate of gates) {
    if (gate.result === QualityGateResult.FAIL) {
      return QualityGateResult.FAIL;
    }
    if (gate.result === QualityGateResult.WARNING) {
      hasWarning = true;
    }
  }

  return hasWarning ? QualityGateResult.WARNING : QualityGateResult.PASS;
}
