import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WahisService } from '../wahis.service';
import { EmpresService } from '../empres.service';
import { FaostatService } from '../faostat.service';
import { ConnectorService } from '../connector.service';
import { ExportSchedulerService } from '../export-scheduler.service';

// ── Mocks ──

function createMockPrisma() {
  return {
    exportRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    feedRecord: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    syncRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    connectorConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  };
}

function createMockKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function createMockMinio() {
  return {
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
    getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/interop-exports/test.xml'),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

const continentalUser = {
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: 'SUPER_ADMIN',
  tenantLevel: 'CONTINENTAL',
  email: 'admin@au-aris.org',
} as any;

const nationalUser = {
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: 'NATIONAL_ADMIN',
  tenantLevel: 'MEMBER_STATE',
  email: 'admin@ke.au-aris.org',
} as any;

const sampleExportRow = {
  id: 'exp-1',
  tenant_id: TENANT_ID,
  connector_type: 'WAHIS',
  country_code: 'KE',
  period_start: new Date('2026-01-01'),
  period_end: new Date('2026-06-30'),
  format: 'WOAH_JSON',
  status: 'COMPLETED',
  record_count: 5,
  package_url: '/api/v1/interop/wahis/exports/exp-1/download',
  package_size: 1024,
  error_message: null,
  exported_by: USER_ID,
  exported_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

const sampleFeedRow = {
  id: 'feed-1',
  tenant_id: TENANT_ID,
  connector_type: 'EMPRES',
  health_event_id: 'he-1',
  disease_id: null,
  country_code: 'KE',
  confidence_level: 'CONFIRMED',
  status: 'COMPLETED',
  payload: {},
  response_code: 200,
  response_body: '{"accepted":true}',
  error_message: null,
  fed_by: USER_ID,
  fed_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

describe('WahisService', () => {
  let service: WahisService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let minio: ReturnType<typeof createMockMinio>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    minio = createMockMinio();
    service = new WahisService(prisma as any, kafka as any, minio as any);
  });

  // ── 1. Create export ──
  it('should create a WAHIS export record and publish event', async () => {
    prisma.exportRecord.create.mockResolvedValue({ ...sampleExportRow, status: 'PENDING' });
    prisma.exportRecord.update.mockResolvedValue(sampleExportRow);

    const result = await service.createExport(
      { countryCode: 'KE', periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      continentalUser,
    );

    expect(result.data.connectorType).toBe('WAHIS');
    expect(result.data.status).toBe('COMPLETED');
    expect(kafka.send).toHaveBeenCalled();
  });

  // ── 2. Export handles failure ──
  it('should mark export as FAILED when generation throws', async () => {
    prisma.exportRecord.create.mockResolvedValue({ ...sampleExportRow, status: 'PENDING' });
    prisma.$queryRaw.mockRejectedValue(new Error('DB timeout'));
    prisma.exportRecord.update.mockResolvedValue({ ...sampleExportRow, status: 'FAILED', error_message: 'DB timeout' });

    const result = await service.createExport(
      { countryCode: 'KE', periodStart: '2026-01-01', periodEnd: '2026-06-30' },
      continentalUser,
    );

    expect(result.data.status).toBe('FAILED');
  });

  // ── 3. findAll with pagination ──
  it('should return paginated WAHIS exports', async () => {
    prisma.exportRecord.findMany.mockResolvedValue([sampleExportRow]);
    prisma.exportRecord.count.mockResolvedValue(1);

    const result = await service.findAll(continentalUser, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  // ── 4. findOne 404 ──
  it('should throw 404 when export record not found', async () => {
    prisma.exportRecord.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent', continentalUser)).rejects.toThrow('not found');
  });

  // ── 5. Tenant isolation ──
  it('should throw 404 when national user accesses other tenant export', async () => {
    prisma.exportRecord.findUnique.mockResolvedValue({
      ...sampleExportRow,
      tenant_id: 'other-tenant',
    });

    await expect(service.findOne('exp-1', nationalUser)).rejects.toThrow('not found');
  });

  // ── 6. toEntity maps snake_case to camelCase ──
  it('should map snake_case DB row to camelCase entity', () => {
    const entity = service.toEntity(sampleExportRow);

    expect(entity.tenantId).toBe(TENANT_ID);
    expect(entity.connectorType).toBe('WAHIS');
    expect(entity.countryCode).toBe('KE');
    expect(entity.recordCount).toBe(5);
  });

  // ── 7. exportWahis generates XML and uploads to MinIO ──
  it('should generate WAHIS XML export and upload to MinIO', async () => {
    prisma.exportRecord.create.mockResolvedValue({ ...sampleExportRow, status: 'PENDING', format: 'WOAH_XML' });
    prisma.exportRecord.update.mockResolvedValue({ ...sampleExportRow, format: 'WOAH_XML' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await service.exportWahis(
      { countryIso: 'KEN', year: 2024, quarter: 1, diseases: ['FMD'] },
      continentalUser,
    );

    expect(result.data.connectorType).toBe('WAHIS');
    expect(minio.putObject).toHaveBeenCalledTimes(1);
    expect(minio.getPresignedDownloadUrl).toHaveBeenCalledTimes(1);

    // Verify MinIO upload key format
    const putCall = minio.putObject.mock.calls[0][0];
    expect(putCall.bucket).toBe('interop-exports');
    expect(putCall.key).toContain('wahis/KEN/2024-Q1/');
    expect(putCall.contentType).toBe('application/xml');
  });

  // ── 8. XML export with MinIO upload contains valid XML ──
  it('should upload valid XML content to MinIO', async () => {
    prisma.exportRecord.create.mockResolvedValue({ ...sampleExportRow, status: 'PENDING', format: 'WOAH_XML' });
    prisma.exportRecord.update.mockResolvedValue({ ...sampleExportRow, format: 'WOAH_XML' });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'he-1',
        disease_code: 'FMD',
        disease_name: 'Foot-and-Mouth Disease',
        reported_date: new Date('2024-01-15'),
        onset_date: null,
        latitude: -1.29,
        longitude: 36.82,
        admin_level1: 'Nairobi',
        species_name: 'Cattle',
        cases: 50,
        deaths: 3,
        control_measures: null,
      },
    ]);

    await service.exportWahis(
      { countryIso: 'KEN', year: 2024, quarter: 1, diseases: [] },
      continentalUser,
    );

    const putCall = minio.putObject.mock.calls[0][0];
    const xmlContent = putCall.body.toString('utf-8');

    expect(xmlContent).toContain('WAHIS_Report');
    expect(xmlContent).toContain('iso3="KEN"');
    expect(xmlContent).toContain('oieCode="FMD"');
  });

  // ── 9. findAllExports across connector types ──
  it('should find exports across all connector types with filtering', async () => {
    prisma.exportRecord.findMany.mockResolvedValue([
      sampleExportRow,
      { ...sampleExportRow, id: 'exp-2', connector_type: 'EMPRES' },
    ]);
    prisma.exportRecord.count.mockResolvedValue(2);

    const result = await service.findAllExports(continentalUser, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });

  // ── 10. findAllExports with connector filter ──
  it('should filter exports by connector type', async () => {
    prisma.exportRecord.findMany.mockResolvedValue([sampleExportRow]);
    prisma.exportRecord.count.mockResolvedValue(1);

    await service.findAllExports(continentalUser, { connector: 'WAHIS' });

    expect(prisma.exportRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ connector_type: 'WAHIS' }),
      }),
    );
  });

  // ── 11. retryExport re-creates failed export ──
  it('should retry a failed export', async () => {
    prisma.exportRecord.findUnique.mockResolvedValue({
      ...sampleExportRow,
      status: 'FAILED',
      error_message: 'DB timeout',
    });
    prisma.exportRecord.create.mockResolvedValue({ ...sampleExportRow, status: 'PENDING' });
    prisma.exportRecord.update.mockResolvedValue(sampleExportRow);

    const result = await service.retryExport('exp-1', continentalUser);

    expect(result.data.connectorType).toBe('WAHIS');
    expect(prisma.exportRecord.create).toHaveBeenCalled();
  });

  // ── 12. retryExport rejects non-FAILED exports ──
  it('should reject retry of non-FAILED export', async () => {
    prisma.exportRecord.findUnique.mockResolvedValue(sampleExportRow); // status: COMPLETED

    await expect(service.retryExport('exp-1', continentalUser)).rejects.toThrow(
      'Only FAILED exports can be retried',
    );
  });
});

describe('EmpresService', () => {
  let service: EmpresService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let minio: ReturnType<typeof createMockMinio>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    minio = createMockMinio();
    service = new EmpresService(prisma as any, kafka as any, minio as any);
  });

  // ── 13. Create EMPRES feed ──
  it('should create an EMPRES feed record and publish event', async () => {
    prisma.feedRecord.create.mockResolvedValue({ ...sampleFeedRow, status: 'PENDING' });
    prisma.feedRecord.update.mockResolvedValue(sampleFeedRow);

    const result = await service.createFeed(
      {
        healthEventId: 'he-1',
        diseaseCode: 'FMD',
        countryCode: 'KE',
        confidenceLevel: 'CONFIRMED',
        context: 'Outbreak in Nairobi',
      },
      continentalUser,
    );

    expect(result.data.connectorType).toBe('EMPRES');
    expect(result.data.status).toBe('COMPLETED');
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 14. findAll EMPRES feeds ──
  it('should return paginated EMPRES feeds', async () => {
    prisma.feedRecord.findMany.mockResolvedValue([sampleFeedRow]);
    prisma.feedRecord.count.mockResolvedValue(1);

    const result = await service.findAll(continentalUser, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  // ── 15. EMPRES feed handles failure gracefully ──
  it('should mark feed as FAILED when adapter throws', async () => {
    prisma.feedRecord.create.mockResolvedValue({ ...sampleFeedRow, status: 'PENDING' });
    service.sendToEmpres = vi.fn().mockRejectedValue(new Error('EMPRES endpoint down'));
    prisma.feedRecord.update.mockResolvedValue({ ...sampleFeedRow, status: 'FAILED', error_message: 'EMPRES endpoint down' });

    const result = await service.createFeed(
      {
        healthEventId: 'he-1',
        diseaseCode: 'FMD',
        countryCode: 'KE',
        confidenceLevel: 'CONFIRMED',
        context: 'Outbreak',
      },
      continentalUser,
    );

    expect(result.data.status).toBe('FAILED');
  });

  // ── 16. EMPRES JSON export ──
  it('should export EMPRES JSON and upload to MinIO', async () => {
    prisma.exportRecord.create.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'EMPRES',
      format: 'EMPRES_JSON',
      status: 'PENDING',
    });
    prisma.exportRecord.update.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'EMPRES',
      format: 'EMPRES_JSON',
    });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'he-1',
        disease_name: 'FMD',
        reported_date: new Date('2024-01-15'),
        species_name: 'Cattle',
        latitude: -1.29,
        longitude: 36.82,
        cases: 50,
        deaths: 3,
      },
    ]);

    const result = await service.exportEmpres(
      { countryIso: 'KEN', dateFrom: '2024-01-01', dateTo: '2024-03-31' },
      continentalUser,
    );

    expect(result.data.connectorType).toBe('EMPRES');
    expect(minio.putObject).toHaveBeenCalledTimes(1);

    const putCall = minio.putObject.mock.calls[0][0];
    expect(putCall.key).toContain('empres/KEN/');
    expect(putCall.contentType).toBe('application/json');

    // Verify JSON content
    const jsonContent = JSON.parse(putCall.body.toString('utf-8'));
    expect(jsonContent).toHaveLength(1);
    expect(jsonContent[0].disease_name).toBe('FMD');
    expect(jsonContent[0].country_iso).toBe('KEN');
  });
});

