import { describe, it, expect, vi } from 'vitest';
import { LearningService } from './learning.service';

const mockPrisma = {
  formSignature: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  mappingCorrection: {
    findMany: vi.fn().mockResolvedValue([
      { sourceColumnName: 'Animal Type', targetFieldCode: 'species' },
      { sourceColumnName: 'Espece', targetFieldCode: 'species' },
      { sourceColumnName: 'Date observation', targetFieldCode: 'date' },
    ]),
    count: vi.fn().mockResolvedValue(3),
  },
  ingestFile: { count: vi.fn().mockResolvedValue(10) },
  matchProposal: { findMany: vi.fn().mockResolvedValue([{ scoreGlobal: 0.85 }, { scoreGlobal: 0.72 }]) },
  columnProfile: { count: vi.fn().mockResolvedValue(100) },
};

describe('LearningService', () => {
  const service = new LearningService(mockPrisma as any);

  it('builds correction aliases map', async () => {
    const aliases = await service.getCorrectionAliases('t1', 'animal-health');
    expect(aliases.size).toBe(3);
    expect(aliases.get('animal_type')).toBe('species');
    expect(aliases.get('espece')).toBe('species');
    expect(aliases.get('date_observation')).toBe('date');
  });

  it('records acceptance (increments count)', async () => {
    await service.recordAcceptance('tpl1', 't1', 'animal-health');
    expect(mockPrisma.formSignature.updateMany).toHaveBeenCalledWith({
      where: { templateId: 'tpl1', tenantId: 't1', domainCode: 'animal-health' },
      data: { acceptanceCount: { increment: 1 } },
    });
  });

  it('computes quality metrics', async () => {
    mockPrisma.ingestFile.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(7); // committed
    mockPrisma.columnProfile.count
      .mockResolvedValueOnce(100) // total columns
      .mockResolvedValueOnce(12); // LLM columns

    const metrics = await service.getQualityMetrics('t1', 'animal-health');
    expect(metrics.totalFiles).toBe(10);
    expect(metrics.committedFiles).toBe(7);
    expect(metrics.acceptanceRate).toBe(0.7);
    expect(metrics.llmUsageRate).toBe(0.12);
    expect(metrics.correctionCount).toBe(3);
  });

  it('rerankProposals returns zero scores on ML failure', async () => {
    const proposals = [
      { templateId: 'a', scoreCoverage: 0.8, scoreSemantic: 0.7, scoreTypes: 0.9, scoreReferentials: 0.5, scoreHistory: 0.3 },
    ];
    const result = await service.rerankProposals(proposals);
    expect(result).toHaveLength(1);
    expect(result[0].templateId).toBe('a');
    // ML not available in test → returns 0
    expect(result[0].rerankScore).toBe(0);
  });

  it('detectAnomalies returns empty on no numeric fields', async () => {
    const result = await service.detectAnomalies([{ name: 'test' }], []);
    expect(result).toHaveLength(0);
  });
});
