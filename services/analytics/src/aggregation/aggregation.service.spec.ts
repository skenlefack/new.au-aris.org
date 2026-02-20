import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AggregationService, REDIS_KEYS } from './aggregation.service';
import type {
  HealthEventPayload,
  VaccinationPayload,
  LabResultPayload,
  QualityRecordPayload,
  WorkflowApprovedPayload,
} from './aggregation.service';

function mockRedisService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    incrBy: vi.fn().mockResolvedValue(1),
    incrByFloat: vi.fn().mockResolvedValue('1.0'),
    hSet: vi.fn().mockResolvedValue(1),
    hGet: vi.fn().mockResolvedValue(null),
    hGetAll: vi.fn().mockResolvedValue({}),
    hIncrBy: vi.fn().mockResolvedValue(1),
    hIncrByFloat: vi.fn().mockResolvedValue('1.0'),
    hMSet: vi.fn().mockResolvedValue('OK'),
    zAdd: vi.fn().mockResolvedValue(1),
    zRangeByScore: vi.fn().mockResolvedValue([]),
    zRangeByScoreWithScores: vi.fn().mockResolvedValue([]),
    scanKeys: vi.fn().mockResolvedValue([]),
    getClient: vi.fn().mockReturnValue({}),
  };
}

describe('AggregationService', () => {
  let service: AggregationService;
  let redis: ReturnType<typeof mockRedisService>;

  beforeEach(() => {
    redis = mockRedisService();
    service = new AggregationService(redis as never);
  });

  // ── Health Event Created ──

  describe('handleHealthEventCreated', () => {
    const payload: HealthEventPayload = {
      id: 'evt-001',
      tenantId: 'tenant-1',
      countryCode: 'KE',
      diseaseId: 'FMD',
      cases: 5,
      deaths: 2,
      eventType: 'SUSPECT',
      timestamp: '2026-01-15T10:00:00.000Z',
    };

    it('should increment active outbreaks in Redis hash', async () => {
      await service.handleHealthEventCreated(payload);

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'active',
        1,
      );
    });

    it('should increment cases count', async () => {
      await service.handleHealthEventCreated(payload);

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'cases',
        5,
      );
    });

    it('should increment deaths count', async () => {
      await service.handleHealthEventCreated(payload);

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'deaths',
        2,
      );
    });

    it('should default cases to 1 and deaths to 0 when not provided', async () => {
      await service.handleHealthEventCreated({
        ...payload,
        cases: undefined,
        deaths: undefined,
      });

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'cases',
        1,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'deaths',
        0,
      );
    });

    it('should add trend entry with timestamp as sorted set score', async () => {
      await service.handleHealthEventCreated(payload);

      const expectedEpoch = new Date('2026-01-15T10:00:00.000Z').getTime();
      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.healthTrend('2026-01'),
        expectedEpoch,
        expect.stringContaining('"id":"evt-001"'),
      );
    });

    it('should use current time for trend when no timestamp', async () => {
      const before = Date.now();
      await service.handleHealthEventCreated({
        ...payload,
        timestamp: undefined,
      });

      const call = redis.zAdd.mock.calls[0];
      expect(call[1]).toBeGreaterThanOrEqual(before);
    });

    it('should set lastUpdated on health hash', async () => {
      await service.handleHealthEventCreated(payload);

      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'lastUpdated',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });
  });

  // ── Health Event Confirmed ──

  describe('handleHealthEventConfirmed', () => {
    const payload: HealthEventPayload = {
      id: 'evt-002',
      tenantId: 'tenant-1',
      countryCode: 'KE',
      diseaseId: 'FMD',
    };

    it('should increment confirmed count', async () => {
      await service.handleHealthEventConfirmed(payload);

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'confirmed',
        1,
      );
    });

    it('should update lastUpdated timestamp', async () => {
      await service.handleHealthEventConfirmed(payload);

      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.health('KE', 'FMD'),
        'lastUpdated',
        expect.any(String),
      );
    });
  });

  // ── Vaccination Completed ──

  describe('handleVaccinationCompleted', () => {
    const payload: VaccinationPayload = {
      id: 'vac-001',
      tenantId: 'tenant-1',
      countryCode: 'KE',
      diseaseId: 'FMD',
      dosesUsed: 1000,
      targetPopulation: 5000,
      coverageEstimate: 20,
    };

    it('should accumulate doses and target population', async () => {
      redis.hGetAll.mockResolvedValue({
        doses: '500',
        targetPopulation: '3000',
        campaigns: '1',
      });

      await service.handleVaccinationCompleted(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.vaccination('KE', 'FMD'),
        expect.objectContaining({
          doses: '1500',
          targetPopulation: '8000',
          campaigns: '2',
        }),
      );
    });

    it('should calculate coverage correctly', async () => {
      redis.hGetAll.mockResolvedValue({});

      await service.handleVaccinationCompleted(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.vaccination('KE', 'FMD'),
        expect.objectContaining({
          doses: '1000',
          targetPopulation: '5000',
          coverage: '20', // 1000/5000 * 100 = 20
        }),
      );
    });

    it('should handle zero target population', async () => {
      redis.hGetAll.mockResolvedValue({});

      await service.handleVaccinationCompleted({
        ...payload,
        dosesUsed: 0,
        targetPopulation: 0,
      });

      expect(redis.hMSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ coverage: '0' }),
      );
    });

    it('should increment campaign count', async () => {
      redis.hGetAll.mockResolvedValue({ campaigns: '5' });

      await service.handleVaccinationCompleted(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ campaigns: '6' }),
      );
    });
  });

  // ── Lab Result Created ──

  describe('handleLabResultCreated', () => {
    const payload: LabResultPayload = {
      id: 'lab-001',
      tenantId: 'tenant-1',
      countryCode: 'KE',
      result: 'POSITIVE',
      turnaroundDays: 3,
    };

    it('should increment total tests and positive count for POSITIVE', async () => {
      redis.hGetAll.mockResolvedValue({
        totalTests: '10',
        positiveCount: '3',
        turnaroundSum: '25',
      });

      await service.handleLabResultCreated(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.lab('KE'),
        expect.objectContaining({
          totalTests: '11',
          positiveCount: '4',
        }),
      );
    });

    it('should not increment positive count for NEGATIVE', async () => {
      redis.hGetAll.mockResolvedValue({
        totalTests: '10',
        positiveCount: '3',
        turnaroundSum: '25',
      });

      await service.handleLabResultCreated({ ...payload, result: 'NEGATIVE' });

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.lab('KE'),
        expect.objectContaining({
          totalTests: '11',
          positiveCount: '3',
        }),
      );
    });

    it('should calculate average turnaround correctly', async () => {
      redis.hGetAll.mockResolvedValue({
        totalTests: '4',
        positiveCount: '1',
        turnaroundSum: '12',
      });

      await service.handleLabResultCreated({
        ...payload,
        turnaroundDays: 8,
      });

      // (12 + 8) / 5 = 4.0
      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.lab('KE'),
        expect.objectContaining({ avgTurnaround: '4' }),
      );
    });

    it('should calculate positive rate correctly', async () => {
      redis.hGetAll.mockResolvedValue({
        totalTests: '9',
        positiveCount: '2',
        turnaroundSum: '30',
      });

      await service.handleLabResultCreated(payload);

      // 3/10 * 100 = 30
      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.lab('KE'),
        expect.objectContaining({ positiveRate: '30' }),
      );
    });

    it('should initialize from empty state', async () => {
      redis.hGetAll.mockResolvedValue({});

      await service.handleLabResultCreated(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.lab('KE'),
        expect.objectContaining({
          totalTests: '1',
          positiveCount: '1',
          turnaroundSum: '3',
          avgTurnaround: '3',
          positiveRate: '100',
        }),
      );
    });
  });

  // ── Quality Validated ──

  describe('handleQualityValidated', () => {
    const payload: QualityRecordPayload = {
      id: 'rec-001',
      tenantId: 'tenant-1',
      entityType: 'health_event',
    };

    it('should increment pass count and total', async () => {
      redis.hGetAll.mockResolvedValue({
        passCount: '8',
        totalRecords: '10',
      });

      await service.handleQualityValidated(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.qualityGlobal,
        expect.objectContaining({
          passCount: '9',
          totalRecords: '11',
        }),
      );
    });

    it('should calculate pass and fail rates', async () => {
      redis.hGetAll.mockResolvedValue({
        passCount: '8',
        totalRecords: '10',
      });

      await service.handleQualityValidated(payload);

      // pass: 9/11 = 81.82%, fail: 2/11 = 18.18%
      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.qualityGlobal,
        expect.objectContaining({
          passRate: '81.82',
          failRate: '18.18',
        }),
      );
    });

    it('should initialize from empty state', async () => {
      redis.hGetAll.mockResolvedValue({});

      await service.handleQualityValidated(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.qualityGlobal,
        expect.objectContaining({
          passCount: '1',
          totalRecords: '1',
          passRate: '100',
          failRate: '0',
        }),
      );
    });
  });

  // ── Quality Rejected ──

  describe('handleQualityRejected', () => {
    const payload: QualityRecordPayload = {
      id: 'rec-002',
      tenantId: 'tenant-1',
      entityType: 'health_event',
    };

    it('should increment fail count and total', async () => {
      redis.hGetAll.mockResolvedValue({
        failCount: '2',
        passCount: '8',
        totalRecords: '10',
      });

      await service.handleQualityRejected(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.qualityGlobal,
        expect.objectContaining({
          failCount: '3',
          totalRecords: '11',
        }),
      );
    });

    it('should recalculate rates after rejection', async () => {
      redis.hGetAll.mockResolvedValue({
        failCount: '2',
        passCount: '8',
        totalRecords: '10',
      });

      await service.handleQualityRejected(payload);

      // pass: 8/11 = 72.73%, fail: 3/11 = 27.27%
      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.qualityGlobal,
        expect.objectContaining({
          passRate: '72.73',
          failRate: '27.27',
        }),
      );
    });
  });

  // ── Workflow Approved ──

  describe('handleWorkflowApproved', () => {
    const payload: WorkflowApprovedPayload = {
      instanceId: 'wf-001',
      tenantId: 'tenant-1',
      level: 'NATIONAL_TECHNICAL',
      daysAtLevel: 3,
    };

    it('should update level count and sum', async () => {
      redis.hGetAll.mockResolvedValue({
        'NATIONAL_TECHNICAL:count': '5',
        'NATIONAL_TECHNICAL:sumDays': '10',
      });

      await service.handleWorkflowApproved(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.workflowTimeliness,
        expect.objectContaining({
          'NATIONAL_TECHNICAL:count': '6',
          'NATIONAL_TECHNICAL:sumDays': '13',
        }),
      );
    });

    it('should calculate average days correctly', async () => {
      redis.hGetAll.mockResolvedValue({
        'NATIONAL_TECHNICAL:count': '5',
        'NATIONAL_TECHNICAL:sumDays': '10',
      });

      await service.handleWorkflowApproved(payload);

      // (10 + 3) / 6 = 2.17
      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.workflowTimeliness,
        expect.objectContaining({
          'NATIONAL_TECHNICAL:avgDays': '2.17',
        }),
      );
    });

    it('should initialize from empty state', async () => {
      redis.hGetAll.mockResolvedValue({});

      await service.handleWorkflowApproved(payload);

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.workflowTimeliness,
        expect.objectContaining({
          'NATIONAL_TECHNICAL:count': '1',
          'NATIONAL_TECHNICAL:sumDays': '3',
          'NATIONAL_TECHNICAL:avgDays': '3',
        }),
      );
    });

    it('should handle different workflow levels independently', async () => {
      redis.hGetAll.mockResolvedValue({
        'NATIONAL_TECHNICAL:count': '5',
        'NATIONAL_TECHNICAL:sumDays': '10',
      });

      await service.handleWorkflowApproved({
        ...payload,
        level: 'REC_HARMONIZATION',
        daysAtLevel: 7,
      });

      expect(redis.hMSet).toHaveBeenCalledWith(
        REDIS_KEYS.workflowTimeliness,
        expect.objectContaining({
          'REC_HARMONIZATION:count': '1',
          'REC_HARMONIZATION:sumDays': '7',
          'REC_HARMONIZATION:avgDays': '7',
        }),
      );
    });
  });

  // ── Redis Key Patterns ──

  describe('REDIS_KEYS', () => {
    it('should generate correct health key', () => {
      expect(REDIS_KEYS.health('KE', 'FMD')).toBe('analytics:health:KE:FMD');
    });

    it('should generate correct vaccination key', () => {
      expect(REDIS_KEYS.vaccination('NG', 'PPR')).toBe(
        'analytics:vaccination:NG:PPR',
      );
    });

    it('should generate correct lab key', () => {
      expect(REDIS_KEYS.lab('ET')).toBe('analytics:lab:ET');
    });

    it('should generate correct trend key', () => {
      expect(REDIS_KEYS.healthTrend('2026-02')).toBe(
        'analytics:health:trend:2026-02',
      );
    });

    it('should have correct global quality key', () => {
      expect(REDIS_KEYS.qualityGlobal).toBe('analytics:quality:global');
    });

    it('should have correct workflow timeliness key', () => {
      expect(REDIS_KEYS.workflowTimeliness).toBe(
        'analytics:workflow:timeliness',
      );
    });
  });
});
