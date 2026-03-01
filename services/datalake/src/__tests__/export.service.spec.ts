import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../services/export.service';
import { QueryEngineService } from '../services/query-engine.service';
import { MinioStorage } from '../services/minio.storage';

function createMockPrisma() {
  return {
    dataExport: {
      create: vi.fn().mockResolvedValue({
        id: 'export-uuid-1',
        name: 'Test Export',
        status: 'PENDING',
        format: 'CSV',
        query: {},
        requested_by: 'user-1',
        tenant_id: 'tenant-1',
        file_path: null,
        file_size: null,
        row_count: null,
        error_message: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'export-uuid-1',
        name: 'Test Export',
        status: 'COMPLETED',
        format: 'CSV',
        query: { dimensions: [], measures: [{ field: '*', function: 'COUNT' }] },
        requested_by: 'user-1',
        tenant_id: 'tenant-1',
        file_path: 'exports/tenant-1/export-uuid-1.csv',
        file_size: BigInt(1024),
        row_count: 10,
        error_message: null,
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  } as any;
}

function createMockQueryEngine() {
  return {
    query: vi.fn().mockResolvedValue({ data: [{ count: 42 }], meta: { total: 1, page: 1, limit: 100 } }),
  } as any;
}

function createMockMinio() {
  return {
    defaultBucket: 'aris-datalake-exports',
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
    getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/presigned-url'),
  } as any;
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('ExportService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let queryEngine: ReturnType<typeof createMockQueryEngine>;
  let minio: ReturnType<typeof createMockMinio>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: ExportService;

  beforeEach(() => {
    prisma = createMockPrisma();
    queryEngine = createMockQueryEngine();
    minio = createMockMinio();
    kafka = createMockKafka();
    service = new ExportService(prisma, queryEngine, minio, kafka);
  });

  it('should create export record with PENDING status', async () => {
    const result = await service.createExport(
      {
        name: 'Test Export',
        query: { dimensions: [], measures: [{ field: '*', function: 'COUNT' }] },
        format: 'CSV',
      },
      'tenant-1',
      'user-1',
      'MEMBER_STATE',
    );

    expect(prisma.dataExport.create).toHaveBeenCalledTimes(1);
    expect(prisma.dataExport.create.mock.calls[0][0].data.status).toBe('PENDING');
    expect(result.data).toHaveProperty('id');
  });

  it('should convert query result to CSV format', () => {
    const data = [
      { source: 'HEALTH', entity_type: 'outbreak', count: 10 },
      { source: 'LIVESTOCK', entity_type: 'census', count: 5 },
    ];

    const result = service.convertToFormat(data, 'CSV');
    expect(result.contentType).toBe('text/csv');
    expect(result.extension).toBe('csv');

    const csv = result.buffer.toString('utf-8');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('source,entity_type,count');
    expect(lines[1]).toBe('HEALTH,outbreak,10');
    expect(lines[2]).toBe('LIVESTOCK,census,5');
  });

  it('should return presigned download URL for completed export', async () => {
    const result = await service.getExport('export-uuid-1', 'tenant-1', 'MEMBER_STATE');

    expect(result.data['downloadUrl']).toBe('https://minio.local/presigned-url');
    expect(minio.getPresignedDownloadUrl).toHaveBeenCalledWith({
      bucket: 'aris-datalake-exports',
      key: 'exports/tenant-1/export-uuid-1.csv',
      expiresIn: 3600,
    });
  });
});
