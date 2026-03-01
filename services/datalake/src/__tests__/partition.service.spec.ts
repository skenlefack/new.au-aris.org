import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PartitionService } from '../services/partition.service';

function createMockPrisma() {
  return {
    dataLakePartition: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'part-uuid-1',
        table_name: 'data_lake_entry',
        partition_key: 'HEALTH:2025-01-01',
        source: 'HEALTH',
        row_count: 100,
        size_bytes: BigInt(50000),
        status: 'ACTIVE',
        archived_at: null,
        archive_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({
        id: 'part-uuid-1',
        status: 'ARCHIVED',
        size_bytes: BigInt(12345),
      }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  } as any;
}

function createMockMinio() {
  return {
    defaultBucket: 'aris-datalake-exports',
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('PartitionService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let minio: ReturnType<typeof createMockMinio>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: PartitionService;

  beforeEach(() => {
    prisma = createMockPrisma();
    minio = createMockMinio();
    kafka = createMockKafka();
    service = new PartitionService(prisma, minio, kafka);
  });

  it('should generate partition key from source and quarter', () => {
    const key = PartitionService.generatePartitionKey('HEALTH', new Date('2025-03-15'));
    expect(key).toBe('HEALTH:2025-Q1');

    const key2 = PartitionService.generatePartitionKey('LIVESTOCK', new Date('2025-07-01'));
    expect(key2).toBe('LIVESTOCK:2025-Q3');

    const key3 = PartitionService.generatePartitionKey('FISHERIES', new Date('2025-11-30'));
    expect(key3).toBe('FISHERIES:2025-Q4');
  });

  it('should update partition status to ARCHIVED', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: '1', data: 'test' }]);

    const result = await service.archivePartition('part-uuid-1', 'user-1');

    // Should have updated to ARCHIVING first
    expect(prisma.dataLakePartition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'part-uuid-1' },
        data: { status: 'ARCHIVING' },
      }),
    );

    // Should have uploaded to MinIO
    expect(minio.putObject).toHaveBeenCalledTimes(1);

    // Should have deleted from main table
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();

    // Final update should set ARCHIVED
    const lastUpdate = prisma.dataLakePartition.update.mock.calls[prisma.dataLakePartition.update.mock.calls.length - 1][0];
    expect(lastUpdate.data.status).toBe('ARCHIVED');
    expect(lastUpdate.data.archived_at).toBeDefined();
  });
});
