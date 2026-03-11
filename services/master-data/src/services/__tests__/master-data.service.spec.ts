import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoService } from '../geo.service';
import { SpeciesService } from '../species.service';
import { DiseaseService } from '../disease.service';
import { AuditService } from '../audit.service';
import { ImportExportService } from '../import-export.service';
import { RefDataService } from '../ref-data.service';

// ── Shared mocks ──

function mockAudit() {
  return { log: vi.fn().mockResolvedValue(undefined), findByEntity: vi.fn().mockResolvedValue([]) };
}

function mockKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

const USER = { userId: 'u1', role: 'CONTINENTAL_ADMIN', tenantId: 't1', tenantLevel: 'CONTINENTAL' };
const MS_USER = { userId: 'u2', role: 'NATIONAL_ADMIN', tenantId: 't2', tenantLevel: 'MEMBER_STATE' };

// ── 1. GeoService ──

describe('GeoService', () => {
  let svc: GeoService;
  let prisma: any;
  let kafka: ReturnType<typeof mockKafka>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = {
      geoEntity: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    kafka = mockKafka();
    audit = mockAudit();
    svc = new GeoService(prisma as any, kafka as any, audit as any);
  });

  it('should create a geo entity with audit + Kafka', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue(null);
    const entity = { id: 'g1', code: 'KE', name: 'Kenya' };
    prisma.geoEntity.create.mockResolvedValue(entity);

    const result = await svc.create({ code: 'KE', name: 'Kenya', nameEn: 'Kenya', nameFr: 'Kenya', level: 'COUNTRY', countryCode: 'KE' }, USER);

    expect(result.data.code).toBe('KE');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entityType: 'GeoEntity' }));
    expect(kafka.send).toHaveBeenCalledOnce();
  });

  it('should throw 409 for duplicate code', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue({ id: 'g1', code: 'KE' });

    await expect(svc.create({ code: 'KE', name: 'Kenya', nameEn: 'Kenya', nameFr: 'Kenya', level: 'COUNTRY', countryCode: 'KE' }, USER))
      .rejects.toThrow('already exists');
  });

  it('should return paginated geo entities', async () => {
    prisma.geoEntity.findMany.mockResolvedValue([{ id: 'g1' }]);
    prisma.geoEntity.count.mockResolvedValue(1);

    const result = await svc.findAll({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
  });

  it('should throw 404 when entity not found', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue(null);
    await expect(svc.findOne('nonexistent')).rejects.toThrow('not found');
  });

  it('should find children of a parent', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue({ id: 'g1' });
    prisma.geoEntity.findMany.mockResolvedValue([{ id: 'c1', parentId: 'g1' }]);
    prisma.geoEntity.count.mockResolvedValue(1);

    const result = await svc.findChildren('g1', { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('should not fail when Kafka publishing fails', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue(null);
    prisma.geoEntity.create.mockResolvedValue({ id: 'g1', code: 'KE' });
    kafka.send.mockRejectedValue(new Error('Kafka down'));

    const result = await svc.create({ code: 'KE', name: 'Kenya', nameEn: 'Kenya', nameFr: 'Kenya', level: 'COUNTRY', countryCode: 'KE' }, USER);
    expect(result.data.code).toBe('KE');
  });
});

// ── 2. SpeciesService ──

describe('SpeciesService', () => {
  let svc: SpeciesService;
  let prisma: any;
  let kafka: ReturnType<typeof mockKafka>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = {
      species: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    kafka = mockKafka();
    audit = mockAudit();
    svc = new SpeciesService(prisma as any, kafka as any, audit as any);
  });

  it('should create a species with audit + Kafka', async () => {
    prisma.species.findUnique.mockResolvedValue(null);
    const entity = { id: 's1', code: 'BOS-TAU', commonNameEn: 'Cattle' };
    prisma.species.create.mockResolvedValue(entity);

    const result = await svc.create({ code: 'BOS-TAU', scientificName: 'Bos taurus', commonNameEn: 'Cattle', commonNameFr: 'Bovin', category: 'DOMESTIC' }, USER);

    expect(result.data.code).toBe('BOS-TAU');
    expect(audit.log).toHaveBeenCalledOnce();
    expect(kafka.send).toHaveBeenCalledOnce();
  });

  it('should throw 409 for duplicate code', async () => {
    prisma.species.findUnique.mockResolvedValue({ id: 's1', code: 'BOS-TAU' });

    await expect(svc.create({ code: 'BOS-TAU', scientificName: 'Bos taurus', commonNameEn: 'Cattle', commonNameFr: 'Bovin', category: 'DOMESTIC' }, USER))
      .rejects.toThrow('already exists');
  });

  it('should return paginated and filtered species', async () => {
    prisma.species.findMany.mockResolvedValue([{ id: 's1' }]);
    prisma.species.count.mockResolvedValue(1);

    const result = await svc.findAll({ category: 'DOMESTIC', page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.limit).toBe(10);
  });
});

// ── 3. DiseaseService ──

describe('DiseaseService', () => {
  let svc: DiseaseService;
  let prisma: any;
  let kafka: ReturnType<typeof mockKafka>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = {
      disease: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    kafka = mockKafka();
    audit = mockAudit();
    svc = new DiseaseService(prisma as any, kafka as any, audit as any);
  });

  it('should create a disease with audit + Kafka', async () => {
    prisma.disease.findUnique.mockResolvedValue(null);
    const entity = { id: 'd1', code: 'FMD', nameEn: 'Foot-and-mouth disease' };
    prisma.disease.create.mockResolvedValue(entity);

    const result = await svc.create({ code: 'FMD', nameEn: 'Foot-and-mouth disease', nameFr: 'Fièvre aphteuse', isWoahListed: true }, USER);

    expect(result.data.code).toBe('FMD');
    expect(kafka.send).toHaveBeenCalledOnce();
  });

  it('should update a disease and increment version', async () => {
    prisma.disease.findUnique.mockResolvedValue({ id: 'd1', code: 'FMD' });
    prisma.disease.update.mockResolvedValue({ id: 'd1', code: 'FMD', nameEn: 'FMD Updated', version: 2 });

    const result = await svc.update('d1', { nameEn: 'FMD Updated' }, USER);
    expect(result.data.nameEn).toBe('FMD Updated');
    expect(prisma.disease.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: { increment: 1 } }),
    }));
  });
});

