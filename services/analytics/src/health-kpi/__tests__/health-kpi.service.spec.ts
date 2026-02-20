import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthKpiService, KPI_KEYS } from '../health-kpi.service';

function mockRedisService() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    incr: vi.fn().mockResolvedValue(1),
    incrBy: vi.fn().mockResolvedValue(1),
    incrByFloat: vi.fn().mockResolvedValue('1.0'),
    getClient: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
    }),
  };
}

describe('HealthKpiService', () => {
  let service: HealthKpiService;
  let redis: ReturnType<typeof mockRedisService>;

  beforeEach(() => {
    redis = mockRedisService();
    service = new HealthKpiService(redis as never);
  });

  // ── getKpis ──

  describe('getKpis', () => {
    it('should return parsed KPIs from Redis', async () => {
      redis.get
        .mockResolvedValueOnce('15')                  // activeOutbreaks
        .mockResolvedValueOnce('72.5')                // vaccinationCoverage
        .mockResolvedValueOnce('3.8')                 // avgLabTurnaround
        .mockResolvedValueOnce('91.2')                // qualityPassRate
        .mockResolvedValueOnce('2026-01-15T10:00:00.000Z'); // lastUpdated

      const result = await service.getKpis();

      expect(result).toEqual({
        activeOutbreaks: 15,
        vaccinationCoverage: 72.5,
        avgLabTurnaround: 3.8,
        qualityPassRate: 91.2,
        lastUpdated: '2026-01-15T10:00:00.000Z',
      });

      expect(redis.get).toHaveBeenCalledWith(KPI_KEYS.ACTIVE_OUTBREAKS);
      expect(redis.get).toHaveBeenCalledWith(KPI_KEYS.VACCINATION_COVERAGE);
      expect(redis.get).toHaveBeenCalledWith(KPI_KEYS.AVG_LAB_TURNAROUND);
      expect(redis.get).toHaveBeenCalledWith(KPI_KEYS.QUALITY_PASS_RATE);
      expect(redis.get).toHaveBeenCalledWith(KPI_KEYS.LAST_UPDATED);
    });

    it('should return zero defaults when Redis has no data', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getKpis();

      expect(result.activeOutbreaks).toBe(0);
      expect(result.vaccinationCoverage).toBe(0);
      expect(result.avgLabTurnaround).toBe(0);
      expect(result.qualityPassRate).toBe(0);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should handle non-numeric strings gracefully', async () => {
      redis.get
        .mockResolvedValueOnce('not-a-number')
        .mockResolvedValueOnce('bad')
        .mockResolvedValueOnce('xyz')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(null);

      const result = await service.getKpis();

      expect(result.activeOutbreaks).toBeNaN();
      expect(result.vaccinationCoverage).toBeNaN();
      expect(result.avgLabTurnaround).toBeNaN();
      // parseFloat('') returns NaN
      expect(result.qualityPassRate).toBeNaN();
    });
  });

  // ── handleHealthEventCreated ──

  describe('handleHealthEventCreated', () => {
    it('should increment active outbreaks counter', async () => {
      await service.handleHealthEventCreated({ id: 'evt-001' });

      expect(redis.incr).toHaveBeenCalledWith(KPI_KEYS.ACTIVE_OUTBREAKS);
    });

    it('should increment events processed counter', async () => {
      await service.handleHealthEventCreated({ id: 'evt-002' });

      expect(redis.incr).toHaveBeenCalledWith(KPI_KEYS.EVENTS_PROCESSED);
    });

    it('should update last_updated timestamp', async () => {
      const before = new Date();
      await service.handleHealthEventCreated({ id: 'evt-003' });

      expect(redis.set).toHaveBeenCalledWith(
        KPI_KEYS.LAST_UPDATED,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );

      const setCall = redis.set.mock.calls.find(
        (c: string[]) => c[0] === KPI_KEYS.LAST_UPDATED,
      );
      const ts = new Date(setCall![1] as string);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should handle payload without id gracefully', async () => {
      await expect(
        service.handleHealthEventCreated({}),
      ).resolves.not.toThrow();

      expect(redis.incr).toHaveBeenCalledWith(KPI_KEYS.ACTIVE_OUTBREAKS);
    });
  });

  // ── seedMockKpis ──

  describe('seedMockKpis', () => {
    it('should seed mock values when no data exists', async () => {
      redis.getClient.mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
      });

      await service.seedMockKpis();

      expect(redis.set).toHaveBeenCalledWith(KPI_KEYS.ACTIVE_OUTBREAKS, '42');
      expect(redis.set).toHaveBeenCalledWith(KPI_KEYS.VACCINATION_COVERAGE, '67.3');
      expect(redis.set).toHaveBeenCalledWith(KPI_KEYS.AVG_LAB_TURNAROUND, '4.2');
      expect(redis.set).toHaveBeenCalledWith(KPI_KEYS.QUALITY_PASS_RATE, '89.1');
      expect(redis.set).toHaveBeenCalledWith(KPI_KEYS.EVENTS_PROCESSED, '0');
    });

    it('should not overwrite existing data', async () => {
      redis.getClient.mockReturnValue({
        get: vi.fn().mockResolvedValue('100'),
      });

      await service.seedMockKpis();

      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
