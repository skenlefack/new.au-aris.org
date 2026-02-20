import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthKpiService } from '../health-kpi.service';

function mockRedisService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    incr: vi.fn().mockResolvedValue(1),
    incrBy: vi.fn().mockResolvedValue(1),
    incrByFloat: vi.fn().mockResolvedValue('1.0'),
    del: vi.fn().mockResolvedValue(1),
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

describe('HealthKpiService', () => {
  let service: HealthKpiService;
  let redis: ReturnType<typeof mockRedisService>;

  beforeEach(() => {
    redis = mockRedisService();
    service = new HealthKpiService(redis as never);
  });

  // ── getHealthKpis (global) ──

  describe('getHealthKpis — global aggregation', () => {
    it('should aggregate across all country/disease keys', async () => {
      redis.scanKeys
        .mockResolvedValueOnce([ // health keys
          'analytics:health:KE:FMD',
          'analytics:health:NG:PPR',
        ])
        .mockResolvedValueOnce([]) // vaccination keys
        .mockResolvedValueOnce([]); // lab keys

      redis.hGetAll
        .mockResolvedValueOnce({
          active: '5', confirmed: '3', cases: '10', deaths: '2',
          lastUpdated: '2026-01-15T10:00:00Z',
        })
        .mockResolvedValueOnce({
          active: '3', confirmed: '1', cases: '7', deaths: '1',
          lastUpdated: '2026-01-10T10:00:00Z',
        })
        .mockResolvedValueOnce({}); // quality global

      const result = await service.getHealthKpis();

      expect(result.activeOutbreaks).toBe(8);
      expect(result.confirmed).toBe(4);
      expect(result.cases).toBe(17);
      expect(result.deaths).toBe(3);
      expect(result.suspected).toBe(4); // 8 - 4
    });

    it('should return zeros when no data exists', async () => {
      redis.scanKeys.mockResolvedValue([]);
      redis.hGetAll.mockResolvedValue({});

      const result = await service.getHealthKpis();

      expect(result.activeOutbreaks).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.vaccinationCoverage).toBe(0);
      expect(result.avgLabTurnaround).toBe(0);
    });

    it('should skip trend keys during aggregation', async () => {
      redis.scanKeys
        .mockResolvedValueOnce([
          'analytics:health:KE:FMD',
          'analytics:health:trend:2026-01', // Should be skipped
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      redis.hGetAll
        .mockResolvedValueOnce({ active: '5', confirmed: '3', cases: '10', deaths: '2' })
        .mockResolvedValueOnce({}); // quality global

      const result = await service.getHealthKpis();

      expect(result.activeOutbreaks).toBe(5);
      // hGetAll should only be called for KE:FMD + quality global, not for trend key
      expect(redis.hGetAll).toHaveBeenCalledTimes(2);
    });

    it('should average vaccination coverage across countries', async () => {
      redis.scanKeys
        .mockResolvedValueOnce([]) // health
        .mockResolvedValueOnce([ // vaccination
          'analytics:vaccination:KE:FMD',
          'analytics:vaccination:NG:PPR',
        ])
        .mockResolvedValueOnce([]); // lab

      redis.hGetAll
        .mockResolvedValueOnce({}) // quality
        .mockResolvedValueOnce({ coverage: '60' }) // KE
        .mockResolvedValueOnce({ coverage: '80' }); // NG

      const result = await service.getHealthKpis();

      expect(result.vaccinationCoverage).toBe(70); // (60+80)/2
    });

    it('should average lab turnaround across countries', async () => {
      redis.scanKeys
        .mockResolvedValueOnce([]) // health
        .mockResolvedValueOnce([]) // vaccination
        .mockResolvedValueOnce([ // lab
          'analytics:lab:KE',
          'analytics:lab:NG',
        ]);

      redis.hGetAll
        .mockResolvedValueOnce({}) // quality
        .mockResolvedValueOnce({ avgTurnaround: '3' })
        .mockResolvedValueOnce({ avgTurnaround: '5' });

      const result = await service.getHealthKpis();

      expect(result.avgLabTurnaround).toBe(4); // (3+5)/2
    });
  });

  // ── getHealthKpis (filtered) ──

  describe('getHealthKpis — filtered by country/disease', () => {
    it('should return KPIs for specific country and disease', async () => {
      redis.hGetAll
        .mockResolvedValueOnce({ // health
          active: '5', confirmed: '3', cases: '10', deaths: '2',
          lastUpdated: '2026-01-15T10:00:00Z',
        })
        .mockResolvedValueOnce({ // vaccination
          coverage: '75.5',
        })
        .mockResolvedValueOnce({ // lab
          avgTurnaround: '3.2',
        })
        .mockResolvedValueOnce({ // quality
          passRate: '89',
        });

      const result = await service.getHealthKpis('KE', 'FMD');

      expect(result.activeOutbreaks).toBe(5);
      expect(result.confirmed).toBe(3);
      expect(result.suspected).toBe(2);
      expect(result.vaccinationCoverage).toBe(75.5);
      expect(result.avgLabTurnaround).toBe(3.2);
      expect(result.qualityPassRate).toBe(89);
    });
  });

  // ── getHealthKpisByDisease ──

  describe('getHealthKpisByDisease', () => {
    it('should list all disease breakdowns', async () => {
      redis.scanKeys.mockResolvedValue([
        'analytics:health:KE:FMD',
        'analytics:health:KE:PPR',
      ]);

      redis.hGetAll
        .mockResolvedValueOnce({
          active: '5', confirmed: '3', cases: '10', deaths: '2',
        })
        .mockResolvedValueOnce({
          active: '2', confirmed: '1', cases: '4', deaths: '0',
        });

      const result = await service.getHealthKpisByDisease('KE');

      expect(result).toHaveLength(2);
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].diseaseId).toBe('FMD');
      expect(result[0].active).toBe(5);
      expect(result[1].diseaseId).toBe('PPR');
      expect(result[1].active).toBe(2);
    });

    it('should use correct scan pattern for country filter', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.getHealthKpisByDisease('NG');

      expect(redis.scanKeys).toHaveBeenCalledWith('analytics:health:NG:*');
    });

    it('should scan all countries when no filter', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.getHealthKpisByDisease();

      expect(redis.scanKeys).toHaveBeenCalledWith('analytics:health:*:*');
    });
  });

  // ── getHealthTrends ──

  describe('getHealthTrends', () => {
    it('should return entries from recent months', async () => {
      redis.zRangeByScoreWithScores.mockResolvedValue([
        {
          member: JSON.stringify({
            id: 'evt-1',
            countryCode: 'KE',
            diseaseId: 'FMD',
            cases: 5,
            deaths: 1,
            eventType: 'SUSPECT',
          }),
          score: 1705312800000,
        },
      ]);

      const result = await service.getHealthTrends(3);

      expect(result.period).toBe('3m');
      expect(result.totalEvents).toBeGreaterThanOrEqual(1);
      expect(result.entries[0].countryCode).toBe('KE');
    });

    it('should default to 6 months', async () => {
      redis.zRangeByScoreWithScores.mockResolvedValue([]);

      const result = await service.getHealthTrends();

      expect(result.period).toBe('6m');
      // Should call zRangeByScoreWithScores 6 times (once per month)
      expect(redis.zRangeByScoreWithScores).toHaveBeenCalledTimes(6);
    });

    it('should handle malformed JSON in trend entries gracefully', async () => {
      redis.zRangeByScoreWithScores.mockResolvedValue([
        { member: 'not-json', score: 1705312800000 },
        {
          member: JSON.stringify({ id: 'evt-2', countryCode: 'KE', diseaseId: 'PPR' }),
          score: 1705312900000,
        },
      ]);

      const result = await service.getHealthTrends(1);

      // Only the valid entry should be included
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe('evt-2');
    });

    it('should sort entries by timestamp ascending', async () => {
      redis.zRangeByScoreWithScores.mockResolvedValue([
        {
          member: JSON.stringify({ id: 'evt-2', countryCode: 'KE', diseaseId: 'FMD' }),
          score: 2000,
        },
        {
          member: JSON.stringify({ id: 'evt-1', countryCode: 'KE', diseaseId: 'FMD' }),
          score: 1000,
        },
      ]);

      const result = await service.getHealthTrends(1);

      expect(result.entries[0].id).toBe('evt-1');
      expect(result.entries[1].id).toBe('evt-2');
    });
  });

  // ── getQualityDashboard ──

  describe('getQualityDashboard', () => {
    it('should return quality metrics from Redis', async () => {
      redis.hGetAll.mockResolvedValue({
        passRate: '89.5',
        failRate: '10.5',
        totalRecords: '200',
        passCount: '179',
        failCount: '21',
        lastUpdated: '2026-01-15T10:00:00Z',
      });

      const result = await service.getQualityDashboard();

      expect(result.passRate).toBe(89.5);
      expect(result.failRate).toBe(10.5);
      expect(result.totalRecords).toBe(200);
      expect(result.passCount).toBe(179);
      expect(result.failCount).toBe(21);
    });

    it('should return zero defaults when empty', async () => {
      redis.hGetAll.mockResolvedValue({});

      const result = await service.getQualityDashboard();

      expect(result.passRate).toBe(0);
      expect(result.totalRecords).toBe(0);
    });
  });

  // ── getWorkflowTimeliness ──

  describe('getWorkflowTimeliness', () => {
    it('should return timeliness for all workflow levels', async () => {
      redis.hGetAll.mockResolvedValue({
        'NATIONAL_TECHNICAL:avgDays': '2.5',
        'NATIONAL_TECHNICAL:count': '10',
        'NATIONAL_OFFICIAL:avgDays': '4.0',
        'NATIONAL_OFFICIAL:count': '8',
        lastUpdated: '2026-01-15T10:00:00Z',
      });

      const result = await service.getWorkflowTimeliness();

      expect(result.levels['NATIONAL_TECHNICAL']).toEqual({
        avgDays: 2.5,
        count: 10,
      });
      expect(result.levels['NATIONAL_OFFICIAL']).toEqual({
        avgDays: 4,
        count: 8,
      });
      expect(result.levels['REC_HARMONIZATION']).toEqual({
        avgDays: 0,
        count: 0,
      });
    });
  });

  // ── getDenominators ──

  describe('getDenominators', () => {
    it('should return vaccination denominators', async () => {
      redis.scanKeys.mockResolvedValue([
        'analytics:vaccination:KE:FMD',
        'analytics:vaccination:KE:PPR',
      ]);

      redis.hGetAll
        .mockResolvedValueOnce({
          doses: '5000',
          targetPopulation: '20000',
          coverage: '25',
          campaigns: '3',
        })
        .mockResolvedValueOnce({
          doses: '3000',
          targetPopulation: '10000',
          coverage: '30',
          campaigns: '2',
        });

      const result = await service.getDenominators('KE');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        countryCode: 'KE',
        diseaseId: 'FMD',
        dosesUsed: 5000,
        targetPopulation: 20000,
        coverage: 25,
        campaigns: 3,
      });
    });

    it('should scan all countries when no filter', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.getDenominators();

      expect(redis.scanKeys).toHaveBeenCalledWith('analytics:vaccination:*:*');
    });
  });
});
