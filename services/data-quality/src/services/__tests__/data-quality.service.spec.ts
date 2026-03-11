import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidateService } from '../validate.service';
import { EngineService } from '../engine.service';
import { RuleService } from '../rule.service';
import { ReportService } from '../report.service';
import { DashboardService } from '../dashboard.service';
import { CorrectionService } from '../correction.service';

// ── Mocks ──

function createMockPrisma() {
  return {
    qualityReport: {
      create: vi.fn().mockResolvedValue({ id: 'rpt-1', overallStatus: 'PASSED' }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _avg: { totalDurationMs: 50 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    customQualityRule: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    correctionTracker: {
      create: vi.fn().mockResolvedValue({ id: 'ct-1' }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    qualityViolation: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    geoEntity: { findMany: vi.fn().mockResolvedValue([{ code: 'KE' }]) },
    species: { findMany: vi.fn().mockResolvedValue([{ code: 'CATTLE' }]) },
    disease: { findMany: vi.fn().mockResolvedValue([{ code: 'FMD' }]) },
    unit: { findMany: vi.fn().mockResolvedValue([{ code: 'HEAD' }]) },
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

// ── Mock QualityEngine ──
vi.mock('@aris/quality-rules', () => ({
  QualityEngine: class {
    check() {
      return {
        overallResult: 'PASS',
        totalDurationMs: 42,
        checkedAt: new Date().toISOString(),
        gates: [{ gate: 'completeness', result: 'PASS', durationMs: 10 }],
        violations: [],
      };
    }
  },
}));

describe('EngineService', () => {
  let engine: EngineService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new EngineService(prisma as any);
  });

  // ── 1. Code sets are loaded on first check ──
  it('should load code sets from master data on first check', async () => {
    await engine.check({}, 'outbreak', {});

    expect(prisma.geoEntity.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.species.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.disease.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.unit.findMany).toHaveBeenCalledTimes(1);
  });

  // ── 2. Cache prevents repeated loads ──
  it('should use cached code sets on subsequent calls', async () => {
    await engine.check({}, 'outbreak', {});
    await engine.check({}, 'outbreak', {});

    // Only loaded once (within 5-min cache window)
    expect(prisma.geoEntity.findMany).toHaveBeenCalledTimes(1);
  });

  // ── 3. invalidateCache forces reload ──
  it('should force reload after invalidateCache()', async () => {
    await engine.check({}, 'outbreak', {});
    engine.invalidateCache();
    await engine.check({}, 'outbreak', {});

    expect(prisma.geoEntity.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('ValidateService', () => {
  let service: ValidateService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;
  let engine: EngineService;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    engine = new EngineService(prisma as any);
    service = new ValidateService(prisma as any, engine, kafka as any);
  });

  // ── 4. Validate persists report and publishes event ──
  it('should persist report and publish Kafka event on validate', async () => {
    const result = await service.validate(
      { recordId: 'rec-1', entityType: 'outbreak', domain: 'health', record: { status: 'confirmed' } },
      continentalUser,
    );

    expect(result.data).toBeDefined();
    expect(prisma.qualityReport.create).toHaveBeenCalledTimes(1);
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 5. Custom rules are merged from DB ──
  it('should merge custom rules from database into gate config', async () => {
    prisma.customQualityRule.findMany.mockResolvedValue([
      { config: { requiredFields: ['extra_field'] } },
    ]);

    const config = await service.buildGateConfig(
      { recordId: 'r1', entityType: 'outbreak', domain: 'health', record: {}, requiredFields: ['status'] },
      TENANT_ID,
    );

    expect(config.requiredFields).toContain('status');
    expect(config.requiredFields).toContain('extra_field');
  });
});

describe('RuleService', () => {
  let service: RuleService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new RuleService(prisma as any);
  });

  // ── 6. Create custom rule ──
  it('should create a custom quality rule', async () => {
    const ruleData = { id: 'rule-1', name: 'Test Rule', domain: 'health' };
    prisma.customQualityRule.create.mockResolvedValue(ruleData);

    const result = await service.create(
      { domain: 'health', entityType: 'outbreak', name: 'Test Rule', gate: 'completeness', config: { requiredFields: ['status'] } },
      continentalUser,
    );

    expect(result.data.name).toBe('Test Rule');
    expect(prisma.customQualityRule.create).toHaveBeenCalledTimes(1);
  });

  // ── 7. findAll with tenant isolation ──
  it('should filter rules by tenant for non-continental users', async () => {
    prisma.customQualityRule.findMany.mockResolvedValue([]);
    prisma.customQualityRule.count.mockResolvedValue(0);

    await service.findAll(nationalUser, {});

    const call = prisma.customQualityRule.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe(TENANT_ID);
  });

  // ── 8. Continental sees all rules ──
  it('should not filter tenant for continental users', async () => {
    prisma.customQualityRule.findMany.mockResolvedValue([]);
    prisma.customQualityRule.count.mockResolvedValue(0);

    await service.findAll(continentalUser, {});

    const call = prisma.customQualityRule.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBeUndefined();
  });

  // ── 9. findOne 404 ──
  it('should throw 404 when rule not found', async () => {
    prisma.customQualityRule.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent')).rejects.toThrow('not found');
  });

  // ── 10. Update rule ──
  it('should update a quality rule', async () => {
    prisma.customQualityRule.findUnique.mockResolvedValue({ id: 'rule-1', name: 'Old' });
    prisma.customQualityRule.update.mockResolvedValue({ id: 'rule-1', name: 'Updated' });

    const result = await service.update('rule-1', { name: 'Updated' });

    expect(result.data.name).toBe('Updated');
  });
});

describe('ReportService', () => {
  let service: ReportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReportService(prisma as any);
  });

  // ── 11. findAll with pagination ──
  it('should return paginated reports', async () => {
    prisma.qualityReport.findMany.mockResolvedValue([{ id: 'rpt-1' }]);
    prisma.qualityReport.count.mockResolvedValue(1);

    const result = await service.findAll(continentalUser, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  // ── 12. findOne 404 ──
  it('should throw 404 when report not found', async () => {
    prisma.qualityReport.findUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent', continentalUser)).rejects.toThrow('not found');
  });

  // ── 13. Tenant isolation on findOne ──
  it('should enforce tenant isolation on findOne for non-continental users', async () => {
    prisma.qualityReport.findUnique.mockResolvedValue({ id: 'rpt-1', tenantId: 'other-tenant' });

    await expect(service.findOne('rpt-1', nationalUser)).rejects.toThrow('not found');
  });
});

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DashboardService(prisma as any);
  });

  // ── 14. Returns dashboard KPIs ──
  it('should compute dashboard KPIs', async () => {
    prisma.qualityReport.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(80)   // passed
      .mockResolvedValueOnce(15)   // failed
      .mockResolvedValueOnce(5);   // warning

    const result = await service.getKpis(continentalUser, {});

    expect(result.data.totalReports).toBe(100);
    expect(result.data.passRate).toBeGreaterThan(0);
  });
});

describe('CorrectionService', () => {
  let service: CorrectionService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    kafka = createMockKafka();
    service = new CorrectionService(prisma as any, kafka as any);
  });

  // ── 15. Escalate overdue PENDING corrections ──
  it('should escalate PENDING corrections past deadline', async () => {
    const overdue = [
      {
        id: 'ct-1',
        status: 'PENDING',
        correctionDeadline: new Date(Date.now() - 3600000),
        escalationDeadline: new Date(Date.now() + 86400000),
        report: { id: 'rpt-1', recordId: 'rec-1', domain: 'health', entityType: 'outbreak', tenantId: TENANT_ID, submittedBy: USER_ID },
      },
    ];
    prisma.correctionTracker.findMany
      .mockResolvedValueOnce(overdue)   // overdue for escalation
      .mockResolvedValueOnce([]);        // overdue for expiry

    prisma.correctionTracker.update.mockResolvedValue({});

    await service.handleOverdueCorrections();

    expect(prisma.correctionTracker.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.correctionTracker.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('ESCALATED');
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 16. markCorrected ──
  it('should mark correction as CORRECTED', async () => {
    prisma.correctionTracker.findUnique.mockResolvedValue({ id: 'ct-1', status: 'PENDING', reportId: 'rpt-1' });
    prisma.correctionTracker.update.mockResolvedValue({ id: 'ct-1', status: 'CORRECTED' });

    const result = await service.markCorrected('rpt-1');

    expect(result.data.status).toBe('CORRECTED');
  });

  // ── 17. markCorrected 404 ──
  it('should throw 404 when correction tracker not found', async () => {
    prisma.correctionTracker.findUnique.mockResolvedValue(null);

    await expect(service.markCorrected('nonexistent')).rejects.toThrow('not found');
  });

  // ── 18. Assign correction ──
  it('should assign correction to a user', async () => {
    prisma.correctionTracker.findUnique.mockResolvedValue({ id: 'ct-1', reportId: 'rpt-1' });
    prisma.correctionTracker.update.mockResolvedValue({ id: 'ct-1', assignedTo: 'steward-1' });

    const result = await service.assign('rpt-1', 'steward-1');

    expect(result.data.assignedTo).toBe('steward-1');
  });

  // ── 19. findAll with tenant isolation ──
  it('should filter corrections by tenant for non-continental users', async () => {
    prisma.correctionTracker.findMany.mockResolvedValue([]);
    prisma.correctionTracker.count.mockResolvedValue(0);

    await service.findAll(nationalUser, {});

    const call = prisma.correctionTracker.findMany.mock.calls[0][0];
    expect(call.where.report).toEqual({ tenantId: TENANT_ID });
  });

  // ── 20. Expire escalated corrections past deadline ──
  it('should expire ESCALATED corrections past escalation deadline', async () => {
    prisma.correctionTracker.findMany
      .mockResolvedValueOnce([])  // no PENDING overdue
      .mockResolvedValueOnce([    // ESCALATED past deadline
        { id: 'ct-2', status: 'ESCALATED', escalationDeadline: new Date(Date.now() - 3600000) },
      ]);
    prisma.correctionTracker.update.mockResolvedValue({});

    await service.handleOverdueCorrections();

    const updateCall = prisma.correctionTracker.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('EXPIRED');
  });
});