describe('FaostatService', () => {
  let service: FaostatService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let minio: ReturnType<typeof createMockMinio>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    minio = createMockMinio();
    service = new FaostatService(prisma as any, kafka as any, minio as any);
  });

  // ── 17. Create FAOSTAT sync ──
  it('should create a FAOSTAT sync record', async () => {
    const syncRow = {
      id: 'sync-1', tenant_id: TENANT_ID, connector_type: 'FAOSTAT',
      country_code: 'KE', year: 2025, status: 'COMPLETED',
      records_imported: 3, records_updated: 0, discrepancies: 0,
      discrepancy_details: [], source_url: null,
      synced_by: USER_ID, synced_at: new Date(),
      created_at: new Date(), updated_at: new Date(),
    };
    prisma.syncRecord.create.mockResolvedValue({ ...syncRow, status: 'IN_PROGRESS' });
    prisma.syncRecord.update.mockResolvedValue(syncRow);

    const result = await service.createSync(
      {
        countryCode: 'KE',
        year: 2025,
        records: [
          { countryCode: 'KE', speciesCode: 'CATTLE', year: 2025, population: 18000000 },
          { countryCode: 'KE', speciesCode: 'SHEEP', year: 2025, population: 17000000 },
          { countryCode: 'KE', speciesCode: 'GOAT', year: 2025, population: 27000000 },
        ],
      },
      continentalUser,
    );

    expect(result.data.status).toBe('COMPLETED');
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 18. Reconcile detects discrepancies above threshold ──
  it('should detect discrepancies above 10% threshold', async () => {
    service.findExistingDenominator = vi.fn()
      .mockResolvedValueOnce({ population: 100 })  // 50% diff
      .mockResolvedValueOnce({ population: 10000 }) // 1% diff, no discrepancy
      .mockResolvedValueOnce(null);                  // new import

    const result = await service.reconcileDenominators([
      { countryCode: 'KE', speciesCode: 'CATTLE', year: 2025, population: 150 },
      { countryCode: 'KE', speciesCode: 'SHEEP', year: 2025, population: 10100 },
      { countryCode: 'KE', speciesCode: 'GOAT', year: 2025, population: 27000 },
    ]);

    expect(result.imported).toBe(1);
    expect(result.updated).toBe(2);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].speciesCode).toBe('CATTLE');
    expect(result.discrepancies[0].percentDiff).toBe(50);
  });

  // ── 19. findAll FAOSTAT syncs ──
  it('should return paginated FAOSTAT syncs', async () => {
    prisma.syncRecord.findMany.mockResolvedValue([]);
    prisma.syncRecord.count.mockResolvedValue(0);

    const result = await service.findAll(continentalUser, {});

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  // ── 20. FAOSTAT CSV export ──
  it('should export FAOSTAT CSV and upload to MinIO', async () => {
    prisma.exportRecord.create.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'FAOSTAT',
      format: 'FAOSTAT_CSV',
      status: 'PENDING',
    });
    prisma.exportRecord.update.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'FAOSTAT',
      format: 'FAOSTAT_CSV',
    });
    prisma.$queryRawUnsafe.mockResolvedValue([
      { country_code: 'KE', species_name: 'Cattle', year: 2024, population: 18000000 },
      { country_code: 'KE', species_name: 'Sheep', year: 2024, population: 17000000 },
    ]);

    const result = await service.exportFaostat(
      { indicatorCode: 'QCL', countryIso: ['KE'], yearRange: [2024, 2024] },
      continentalUser,
    );

    expect(result.data.connectorType).toBe('FAOSTAT');
    expect(minio.putObject).toHaveBeenCalledTimes(1);

    const putCall = minio.putObject.mock.calls[0][0];
    expect(putCall.key).toContain('faostat/QCL/');
    expect(putCall.contentType).toBe('text/csv; charset=utf-8');

    // Verify CSV content has BOM
    const csvContent = putCall.body.toString('utf-8');
    expect(csvContent.charCodeAt(0)).toBe(0xFEFF);
    expect(csvContent).toContain('Area,Item,Element,Unit,Year,Value');
  });

  // ── 21. FAOSTAT export handles unknown indicator ──
  it('should return empty rows for tables that do not exist', async () => {
    prisma.exportRecord.create.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'FAOSTAT',
      format: 'FAOSTAT_CSV',
      status: 'PENDING',
    });
    prisma.exportRecord.update.mockResolvedValue({
      ...sampleExportRow,
      connector_type: 'FAOSTAT',
      format: 'FAOSTAT_CSV',
      record_count: 0,
    });
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('relation does not exist'));

    const result = await service.exportFaostat(
      { indicatorCode: 'QCL', countryIso: ['KE'], yearRange: [2024, 2024] },
      continentalUser,
    );

    // Should succeed with 0 records (graceful fallback)
    expect(result.data.connectorType).toBe('FAOSTAT');
  });
});

