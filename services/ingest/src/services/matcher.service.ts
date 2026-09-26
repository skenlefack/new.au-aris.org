import type { ColumnStats } from '../parsers/types';
import { normalizeName } from './profiler.service';

// Configurable weights from environment
const W_COVERAGE = parseFloat(process.env['INGEST_SCORE_WEIGHT_COVERAGE'] ?? '0.35');
const W_SEMANTIC = parseFloat(process.env['INGEST_SCORE_WEIGHT_SEMANTIC'] ?? '0.25');
const W_TYPES = parseFloat(process.env['INGEST_SCORE_WEIGHT_TYPES'] ?? '0.20');
const W_REFERENTIALS = parseFloat(process.env['INGEST_SCORE_WEIGHT_REFERENTIALS'] ?? '0.15');
const W_HISTORY = parseFloat(process.env['INGEST_SCORE_WEIGHT_HISTORY'] ?? '0.05');

const THRESHOLD_FIRM = parseFloat(process.env['INGEST_THRESHOLD_FIRM'] ?? '0.85');
const THRESHOLD_REVIEW = parseFloat(process.env['INGEST_THRESHOLD_REVIEW'] ?? '0.60');

export interface FormCandidate {
  templateId: string;
  templateName: string;
  fields: Array<{
    code: string;
    label: string;
    type: string;
    required: boolean;
    masterDataType?: string;
  }>;
  acceptanceCount: number;
}

export interface MatchResult {
  templateId: string;
  templateName: string;
  rank: number;
  scoreGlobal: number;
  scoreCoverage: number;
  scoreSemantic: number;
  scoreTypes: number;
  scoreReferentials: number;
  scoreHistory: number;
  fieldMappings: Array<{
    sourceColumn: string;
    targetFieldCode: string;
    targetFieldLabel: string;
    confidence: number;
  }>;
  recommendation: 'firm' | 'review' | 'none';
}

/**
 * Compute match scores for a list of form candidates against source columns.
 * Pure function — no side effects.
 */
export function computeMatches(
  columns: ColumnStats[],
  candidates: FormCandidate[],
  semanticScores?: Map<string, Map<string, number>>, // sourceCol → fieldCode → similarity
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const { mappings, scoreCoverage, scoreSemantic, scoreTypes, scoreReferentials } =
      computeFieldMappings(columns, candidate, semanticScores);

    const maxAcceptance = Math.max(1, ...candidates.map((c) => c.acceptanceCount));
    const scoreHistory = candidate.acceptanceCount / maxAcceptance;

    const scoreGlobal =
      W_COVERAGE * scoreCoverage +
      W_SEMANTIC * scoreSemantic +
      W_TYPES * scoreTypes +
      W_REFERENTIALS * scoreReferentials +
      W_HISTORY * scoreHistory;

    const recommendation = scoreGlobal >= THRESHOLD_FIRM
      ? 'firm' as const
      : scoreGlobal >= THRESHOLD_REVIEW
        ? 'review' as const
        : 'none' as const;

    results.push({
      templateId: candidate.templateId,
      templateName: candidate.templateName,
      rank: 0, // assigned after sort
      scoreGlobal: round(scoreGlobal),
      scoreCoverage: round(scoreCoverage),
      scoreSemantic: round(scoreSemantic),
      scoreTypes: round(scoreTypes),
      scoreReferentials: round(scoreReferentials),
      scoreHistory: round(scoreHistory),
      fieldMappings: mappings,
      recommendation,
    });
  }

  // Sort by score descending and assign ranks
  results.sort((a, b) => b.scoreGlobal - a.scoreGlobal);
  results.forEach((r, idx) => { r.rank = idx + 1; });

  return results;
}

function computeFieldMappings(
  columns: ColumnStats[],
  candidate: FormCandidate,
  semanticScores?: Map<string, Map<string, number>>,
): {
  mappings: MatchResult['fieldMappings'];
  scoreCoverage: number;
  scoreSemantic: number;
  scoreTypes: number;
  scoreReferentials: number;
} {
  const mappings: MatchResult['fieldMappings'] = [];
  let matchedRequired = 0;
  let totalRequired = 0;
  let semanticSum = 0;
  let semanticCount = 0;
  let typeMatchCount = 0;
  let refMatchCount = 0;
  let totalRefFields = 0;

  for (const field of candidate.fields) {
    if (field.required) totalRequired++;
    if (field.masterDataType) totalRefFields++;

    // Find best matching source column
    let bestCol: ColumnStats | null = null;
    let bestConfidence = 0;

    for (const col of columns) {
      let confidence = 0;

      // Lexical similarity (normalized name match)
      const lexSim = levenshteinSimilarity(col.normalizedName, normalizeName(field.code));
      const labelSim = levenshteinSimilarity(col.normalizedName, normalizeName(field.label));
      const lexMax = Math.max(lexSim, labelSim);

      // Semantic similarity (if provided)
      const semSim = semanticScores?.get(col.rawName)?.get(field.code) ?? 0;

      confidence = Math.max(lexMax, semSim);

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestCol = col;
      }
    }

    if (bestCol && bestConfidence > 0.3) {
      mappings.push({
        sourceColumn: bestCol.rawName,
        targetFieldCode: field.code,
        targetFieldLabel: field.label,
        confidence: round(bestConfidence),
      });

      if (field.required) matchedRequired++;
      semanticSum += bestConfidence;
      semanticCount++;

      // Type compatibility
      if (isTypeCompatible(bestCol.inferredType, field.type)) typeMatchCount++;

      // Referential overlap
      if (field.masterDataType && bestCol.inferredType === 'select') refMatchCount++;
    }
  }

  const scoreCoverage = totalRequired > 0 ? matchedRequired / totalRequired : 1;
  const scoreSemantic = semanticCount > 0 ? semanticSum / semanticCount : 0;
  const scoreTypes = mappings.length > 0 ? typeMatchCount / mappings.length : 0;
  const scoreReferentials = totalRefFields > 0 ? refMatchCount / totalRefFields : 1;

  return { mappings, scoreCoverage, scoreSemantic, scoreTypes, scoreReferentials };
}

function isTypeCompatible(sourceType: string, targetType: string): boolean {
  const compatMap: Record<string, string[]> = {
    text: ['text', 'textarea', 'select', 'radio', 'email', 'phone', 'url'],
    integer: ['number', 'integer'],
    decimal: ['number', 'decimal'],
    date: ['date'],
    boolean: ['boolean', 'checkbox'],
    email: ['email', 'text'],
    phone: ['phone', 'text'],
    select: ['select', 'radio', 'master-data-select', 'text'],
    coordinate: ['number', 'geo-selector'],
  };
  return (compatMap[sourceType] ?? []).includes(targetType) || sourceType === targetType;
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