// ── 4. AuditService ──

describe('AuditService', () => {
  let svc: AuditService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      masterDataAudit: {
        create: vi.fn().mockResolvedValue({ id: 'a1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    svc = new AuditService(prisma as any);
  });

  it('should log an audit entry', async () => {
    await svc.log({
      entityType: 'GeoEntity', entityId: 'g1', action: 'CREATE',
      user: { userId: 'u1', role: 'CONTINENTAL_ADMIN', tenantId: 't1' },
      dataClassification: 'PUBLIC',
    });

    expect(prisma.masterDataAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityType: 'GeoEntity', action: 'CREATE' }),
    });
  });

  it('should not throw if audit logging fails', async () => {
    prisma.masterDataAudit.create.mockRejectedValue(new Error('DB down'));

    await expect(svc.log({
      entityType: 'GeoEntity', entityId: 'g1', action: 'CREATE',
      user: { userId: 'u1', role: 'CONTINENTAL_ADMIN', tenantId: 't1' },
    })).resolves.toBeUndefined();
  });

  it('should find audit entries by entity', async () => {
    prisma.masterDataAudit.findMany.mockResolvedValue([{ id: 'a1' }]);
    const result = await svc.findByEntity('GeoEntity', 'g1');
    expect(result).toHaveLength(1);
  });
});

// ── 5. RefDataService ──