describe('ConnectorService', () => {
  let service: ConnectorService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ConnectorService(prisma as any);
  });

  // ── 22. List connectors ──
  it('should list all registered connectors', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      {
        id: 'cc-1', connector_type: 'WAHIS', name: 'WAHIS',
        description: 'WOAH export', base_url: 'https://wahis.woah.org',
        auth_config: {}, is_active: true, last_health_check: null,
        last_health_status: null, config: {},
        created_at: new Date(), updated_at: new Date(),
      },
    ]);

    const result = await service.listConnectors();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].connectorType).toBe('WAHIS');
  });

  // ── 23. Health check runs against active connectors ──
  it('should run health checks and update last check time', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      { id: 'cc-1', connector_type: 'WAHIS', name: 'WAHIS', base_url: 'https://wahis.woah.org', is_active: true },
      { id: 'cc-2', connector_type: 'EMPRES', name: 'EMPRES', base_url: 'https://empres-i.fao.org', is_active: true },
    ]);
    prisma.connectorConfig.update.mockResolvedValue({});

    const result = await service.healthCheck();

    expect(result.data).toHaveLength(2);
    expect(result.data[0].status).toBe('UP');
    expect(prisma.connectorConfig.update).toHaveBeenCalledTimes(2);
  });

  // ── 24. toEntity maps snake_case to camelCase ──
  it('should map connector config row correctly', () => {
    const entity = service.toEntity({
      id: 'cc-1',
      connector_type: 'WAHIS',
      name: 'WAHIS',
      description: 'WOAH export',
      base_url: 'https://wahis.woah.org',
      auth_config: {},
      is_active: true,
      last_health_check: null,
      last_health_status: null,
      config: {},
      created_at: new Date(),
      updated_at: new Date(),
    });

    expect(entity.connectorType).toBe('WAHIS');
    expect(entity.baseUrl).toBe('https://wahis.woah.org');
    expect(entity.isActive).toBe(true);
  });
});

