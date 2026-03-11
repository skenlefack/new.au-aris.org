import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractService } from '../contract.service';
import { ComplianceService } from '../compliance.service';

// ── Mocks ──

function createMockPrisma() {
  return {
    dataContract: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    complianceRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function createMockKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
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

const sampleContractRow = {
  id: 'contract-1',
  tenant_id: TENANT_ID,
  name: 'Health Outbreak',
  domain: 'health',
  data_owner: 'CVO Kenya',
  data_steward: 'Data Steward',
  purpose: 'Track outbreaks',
  officiality_level: 'OFFICIAL',
  schema: { type: 'object' },
  frequency: 'MONTHLY',
  timeliness_sla: 72,
  quality_sla: { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.9 },
  classification: 'RESTRICTED',
  exchange_mechanism: 'KAFKA',
  version: 1,
  status: 'ACTIVE',
  valid_from: new Date('2026-01-01'),
  valid_to: null,
  approved_by: 'approver-1',
  created_by: USER_ID,
  updated_by: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ContractService', () => {
  let service: ContractService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new ContractService(prisma as any, kafka as any);
  });

  // ── 1. Create contract ──
  it('should create a contract and publish Kafka event', async () => {
    prisma.dataContract.findFirst.mockResolvedValue(null);
    prisma.dataContract.create.mockResolvedValue(sampleContractRow);

    const result = await service.create(
      {
        name: 'Health Outbreak',
        domain: 'health',
        dataOwner: 'CVO Kenya',
        dataSteward: 'Data Steward',
        purpose: 'Track outbreaks',
        officialityLevel: 'OFFICIAL',
        schema: { type: 'object' },
        frequency: 'MONTHLY',
        timelinessSla: 72,
        qualitySla: { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.9 },
        classification: 'RESTRICTED',
        exchangeMechanism: 'KAFKA',
        validFrom: '2026-01-01',
        approvedBy: 'approver-1',
      },
      continentalUser,
    );

    expect(result.data.name).toBe('Health Outbreak');
    expect(result.data.version).toBe(1);
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 2. Duplicate contract 409 ──
  it('should throw 409 for duplicate contract name + tenant + version', async () => {
    prisma.dataContract.findFirst.mockResolvedValue(sampleContractRow);

    await expect(
      service.create(
        {
          name: 'Health Outbreak',
          domain: 'health',
          dataOwner: 'CVO',
          dataSteward: 'DS',
          purpose: 'Test',
          officialityLevel: 'OFFICIAL',
          schema: {},
          frequency: 'MONTHLY',
          timelinessSla: 72,
          qualitySla: { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.9 },
          classification: 'RESTRICTED',
          exchangeMechanism: 'KAFKA',
          validFrom: '2026-01-01',
          approvedBy: 'approver-1',
        },
        continentalUser,
      ),
    ).rejects.toThrow('already exists');
  });

  // ── 3. findAll with pagination ──
  it('should return paginated contracts', async () => {
    prisma.dataContract.findMany.mockResolvedValue([sampleContractRow]);
    prisma.dataContract.count.mockResolvedValue(1);

    const result = await service.findAll(continentalUser, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].name).toBe('Health Outbreak');
  });

  // ── 4. findOne ──
  it('should return contract by ID', async () => {
    prisma.dataContract.findUnique.mockResolvedValue(sampleContractRow);

    const result = await service.findOne('contract-1', continentalUser);

    expect(result.data.id).toBe('contract-1');
    expect(result.data.domain).toBe('health');
  });

  // ── 5. findOne 404 ──
  it('should throw 404 when contract not found', async () => {
    prisma.dataContract.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent', continentalUser)).rejects.toThrow('not found');
  });

  // ── 6. Tenant access denied ──
  it('should throw 404 when national user accesses other tenant contract', async () => {
    prisma.dataContract.findUnique.mockResolvedValue({
      ...sampleContractRow,
      tenant_id: 'other-tenant',
    });

    await expect(service.findOne('contract-1', nationalUser)).rejects.toThrow('not found');
  });

  // ── 7. Update with immutable versioning ──
  it('should archive old version and create new version on update', async () => {
    prisma.dataContract.findUnique.mockResolvedValue(sampleContractRow);
    prisma.dataContract.findFirst.mockResolvedValue(sampleContractRow);
    const newRow = { ...sampleContractRow, id: 'contract-2', version: 2 };
    prisma.$transaction.mockResolvedValue([{}, newRow]);

    const result = await service.update(
      'contract-1',
      { name: 'Health Outbreak v2' },
      continentalUser,
    );

    expect(result.data.version).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 8. Cannot update archived contract ──
  it('should throw 400 when updating an archived contract', async () => {
    prisma.dataContract.findUnique.mockResolvedValue({
      ...sampleContractRow,
      status: 'ARCHIVED',
    });

    await expect(
      service.update('contract-1', { name: 'New Name' }, continentalUser),
    ).rejects.toThrow('archived');
  });

  // ── 9. toEntity maps snake_case to camelCase ──
  it('should map snake_case DB row to camelCase entity', () => {
    const entity = service.toEntity(sampleContractRow);

    expect(entity.tenantId).toBe(TENANT_ID);
    expect(entity.dataOwner).toBe('CVO Kenya');
    expect(entity.officialityLevel).toBe('OFFICIAL');
    expect(entity.timelinessSla).toBe(72);
  });
});

describe('ComplianceService', () => {
  let service: ComplianceService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new ComplianceService(prisma as any, kafka as any);
  });

  // ── 10. calculateMetrics pure function ──
  it('should calculate compliance metrics correctly', () => {
    const records = [
      { timeliness_hours: 10, sla_met: true, quality_passed: true, submission_time: new Date() },
      { timeliness_hours: 80, sla_met: false, quality_passed: true, submission_time: new Date() },
      { timeliness_hours: 20, sla_met: true, quality_passed: false, submission_time: new Date() },
    ];

    const metrics = service.calculateMetrics(
      'c-1', 'Test Contract', 72,
      { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.8 },
      records,
      new Date('2026-01-01'), new Date('2026-01-31'),
    );

    expect(metrics.totalSubmissions).toBe(3);
    expect(metrics.onTimeSubmissions).toBe(2);
    expect(metrics.lateSubmissions).toBe(1);
    expect(metrics.qualityPassCount).toBe(2);
    expect(metrics.qualityFailCount).toBe(1);
  });

  // ── 11. SLA met when rates above threshold ──
  it('should flag SLA as met when timeliness >= 90% and quality >= minPassRate', () => {
    const records = Array.from({ length: 10 }, () => ({
      timeliness_hours: 10, sla_met: true, quality_passed: true, submission_time: new Date(),
    }));

    const metrics = service.calculateMetrics(
      'c-1', 'Test', 72,
      { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.8 },
      records,
      new Date('2026-01-01'), new Date('2026-01-31'),
    );

    expect(metrics.slaMet).toBe(true);
  });

  // ── 12. SLA not met when timeliness < 90% ──
  it('should flag SLA as not met when too many late submissions', () => {
    const records = [
      { timeliness_hours: 80, sla_met: false, quality_passed: true, submission_time: new Date() },
      { timeliness_hours: 80, sla_met: false, quality_passed: true, submission_time: new Date() },
      { timeliness_hours: 10, sla_met: true, quality_passed: true, submission_time: new Date() },
    ];

    const metrics = service.calculateMetrics(
      'c-1', 'Test', 72,
      { correctionDeadline: 48, escalationDeadline: 168, minPassRate: 0.8 },
      records,
      new Date('2026-01-01'), new Date('2026-01-31'),
    );

    expect(metrics.slaMet).toBe(false);
  });

  // ── 13. recordSubmission creates compliance record ──
  it('should create compliance record on submission', async () => {
    prisma.dataContract.findUnique.mockResolvedValue({ id: 'c-1', timeliness_sla: 72 });
    prisma.complianceRecord.create.mockResolvedValue({ id: 'cr-1' });

    await service.recordSubmission({
      contractId: 'c-1',
      tenantId: TENANT_ID,
      recordId: 'rec-1',
      eventType: 'form.submitted',
      eventTimestamp: new Date('2026-01-15T10:00:00Z'),
      submissionTime: new Date('2026-01-15T12:00:00Z'),
    });

    expect(prisma.complianceRecord.create).toHaveBeenCalledTimes(1);
    const data = prisma.complianceRecord.create.mock.calls[0][0].data;
    expect(data.sla_met).toBe(true); // 2 hours < 72 hours
  });

  // ── 14. recordQualityResult updates existing record ──
  it('should update existing compliance record with quality result', async () => {
    prisma.complianceRecord.findFirst.mockResolvedValue({ id: 'cr-1' });

    await service.recordQualityResult({
      contractId: 'c-1',
      tenantId: TENANT_ID,
      recordId: 'rec-1',
      passed: true,
      qualityReportId: 'qr-1',
    });

    expect(prisma.complianceRecord.update).toHaveBeenCalledTimes(1);
    expect(prisma.complianceRecord.create).not.toHaveBeenCalled();
  });

  // ── 15. recordQualityResult creates standalone if no existing record ──
  it('should create standalone quality record if no existing compliance record', async () => {
    prisma.complianceRecord.findFirst.mockResolvedValue(null);

    await service.recordQualityResult({
      contractId: 'c-1',
      tenantId: TENANT_ID,
      recordId: 'rec-1',
      passed: false,
      qualityReportId: 'qr-1',
    });

    expect(prisma.complianceRecord.create).toHaveBeenCalledTimes(1);
    expect(prisma.complianceRecord.update).not.toHaveBeenCalled();
  });

  // ── 16. getCompliance 404 when contract not found ──
  it('should throw 404 when contract not found for compliance', async () => {
    prisma.dataContract.findUnique.mockResolvedValue(null);

    await expect(
      service.getCompliance('nonexistent', continentalUser),
    ).rejects.toThrow('not found');
  });
});
