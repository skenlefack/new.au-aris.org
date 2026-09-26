import type { PrismaClient } from '@prisma/client';

const ML_SERVICE_URL = process.env['ML_SERVICE_URL'] ?? 'http://10.202.101.142:8000';

/**
 * Processes user corrections to improve future matching accuracy.
 * - Enriches the MappingCorrection table (already stored at mapping confirmation)
 * - Builds a correction index for the lexical annotator to use
 * - Increments acceptance counts on FormSignature for history bonus
 */
export class LearningService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * After a successful commit, increment the acceptance count on the matched template's signature.
   * This improves the history bonus (w5) for future matches.
   */
  async recordAcceptance(templateId: string, tenantId: string, domainCode: string): Promise<void> {
    try {
      await (this.prisma as any).formSignature.updateMany({
        where: { templateId, tenantId, domainCode },
        data: { acceptanceCount: { increment: 1 } },
      });
    } catch { /* best-effort */ }
  }

  /**
   * Build a correction-based alias lookup from stored MappingCorrections.
   * Returns a map: normalizedSourceName → targetFieldCode
   * Used by the lexical annotator as a priority lookup before the static dictionary.
   */
  async getCorrectionAliases(tenantId: string, domainCode: string): Promise<Map<string, string>> {
    const corrections = await (this.prisma as any).mappingCorrection.findMany({
      where: { tenantId, domainCode },
      select: { sourceColumnName: true, targetFieldCode: true },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, string>();
    for (const c of corrections) {
      const normalized = (c.sourceColumnName as string).toLowerCase().trim().replace(/\s+/g, '_');
      if (!map.has(normalized)) {
        map.set(normalized, c.targetFieldCode as string);
      }
    }
    return map;
  }

  /**
   * Get matching quality metrics for a tenant+domain.
   * Returns acceptance rate, average score of accepted proposals, LLM usage rate.
   */
  async getQualityMetrics(tenantId: string, domainCode: string): Promise<{
    totalFiles: number;
    committedFiles: number;
    acceptanceRate: number;
    averageScore: number;
    llmUsageRate: number;
    correctionCount: number;
  }> {
    const totalFiles = await (this.prisma as any).ingestFile.count({
      where: { tenantId, domainCode, status: { not: 'CANCELLED' } },
    });

    const committedFiles = await (this.prisma as any).ingestFile.count({
      where: { tenantId, domainCode, status: 'COMMITTED' },
    });

    // Average score of accepted proposals
    const acceptedProposals = await (this.prisma as any).matchProposal.findMany({
      where: { status: 'ACCEPTED', file: { tenantId, domainCode } },
      select: { scoreGlobal: true },
    });
    const averageScore = acceptedProposals.length > 0
      ? acceptedProposals.reduce((sum: number, p: { scoreGlobal: number }) => sum + p.scoreGlobal, 0) / acceptedProposals.length
      : 0;

    // LLM usage rate: columns annotated by LLM / total columns
    const totalColumns = await (this.prisma as any).columnProfile.count({
      where: { profile: { file: { tenantId, domainCode } } },
    });
    const llmColumns = await (this.prisma as any).columnProfile.count({
      where: {
        attributionMethod: 'LLM',
        profile: { file: { tenantId, domainCode } },
      },
    });

    const correctionCount = await (this.prisma as any).mappingCorrection.count({
      where: { tenantId, domainCode },
    });

    return {
      totalFiles,
      committedFiles,
      acceptanceRate: totalFiles > 0 ? committedFiles / totalFiles : 0,
      averageScore: Math.round(averageScore * 10000) / 10000,
      llmUsageRate: totalColumns > 0 ? llmColumns / totalColumns : 0,
      correctionCount,
    };
  }

  /**
   * Request reranking of proposals via XGBoost model (python-ml).
   * Uses features: lexical score, semantic score, type compatibility, referential overlap, history.
   */
  async rerankProposals(
    proposals: Array<{
      templateId: string;
      scoreCoverage: number;
      scoreSemantic: number;
      scoreTypes: number;
      scoreReferentials: number;
      scoreHistory: number;
    }>,
  ): Promise<Array<{ templateId: string; rerankScore: number }>> {
    try {
      const features = proposals.map((p) => ({
        coverage: p.scoreCoverage,
        semantic: p.scoreSemantic,
        types: p.scoreTypes,
        referentials: p.scoreReferentials,
        history: p.scoreHistory,
      }));

      const res = await fetch(`${ML_SERVICE_URL}/api/rerank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) return proposals.map((p) => ({ templateId: p.templateId, rerankScore: 0 }));

      const body = await res.json() as { scores?: number[] };
      return proposals.map((p, i) => ({
        templateId: p.templateId,
        rerankScore: body.scores?.[i] ?? 0,
      }));
    } catch {
      // R6: ML unavailable → return zero scores (fallback to composite score)
      return proposals.map((p) => ({ templateId: p.templateId, rerankScore: 0 }));
    }
  }

  /**
   * Detect anomalous values in incoming data rows via Isolation Forest (python-ml).
   */
  async detectAnomalies(
    rows: Array<Record<string, unknown>>,
    numericFields: string[],
  ): Promise<Array<{ rowIndex: number; anomalyScore: number; isAnomaly: boolean }>> {
    if (numericFields.length === 0 || rows.length === 0) return [];

    try {
      const data = rows.map((row) => {
        const values: Record<string, unknown> = {};
        for (const field of numericFields) {
          const val = row[field];
          values[field] = typeof val === 'number' ? val : parseFloat(String(val ?? '0')) || 0;
        }
        return values;
      });

      const res = await fetch(`${ML_SERVICE_URL}/api/anomalies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, method: 'isolation_forest', threshold: 0.1 }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) return [];

      const body = await res.json() as { results?: Array<{ score: number; is_anomaly: boolean }> };
      return (body.results ?? []).map((r, i) => ({
        rowIndex: i,
        anomalyScore: r.score,
        isAnomaly: r.is_anomaly,
      }));
    } catch {
      // R6: ML unavailable → no anomaly detection
      return [];
    }
  }
}
