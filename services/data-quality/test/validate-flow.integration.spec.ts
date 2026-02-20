/**
 * Integration test: Full validation flow
 *
 * Tests the complete data quality pipeline:
 *   POST /validate → engine runs 8 gates → persist report → correction tracker → Kafka event
 *
 * Uses Testcontainers (PostgreSQL) for a real database.
 * Kafka is mocked (best-effort publish, not critical path).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaProducerService } from '@aris/kafka-client';
import { QualityGateResult, TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../src/prisma.service';
import { EngineService } from '../src/engine/engine.service';
import { ValidateService } from '../src/validate/validate.service';
import { ReportService } from '../src/report/report.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { RuleService } from '../src/rule/rule.service';
import { CorrectionService } from '../src/correction/correction.service';

/**
 * NOTE: This test uses a mock PrismaService with in-memory storage
 * to simulate the full flow without requiring Testcontainers.
 * For a full Testcontainers setup, replace the mock with a real
 * PrismaClient connected to a PostgreSQL container.
 */

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'steward@ke.gov',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

// In-memory stores
let reports: any[] = [];
let gateResults: any[] = [];
let violations: any[] = [];
let correctionTrackers: any[] = [];
let customRules: any[] = [];
let idCounter = 0;

function uuid(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
}

function createMockPrisma() {
  return {
    // Master Data (for EngineService code loading)
    geoEntity: {
      findMany: vi.fn().mockResolvedValue([
        { code: 'KE' }, { code: 'ET' }, { code: 'NG' },
      ]),
    },
    species: {
      findMany: vi.fn().mockResolvedValue([
        { code: 'BOV' }, { code: 'OVI' }, { code: 'CAP' },
      ]),
    },
    disease: {
      findMany: vi.fn().mockResolvedValue([
        { code: 'FMD' }, { code: 'PPR' }, { code: 'CBPP' },
      ]),
    },
    unit: {
      findMany: vi.fn().mockResolvedValue([
        { code: 'HEAD' }, { code: 'KG' }, { code: 'DOSE' },
      ]),
    },

    // Quality Reports
    qualityReport: {
      create: vi.fn().mockImplementation(({ data, include }) => {
        const report = {
          id: uuid(),
          ...data,
          createdAt: new Date(),
          gateResults: data.gateResults?.create?.map((gr: any) => ({
            id: uuid(),
            reportId: '',
            ...gr,
            createdAt: new Date(),
          })) ?? [],
          violations: data.violations?.create?.map((v: any) => ({
            id: uuid(),
            reportId: '',
            ...v,
          })) ?? [],
        };
        report.gateResults.forEach((gr: any) => { gr.reportId = report.id; });
        report.violations.forEach((v: any) => { v.reportId = report.id; });

        reports.push(report);
        gateResults.push(...report.gateResults);
        violations.push(...report.violations);
        return Promise.resolve(report);
      }),
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...reports];
        if (where?.tenantId) result = result.filter((r) => r.tenantId === where.tenantId);
        if (where?.domain) result = result.filter((r) => r.domain === where.domain);
        if (where?.overallStatus) result = result.filter((r) => r.overallStatus === where.overallStatus);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(reports.find((r) => r.id === where.id) ?? null);
      }),
      count: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...reports];
        if (where?.tenantId) result = result.filter((r) => r.tenantId === where.tenantId);
        if (where?.domain) result = result.filter((r) => r.domain === where.domain);
        if (where?.overallStatus) result = result.filter((r) => r.overallStatus === where.overallStatus);
        return Promise.resolve(result.length);
      }),
      aggregate: vi.fn().mockImplementation(() => {
        const avg = reports.length > 0
          ? reports.reduce((sum, r) => sum + r.totalDurationMs, 0) / reports.length
          : null;
        return Promise.resolve({ _avg: { totalDurationMs: avg } });
      }),
      groupBy: vi.fn().mockImplementation(() => {
        const domains = new Map<string, number>();
        for (const r of reports) {
          domains.set(r.domain, (domains.get(r.domain) ?? 0) + 1);
        }
        return Promise.resolve(
          Array.from(domains.entries()).map(([domain, count]) => ({
            domain,
            _count: { id: count },
          })),
        );
      }),
    },

    // Correction Trackers
    correctionTracker: {
      create: vi.fn().mockImplementation(({ data }) => {
        const tracker = {
          id: uuid(),
          ...data,
          status: 'PENDING',
          correctedAt: null,
          escalatedAt: null,
          notifiedAt: null,
          assignedTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        correctionTrackers.push(tracker);
        return Promise.resolve(tracker);
      }),
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...correctionTrackers];
        if (where?.status) result = result.filter((t) => t.status === where.status);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.reportId) {
          return Promise.resolve(correctionTrackers.find((t) => t.reportId === where.reportId) ?? null);
        }
        return Promise.resolve(correctionTrackers.find((t) => t.id === where.id) ?? null);
      }),
      count: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...correctionTrackers];
        if (where?.status) result = result.filter((t) => t.status === where.status);
        return Promise.resolve(result.length);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const tracker = correctionTrackers.find((t) => t.id === where.id);
        if (tracker) Object.assign(tracker, data, { updatedAt: new Date() });
        return Promise.resolve(tracker);
      }),
    },

    // Custom Quality Rules
    customQualityRule: {
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let result = [...customRules];
        if (where?.domain) result = result.filter((r) => r.domain === where.domain);
        if (where?.isActive !== undefined) result = result.filter((r) => r.isActive === where.isActive);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(customRules.find((r) => r.id === where.id) ?? null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const rule = { id: uuid(), ...data, createdAt: new Date(), updatedAt: new Date() };
        customRules.push(rule);
        return Promise.resolve(rule);
      }),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },

    // Violation groupBy for dashboard
    qualityViolation: {
      groupBy: vi.fn().mockImplementation(() => {
        const map = new Map<string, { fail: number; warning: number }>();
        for (const v of violations) {
          const existing = map.get(v.gate) ?? { fail: 0, warning: 0 };
          if (v.severity === 'FAIL') existing.fail++;
          if (v.severity === 'WARNING') existing.warning++;
          map.set(v.gate, existing);
        }
        const result: any[] = [];
        for (const [gate, counts] of map.entries()) {
          if (counts.fail > 0) result.push({ gate, severity: 'FAIL', _count: { id: counts.fail } });
          if (counts.warning > 0) result.push({ gate, severity: 'WARNING', _count: { id: counts.warning } });
        }
        return Promise.resolve(result);
      }),
    },

    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