describe('ExportSchedulerService', () => {
  let scheduler: ExportSchedulerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let wahisService: WahisService;
  let empresService: EmpresService;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const kafka = createMockKafka();
    wahisService = new WahisService(prisma as any, kafka as any);
    empresService = new EmpresService(prisma as any, kafka as any);
    logger = createMockLogger();
    scheduler = new ExportSchedulerService(prisma as any, wahisService, empresService, logger);
  });

  // ── 25. Scheduler starts and stops ──
  it('should start and stop without errors', () => {
    scheduler.start();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Export scheduler started'));

    scheduler.stop();
    expect(logger.info).toHaveBeenCalledWith('Export scheduler stopped');
  });

  // ── 26. WAHIS auto-export queries configs ──
  it('should query connector configs for WAHIS auto-export', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([]);

    await scheduler.runWahisAutoExport();

    expect(prisma.connectorConfig.findMany).toHaveBeenCalledWith({
      where: { connector_type: 'WAHIS', is_active: true },
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('WAHIS auto-export batch finished'));
  });

  // ── 27. WAHIS auto-export runs for eligible countries ──
  it('should run WAHIS export for countries with autoExportWahis=true', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      {
        id: 'cc-1',
        connector_type: 'WAHIS',
        is_active: true,
        tenant_id: TENANT_ID,
        config: { autoExportWahis: true, countryCode: 'KEN' },
      },
    ]);
    // Mock the exportWahis to succeed
    wahisService.exportWahis = vi.fn().mockResolvedValue({ data: {} });

    await scheduler.runWahisAutoExport();

    expect(wahisService.exportWahis).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 success, 0 failed'));
  });

  // ── 28. WAHIS auto-export skips countries without autoExportWahis ──
  it('should skip countries without autoExportWahis flag', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      {
        id: 'cc-1',
        connector_type: 'WAHIS',
        is_active: true,
        tenant_id: TENANT_ID,
        config: { countryCode: 'KEN' }, // no autoExportWahis
      },
    ]);
    wahisService.exportWahis = vi.fn();

    await scheduler.runWahisAutoExport();

    expect(wahisService.exportWahis).not.toHaveBeenCalled();
  });

  // ── 29. EMPRES active alerts queries configs ──
  it('should query connector configs for EMPRES active alerts', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([]);

    await scheduler.runEmpresActiveAlerts();

    expect(prisma.connectorConfig.findMany).toHaveBeenCalledWith({
      where: { connector_type: 'EMPRES', is_active: true },
    });
  });

  // ── 30. EMPRES active alerts runs for configured countries ──
  it('should run EMPRES export for configured countries', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      {
        id: 'cc-2',
        connector_type: 'EMPRES',
        is_active: true,
        tenant_id: TENANT_ID,
        config: { countryCode: 'KEN' },
      },
    ]);
    empresService.exportEmpres = vi.fn().mockResolvedValue({ data: {} });

    await scheduler.runEmpresActiveAlerts();

    expect(empresService.exportEmpres).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 success, 0 failed'));
  });

  // ── 31. Scheduler handles export failures gracefully ──
  it('should handle export failures gracefully', async () => {
    prisma.connectorConfig.findMany.mockResolvedValue([
      {
        id: 'cc-1',
        connector_type: 'WAHIS',
        is_active: true,
        tenant_id: TENANT_ID,
        config: { autoExportWahis: true, countryCode: 'KEN' },
      },
    ]);
    wahisService.exportWahis = vi.fn().mockRejectedValue(new Error('Export failed'));

    await scheduler.runWahisAutoExport();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('0 success, 1 failed'));
  });
});