describe('RefDataService', () => {
  let svc: RefDataService;
  let prisma: any;
  let kafka: ReturnType<typeof mockKafka>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = {
      refSpecies: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refDisease: {
        count: vi.fn().mockResolvedValue(0),
      },
      refSpeciesGroup: { count: vi.fn().mockResolvedValue(0) },
      refAgeGroup: { count: vi.fn().mockResolvedValue(0) },
      refDiseaseSpecies: { count: vi.fn().mockResolvedValue(0) },
      refClinicalSign: { count: vi.fn().mockResolvedValue(0) },
      refControlMeasure: { count: vi.fn().mockResolvedValue(0) },
      refSeizureReason: { count: vi.fn().mockResolvedValue(0) },
      refSampleType: { count: vi.fn().mockResolvedValue(0) },
      refContaminationSource: { count: vi.fn().mockResolvedValue(0) },
      refAbattoir: { count: vi.fn().mockResolvedValue(0) },
      refMarket: { count: vi.fn().mockResolvedValue(0) },
      refCheckpoint: { count: vi.fn().mockResolvedValue(0) },
      refProductionSystem: { count: vi.fn().mockResolvedValue(0) },
      refBreed: { count: vi.fn().mockResolvedValue(0) },
      refVaccineType: { count: vi.fn().mockResolvedValue(0) },
      refTestType: { count: vi.fn().mockResolvedValue(0) },
      refLab: { count: vi.fn().mockResolvedValue(0) },
      refLivestockProduct: { count: vi.fn().mockResolvedValue(0) },
      refCensusMethodology: { count: vi.fn().mockResolvedValue(0) },
      refGearType: { count: vi.fn().mockResolvedValue(0) },
      refVesselType: { count: vi.fn().mockResolvedValue(0) },
      refAquacultureFarmType: { count: vi.fn().mockResolvedValue(0) },
      refLandingSite: { count: vi.fn().mockResolvedValue(0) },
      refConservationStatus: { count: vi.fn().mockResolvedValue(0) },
      refHabitatType: { count: vi.fn().mockResolvedValue(0) },
      refCrimeType: { count: vi.fn().mockResolvedValue(0) },
      refCommodity: { count: vi.fn().mockResolvedValue(0) },
      refHiveType: { count: vi.fn().mockResolvedValue(0) },
      refBeeDisease: { count: vi.fn().mockResolvedValue(0) },
      refFloralSource: { count: vi.fn().mockResolvedValue(0) },
      refLegalFrameworkType: { count: vi.fn().mockResolvedValue(0) },
      refStakeholderType: { count: vi.fn().mockResolvedValue(0) },
      tenant: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    };
    kafka = mockKafka();
    audit = mockAudit();
    svc = new RefDataService(prisma as any, kafka as any, audit as any);
  });

  it('should throw 400 for unknown ref-data type', async () => {
    await expect(svc.findAll('nonexistent', {}, USER)).rejects.toThrow('Unknown reference data type');
  });

  it('should return paginated ref-data list', async () => {
    prisma.refSpecies.findMany.mockResolvedValue([{ id: 'r1', code: 'BOV' }]);
    prisma.refSpecies.count.mockResolvedValue(1);

    const result = await svc.findAll('species', {}, USER);
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('should return ref-data counts for dashboard', async () => {
    prisma.refSpecies.count.mockResolvedValue(42);

    const result = await svc.getCounts(USER);
    expect(result.data['species']).toBe(42);
  });

  it('should create ref-data with scope inferred from user role', async () => {
    prisma.refSpecies.create.mockResolvedValue({ id: 'r1', code: 'NEW', scope: 'continental' });

    const result = await svc.create('species', { code: 'NEW', name: { en: 'New Species' } }, USER);
    expect(result.data.scope).toBe('continental');
    expect(audit.log).toHaveBeenCalledOnce();
  });

  it('should check write access: MS user cannot modify continental data', async () => {
    prisma.refSpecies.findUnique.mockResolvedValue({ id: 'r1', scope: 'continental', ownerId: null });

    await expect(svc.update('species', 'r1', { name: { en: 'X' } }, MS_USER))
      .rejects.toThrow('Only SUPER_ADMIN or CONTINENTAL_ADMIN');
  });
});

// ── 6. ImportExportService ──

describe('ImportExportService', () => {
  let svc: ImportExportService;
  let prisma: any;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(() => {
    prisma = {
      geoEntity: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      species: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      disease: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      unit: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      identifier: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      denominator: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    };
    audit = mockAudit();
    svc = new ImportExportService(prisma as any, audit as any);
  });

  it('should import CSV and return report with created count', async () => {
    prisma.geoEntity.findUnique.mockResolvedValue(null);
    prisma.geoEntity.create.mockResolvedValue({ id: 'g1', code: 'KE' });

    const csv = 'code,name,name_en,name_fr,level,country_code\nKE,Kenya,Kenya,Kenya,COUNTRY,KE';
    const result = await svc.importCsv({ type: 'geo_entities', csvContent: csv }, USER);

    expect(result.data.totalRows).toBe(1);
    expect(result.data.created).toBe(1);
  });

  it('should export species as CSV', async () => {
    prisma.species.findMany.mockResolvedValue([
      { code: 'BOV', scientificName: 'Bos taurus', commonNameEn: 'Cattle', commonNameFr: 'Bovin', category: 'DOMESTIC', productionCategories: ['meat', 'dairy'], isWoahListed: true, version: 1 },
    ]);

    const csv = await svc.exportCsv('species');
    expect(csv).toContain('code');
    expect(csv).toContain('BOV');
    expect(csv).toContain('Bos taurus');
  });

  it('should throw 400 for unknown export type', async () => {
    await expect(svc.exportCsv('unknown')).rejects.toThrow('Unknown referential type');
  });
});