describe('Data Quality — Full Validate Flow (Integration)', () => {
  let validateService: ValidateService;
  let reportService: ReportService;
  let dashboardService: DashboardService;
  let ruleService: RuleService;
  let correctionService: CorrectionService;
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeAll(async () => {
    // Reset stores
    reports = [];
    gateResults = [];
    violations = [];
    correctionTrackers = [];
    customRules = [];
    idCounter = 0;

    prisma = createMockPrisma();
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: KafkaProducerService, useValue: kafkaProducer },
        EngineService,
        ValidateService,
        ReportService,
        DashboardService,
        RuleService,
        CorrectionService,
      ],
    }).compile();

    validateService = module.get(ValidateService);
    reportService = module.get(ReportService);
    dashboardService = module.get(DashboardService);
    ruleService = module.get(RuleService);
    correctionService = module.get(CorrectionService);
  });

  it('Step 1: validate a PASSING record → report PASSED, no correction tracker', async () => {
    const dto = {
      recordId: 'outbreak-001',
      entityType: 'Outbreak',
      domain: 'health',
      record: {
        speciesCode: 'BOV',
        countryCode: 'KE',
        reportDate: '2024-06-01',
        confirmedDate: '2024-06-05',
        sourceSystem: 'ARIS',
        responsibleUnit: 'VetService',
        validationStatus: 'pending',
        confidenceLevel: 'confirmed',
        labConfirmed: true,
      },
      requiredFields: ['speciesCode', 'countryCode', 'reportDate'],
      temporalPairs: [['reportDate', 'confirmedDate']] as [string, string][],
      auditFields: ['sourceSystem', 'responsibleUnit', 'validationStatus'],
      confidenceLevelField: 'confidenceLevel',
      confidenceEvidenceFields: ['labConfirmed'],
    };

    const result = await validateService.validate(dto as any, mockUser);

    expect(result.data).toBeDefined();
    expect(result.data.overallStatus).toBe('PASSED');
    expect(result.data.gateResults).toBeDefined();
    expect(result.data.gateResults!.length).toBe(8);

    // No correction tracker for passing records
    expect(correctionTrackers).toHaveLength(0);

    // Kafka published to validated topic
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      'au.quality.record.validated.v1',
      expect.any(String),
      expect.objectContaining({ overallStatus: 'PASSED' }),
      expect.any(Object),
    );
  });

  it('Step 2: validate a FAILING record → report FAILED, correction tracker created', async () => {
    kafkaProducer.send.mockClear();

    const dto = {
      recordId: 'outbreak-002',
      entityType: 'Outbreak',
      domain: 'health',
      record: {
        // Missing speciesCode and countryCode — COMPLETENESS will fail
        reportDate: '2024-06-01',
      },
      requiredFields: ['speciesCode', 'countryCode', 'reportDate'],
    };

    const result = await validateService.validate(dto as any, mockUser);

    expect(result.data).toBeDefined();
    expect(result.data.overallStatus).toBe('FAILED');

    // Should have violations for missing fields
    expect(result.data.violations!.length).toBeGreaterThan(0);
    const completenessViolations = result.data.violations!.filter(
      (v: any) => v.gate === 'COMPLETENESS',
    );
    expect(completenessViolations.length).toBeGreaterThan(0);

    // Correction tracker should be created
    expect(correctionTrackers).toHaveLength(1);
    expect(correctionTrackers[0].status).toBe('PENDING');
    expect(correctionTrackers[0].reportId).toBe(result.data.id);

    // Kafka published to rejected topic
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      'au.quality.record.rejected.v1',
      expect.any(String),
      expect.objectContaining({ overallStatus: 'FAILED' }),
      expect.any(Object),
    );
  });

  it('Step 3: create a custom rule, then validate — rule config merged', async () => {
    kafkaProducer.send.mockClear();

    // Create a custom rule requiring diseaseCode
    const rule = await ruleService.create(
      {
        domain: 'health',
        entityType: 'Outbreak',
        name: 'Require diseaseCode',
        gate: 'COMPLETENESS',
        config: { requiredFields: ['diseaseCode'] },
      } as any,
      mockUser,
    );

    expect(rule.data).toBeDefined();
    expect(customRules).toHaveLength(1);

    // Validate a record missing diseaseCode — should fail due to custom rule
    const dto = {
      recordId: 'outbreak-003',
      entityType: 'Outbreak',
      domain: 'health',
      record: {
        speciesCode: 'BOV',
        countryCode: 'KE',
        reportDate: '2024-06-01',
        // Missing diseaseCode — custom rule requires it
      },
      requiredFields: ['speciesCode', 'countryCode'],
    };

    const result = await validateService.validate(dto as any, mockUser);

    // The engine should have been called with merged requiredFields
    // including diseaseCode from the custom rule
    expect(result.data).toBeDefined();
    // The record is missing diseaseCode which the custom rule demands
    const completenessViolations = result.data.violations!.filter(
      (v: any) => v.gate === 'COMPLETENESS',
    );
    // Should have a violation for diseaseCode
    const hasDiseaseViolation = completenessViolations.some(
      (v: any) => v.field.includes('diseaseCode') || v.message.includes('diseaseCode'),
    );
    expect(hasDiseaseViolation).toBe(true);
  });

  it('Step 4: mark correction as resolved', async () => {
    // The correction tracker from Step 2 should still be pending
    const pendingTracker = correctionTrackers.find((t) => t.status === 'PENDING');
    expect(pendingTracker).toBeDefined();

    const result = await correctionService.markCorrected(pendingTracker!.reportId);

    expect(result.data.status).toBe('CORRECTED');
    expect(result.data.correctedAt).toBeDefined();
  });

  it('Step 5: dashboard KPIs reflect all validations', async () => {
    const result = await dashboardService.getKpis(mockUser, {});

    expect(result.data).toBeDefined();
    expect(result.data.totalReports).toBeGreaterThanOrEqual(3);
    expect(result.data.byDomain).toBeInstanceOf(Array);
    expect(result.data.byGate).toBeInstanceOf(Array);
  });

  it('Step 6: reports listing works with filters', async () => {
    const allReports = await reportService.findAll(mockUser, {});
    expect(allReports.data.length).toBeGreaterThanOrEqual(3);

    const healthReports = await reportService.findAll(mockUser, { domain: 'health' });
    expect(healthReports.data.length).toBeGreaterThanOrEqual(3);
  });

  it('Step 7: corrections listing works with status filter', async () => {
    const all = await correctionService.findAll(mockUser, {});
    expect(all.data.length).toBeGreaterThanOrEqual(1);
  });
});
