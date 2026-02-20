import { QualityGate, QualityGateResult } from '@aris/shared-types';
import type {
  GateResult,
  QualityGateConfig,
  QualityGateHandler,
  QualityViolation,
} from '../interfaces/quality-report.interface';

/**
 * Gate 6: DEDUPLICATION
 * Two-pass duplicate detection:
 * 1. Deterministic: exact match on all dedupFields
 * 2. Probabilistic: fuzzy token-level similarity above threshold
 */
export class DeduplicationGate implements QualityGateHandler {
  readonly gate = QualityGate.DEDUPLICATION;

  execute(
    record: Record<string, unknown>,
    config: QualityGateConfig,
  ): GateResult {
    const start = Date.now();
    const violations: QualityViolation[] = [];

    const dedupFields = config.dedupFields ?? [];
    const existingRecords = config.existingRecords ?? [];

    if (dedupFields.length === 0 || existingRecords.length === 0) {
      return {
        gate: this.gate,
        result: QualityGateResult.SKIPPED,
        violations: [],
        durationMs: Date.now() - start,
      };
    }

    const threshold = config.fuzzyThreshold ?? 0.8;

    for (const existing of existingRecords) {
      const existingRec = existing as Record<string, unknown>;

      // 1. Deterministic match
      const exactMatch = dedupFields.every(
        (f) => normalizeValue(record[f]) === normalizeValue(existingRec[f]),
      );

      if (exactMatch) {
        violations.push({
          gate: this.gate,
          field: dedupFields.join('+'),
          message: `Exact duplicate found on fields [${dedupFields.join(', ')}] matching record "${existingRec['id'] ?? 'unknown'}"`,
          severity: 'FAIL',
        });
        continue;
      }

      // 2. Probabilistic match (token similarity)
      const similarity = computeSimilarity(record, existingRec, dedupFields);
      if (similarity >= threshold) {
        violations.push({
          gate: this.gate,
          field: dedupFields.join('+'),
          message: `Probable duplicate (similarity=${(similarity * 100).toFixed(1)}%) on fields [${dedupFields.join(', ')}] with record "${existingRec['id'] ?? 'unknown'}"`,
          severity: 'WARNING',
        });
      }
    }

    const hasFails = violations.some((v) => v.severity === 'FAIL');

    return {
      gate: this.gate,
      result: hasFails
        ? QualityGateResult.FAIL
        : violations.length > 0
          ? QualityGateResult.WARNING
          : QualityGateResult.PASS,
      violations,
      durationMs: Date.now() - start,
    };
  }
}

function normalizeValue(v: unknown): string {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

/**
 * Token-level Jaccard similarity across all dedup fields.
 */
function computeSimilarity(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: string[],
): number {
  const tokensA = new Set<string>();
  const tokensB = new Set<string>();

  for (const field of fields) {
    for (const token of tokenize(a[field])) tokensA.add(`${field}:${token}`);
    for (const token of tokenize(b[field])) tokensB.add(`${field}:${token}`);
  }

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  return intersection / (tokensA.size + tokensB.size - intersection);
}

function tokenize(value: unknown): string[] {
  if (value == null) return [];
  return String(value).trim().toLowerCase().split(/\s+/).filter(Boolean);
}
