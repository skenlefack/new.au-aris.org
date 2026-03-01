import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryEngineService } from '../services/query-engine.service';

function createMockPrisma() {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  } as any;
}

describe('QueryEngineService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let engine: QueryEngineService;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new QueryEngineService(prisma);
  });

  it('should build valid SQL for COUNT query with tenantId filter', async () => {
    // No dimensions → no count query, just the data query (total=1)
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: 42 }]);

    const result = await engine.query(
      {
        dimensions: [],
        measures: [{ field: '*', function: 'COUNT' }],
      },
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      'MEMBER_STATE',
    );

    expect(result.data).toEqual([{ count: 42 }]);
    // Should have called with SQL containing tenant_id filter
    const dataSql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(dataSql).toContain('"tenant_id"');
    expect(dataSql).toContain('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
  });

  it('should build GROUP BY clause from dimensions', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([
        { source: 'HEALTH', count_entity_id: 10 },
        { source: 'LIVESTOCK', count_entity_id: 5 },
      ]);

    const result = await engine.query(
      {
        dimensions: ['source'],
        measures: [{ field: '*', function: 'COUNT' }],
      },
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      'MEMBER_STATE',
    );

    const dataSql = prisma.$queryRawUnsafe.mock.calls[1][0] as string;
    expect(dataSql).toContain('GROUP BY "source"');
    expect(dataSql).toContain('"source"');
  });

  it('should apply date range filter', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([{ count: 10 }]);

    await engine.query(
      {
        dimensions: [],
        measures: [{ field: '*', function: 'COUNT' }],
        dateRange: { from: '2025-01-01', to: '2025-12-31' },
      },
      'tenant-uuid',
      'MEMBER_STATE',
    );

    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('"ingested_at" >=');
    expect(sql).toContain('2025-01-01');
    expect(sql).toContain('"ingested_at" <=');
    expect(sql).toContain('2025-12-31');
  });

  it('should reject invalid column names not in allowlist', async () => {
    await expect(
      engine.query(
        {
          dimensions: ['DROP TABLE'],
          measures: [{ field: '*', function: 'COUNT' }],
        },
        'tenant-uuid',
        'MEMBER_STATE',
      ),
    ).rejects.toThrow('Invalid column name');

    await expect(
      engine.query(
        {
          dimensions: ['payload'],
          measures: [{ field: '*', function: 'COUNT' }],
        },
        'tenant-uuid',
        'MEMBER_STATE',
      ),
    ).rejects.toThrow('Column not allowed');
  });

  it('should handle CONTINENTAL tenant level (no tenant filter)', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: 100 }]);

    await engine.query(
      {
        dimensions: [],
        measures: [{ field: '*', function: 'COUNT' }],
      },
      'au-tenant-uuid',
      'CONTINENTAL',
    );

    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toContain('"tenant_id"');
  });
});
