import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregationService, REDIS_KEYS } from '../services/aggregation.service';
import { HealthKpiService } from '../services/health-kpi.service';
import { CrossDomainService } from '../services/cross-domain.service';
import { DomainAggregationService, DOMAIN_REDIS_KEYS } from '../services/domain-aggregation.service';

// ── Mock Redis Client ──

function createMockRedisClient() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
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
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    incrBy: vi.fn().mockResolvedValue(1),
    incrByFloat: vi.fn().mockResolvedValue('1.0'),
    getClient: vi.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1. AggregationService: handleHealthEventCreated
// ═══════════════════════════════════════════════════════════════════

describe('AggregationService', () => {
  let redis: ReturnType<typeof createMockRedisClient>;
  let service: AggregationService;

  beforeEach(() => {
    redis = createMockRedisClient();
    service = new AggregationService(redis as any);
  });

  describe('handleHealthEventCreated', () => {
    it('should increment active/cases/deaths in Redis and add a trend entry', async () => {
      const payload = {
        id: 'evt-001',
        tenantId: 'tenant-ke',
        countryCode: 'KE',
        diseaseId: 'ASF',
        cases: 15,
        deaths: 3,
        eventType: 'CONFIRMED',
        timestamp: '2026-02-15T10:00:00Z',
      };

      await service.handleHealthEventCreated(payload);

      const expectedKey = REDIS_KEYS.health('KE', 'ASF');

      // Verify active count incremented by 1
      expect(redis.hIncrBy).toHaveBeenCalledWith(expectedKey, 'active', 1);
      // Verify cases incremented by payload.cases
      expect(redis.hIncrBy).toHaveBeenCalledWith(expectedKey, 'cases', 15);
      // Verify deaths incremented by payload.deaths
      expect(redis.hIncrBy).toHaveBeenCalledWith(expectedKey, 'deaths', 3);
      // Verify lastUpdated timestamp set
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'lastUpdated',
        expect.any(String),
      );
      // Verify trend entry added via zAdd
      const trendKey = REDIS_KEYS.healthTrend('2026-02');
      expect(redis.zAdd).toHaveBeenCalledWith(
        trendKey,
        expect.any(Number),
        expect.stringContaining('"id":"evt-001"'),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. AggregationService: handleVaccinationCompleted
  // ═══════════════════════════════════════════════════════════════════

  describe('handleVaccinationCompleted', () => {
    it('should calculate coverage percentage correctly from cumulative doses and target', async () => {
      // Pre-existing data: 5000 doses, 10000 target, 1 campaign
      redis.hGetAll.mockResolvedValue({
        doses: '5000',
        targetPopulation: '10000',
        campaigns: '1',
      });

      const payload = {
        id: 'vac-001',
        tenantId: 'tenant-ke',
        countryCode: 'KE',
        diseaseId: 'FMD',
        dosesUsed: 3000,
        targetPopulation: 5000,
        coverageEstimate: 60,
      };

      await service.handleVaccinationCompleted(payload);

      const expectedKey = REDIS_KEYS.vaccination('KE', 'FMD');

      // hGetAll called with the vaccination key
      expect(redis.hGetAll).toHaveBeenCalledWith(expectedKey);

      // newDoses = 5000 + 3000 = 8000
      // newTarget = 10000 + 5000 = 15000
      // newCoverage = Math.round((8000 / 15000) * 10000) / 100 = 53.33
      expect(redis.hMSet).toHaveBeenCalledWith(expectedKey, {
        doses: '8000',
        targetPopulation: '15000',
        coverage: '53.33',
        campaigns: '2',
        lastUpdated: expect.any(String),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. AggregationService: handleLabResultCreated
  // ═══════════════════════════════════════════════════════════════════

  describe('handleLabResultCreated', () => {
    it('should calculate positive rate and average turnaround from cumulative data', async () => {
      // Pre-existing: 9 tests, 2 positive, turnaroundSum = 36
      redis.hGetAll.mockResolvedValue({
        totalTests: '9',
        positiveCount: '2',
        turnaroundSum: '36',
      });

      const payload = {
        id: 'lab-001',
        tenantId: 'tenant-ke',
        countryCode: 'KE',
        result: 'POSITIVE' as const,
        turnaroundDays: 4,
      };

      await service.handleLabResultCreated(payload);

      const expectedKey = REDIS_KEYS.lab('KE');

      // newTotal = 9 + 1 = 10
      // newPositive = 2 + 1 = 3 (POSITIVE result)
      // newTurnaroundSum = 36 + 4 = 40
      // avgTurnaround = Math.round((40 / 10) * 100) / 100 = 4
      // positiveRate = Math.round((3 / 10) * 10000) / 100 = 30
      expect(redis.hMSet).toHaveBeenCalledWith(expectedKey, {
        totalTests: '10',
        positiveCount: '3',
        turnaroundSum: '40',
        avgTurnaround: '4',
        positiveRate: '30',
        lastUpdated: expect.any(String),
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. HealthKpiService: getHealthKpis (filtered by country+disease)
// ═══════════════════════════════════════════════════════════════════

describe('HealthKpiService', () => {
  let redis: ReturnType<typeof createMockRedisClient>;
  let service: HealthKpiService;

  beforeEach(() => {
    redis = createMockRedisClient();
    service = new HealthKpiService(redis as any);
  });

  describe('getHealthKpis (filtered by country and disease)', () => {
    it('should return KPIs from Redis hashes for a specific country/disease pair', async () => {
      const healthKey = REDIS_KEYS.health('KE', 'ASF');
      const vacKey = REDIS_KEYS.vaccination('KE', 'ASF');
      const labKey = REDIS_KEYS.lab('KE');
      const qualityKey = REDIS_KEYS.qualityGlobal;

      // Mock hGetAll to return different data based on key
      redis.hGetAll.mockImplementation(async (key: string) => {
        if (key === healthKey) {
          return {
            active: '12',
            confirmed: '8',
            cases: '150',
            deaths: '22',
            lastUpdated: '2026-02-20T12:00:00Z',
          };
        }
        if (key === vacKey) {
          return { coverage: '65.5' };
        }
        if (key === labKey) {
          return { avgTurnaround: '3.75' };
        }
        if (key === qualityKey) {
          return { passRate: '92.5' };
        }
        return {};
      });

      const result = await service.getHealthKpis('KE', 'ASF');

      expect(result).toEqual({
        activeOutbreaks: 12,
        confirmed: 8,
        suspected: 4,  // active - confirmed = 12 - 8
        deaths: 22,
        cases: 150,
        vaccinationCoverage: 65.5,
        avgLabTurnaround: 3.75,
        qualityPassRate: 92.5,
        lastUpdated: '2026-02-20T12:00:00Z',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. HealthKpiService: getHealthTrends
  // ═══════════════════════════════════════════════════════════════════

  describe('getHealthTrends', () => {
    it('should read sorted set entries, parse JSON members, and return sorted trends', async () => {
      const entry1 = JSON.stringify({
        id: 'evt-001',
        countryCode: 'KE',
        diseaseId: 'ASF',
        cases: 5,
        deaths: 1,
        eventType: 'CONFIRMED',
      });
      const entry2 = JSON.stringify({
        id: 'evt-002',
        countryCode: 'ET',
        diseaseId: 'CBPP',
        cases: 10,
        deaths: 0,
        eventType: 'SUSPECT',
      });

      // zRangeByScoreWithScores returns items for the current month's key
      redis.zRangeByScoreWithScores.mockResolvedValue([
        { member: entry1, score: 1708000000000 },
        { member: entry2, score: 1708100000000 },
      ]);

      const result = await service.getHealthTrends(1);

      expect(result.period).toBe('1m');
      expect(result.totalEvents).toBe(2);
      expect(result.entries).toHaveLength(2);
      // Sorted by timestamp ascending
      expect(result.entries[0].id).toBe('evt-001');
      expect(result.entries[0].countryCode).toBe('KE');
      expect(result.entries[0].cases).toBe(5);
      expect(result.entries[1].id).toBe('evt-002');
      expect(result.entries[1].diseaseId).toBe('CBPP');
      expect(result.entries[1].eventType).toBe('SUSPECT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. HealthKpiService: getQualityDashboard
  // ═══════════════════════════════════════════════════════════════════

  describe('getQualityDashboard', () => {
    it('should read quality global hash and return dashboard metrics', async () => {
      redis.hGetAll.mockResolvedValue({
        passRate: '87.5',
        failRate: '12.5',
        totalRecords: '200',
        passCount: '175',
        failCount: '25',
        lastUpdated: '2026-02-28T18:00:00Z',
      });

      const result = await service.getQualityDashboard();

      expect(redis.hGetAll).toHaveBeenCalledWith(REDIS_KEYS.qualityGlobal);
      expect(result).toEqual({
        passRate: 87.5,
        failRate: 12.5,
        totalRecords: 200,
        passCount: 175,
        failCount: 25,
        lastUpdated: '2026-02-28T18:00:00Z',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. HealthKpiService: getWorkflowTimeliness
  // ═══════════════════════════════════════════════════════════════════

  describe('getWorkflowTimeliness', () => {
    it('should read workflow timeliness hash and return per-level stats', async () => {
      redis.hGetAll.mockResolvedValue({
        'NATIONAL_TECHNICAL:avgDays': '2.5',
        'NATIONAL_TECHNICAL:count': '40',
        'NATIONAL_OFFICIAL:avgDays': '5.0',
        'NATIONAL_OFFICIAL:count': '35',
        'REC_HARMONIZATION:avgDays': '3.2',
        'REC_HARMONIZATION:count': '20',
        'CONTINENTAL_PUBLICATION:avgDays': '1.8',
        'CONTINENTAL_PUBLICATION:count': '15',
        lastUpdated: '2026-02-27T09:30:00Z',
      });

      const result = await service.getWorkflowTimeliness();

      expect(redis.hGetAll).toHaveBeenCalledWith(REDIS_KEYS.workflowTimeliness);
      expect(result.lastUpdated).toBe('2026-02-27T09:30:00Z');
      expect(result.levels['NATIONAL_TECHNICAL']).toEqual({
        avgDays: 2.5,
        count: 40,
      });
      expect(result.levels['NATIONAL_OFFICIAL']).toEqual({
        avgDays: 5.0,
        count: 35,
      });
      expect(result.levels['REC_HARMONIZATION']).toEqual({
        avgDays: 3.2,
        count: 20,
      });
      expect(result.levels['CONTINENTAL_PUBLICATION']).toEqual({
        avgDays: 1.8,
        count: 15,
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. CrossDomainService: getRiskScore
// ═══════════════════════════════════════════════════════════════════

describe('CrossDomainService', () => {
  let redis: ReturnType<typeof createMockRedisClient>;
  let service: CrossDomainService;

  beforeEach(() => {
    redis = createMockRedisClient();
    service = new CrossDomainService(redis as any);
  });

  describe('getRiskScore', () => {
    it('should calculate composite risk from 6 weighted domain components', async () => {
      const countryCode = 'KE';

      // Setup mock data for each risk domain
      redis.scanKeys.mockImplementation(async (pattern: string) => {
        // Health keys: 2 active outbreaks
        if (pattern === `analytics:health:${countryCode}:*`) {
          return [
            `analytics:health:${countryCode}:ASF`,
            `analytics:health:${countryCode}:FMD`,
          ];
        }
        // Vaccination keys for livestock risk
        if (pattern === `analytics:vaccination:${countryCode}:*`) {
          return [`analytics:vaccination:${countryCode}:FMD`];
        }
        return [];
      });

      redis.hGetAll.mockImplementation(async (key: string) => {
        // Health outbreaks
        if (key === `analytics:health:${countryCode}:ASF`) {
          return { active: '3', deaths: '10' };
        }
        if (key === `analytics:health:${countryCode}:FMD`) {
          return { active: '2', deaths: '5' };
        }
        // Climate data
        if (key === DOMAIN_REDIS_KEYS.climate(countryCode)) {
          return {
            activeHotspots: '4',
            'severity:CRITICAL': '1',
            'severity:HIGH': '2',
          };
        }
        // Trade data (deficit)
        if (key === DOMAIN_REDIS_KEYS.trade(countryCode)) {
          return { balance: '-5000000' };
        }
        // Wildlife data
        if (key === DOMAIN_REDIS_KEYS.wildlife(countryCode)) {
          return { totalCrimes: '6', speciesAffected: '3' };
        }
        // Governance PVS (high score = low risk)
        if (key === DOMAIN_REDIS_KEYS.governance(countryCode)) {
          return { latestScore: '72' };
        }
        // Livestock population
        if (key === DOMAIN_REDIS_KEYS.livestock(countryCode)) {
          return { totalPopulation: '500000' };
        }
        // Vaccination coverage for livestock risk calc
        if (key === `analytics:vaccination:${countryCode}:FMD`) {
          return { coverage: '45' };
        }
        return {};
      });

      const result = await service.getRiskScore(countryCode);

      expect(result.countryCode).toBe('KE');
      expect(result.components).toHaveLength(6);
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);

      // Verify component domains are present
      const domains = result.components.map((c) => c.domain);
      expect(domains).toContain('health');
      expect(domains).toContain('climate');
      expect(domains).toContain('trade');
      expect(domains).toContain('wildlife');
      expect(domains).toContain('governance');
      expect(domains).toContain('livestock');

      // Verify weights match RISK_WEIGHTS constants
      const healthComponent = result.components.find((c) => c.domain === 'health')!;
      expect(healthComponent.weight).toBe(0.30);
      const climateComponent = result.components.find((c) => c.domain === 'climate')!;
      expect(climateComponent.weight).toBe(0.20);

      // Verify health score: active = 3+2=5, deaths = 10+5=15
      // score = min(100, 5*10 + min(15*0.5, 50)) = min(100, 50 + 7.5) = 57.5
      expect(healthComponent.score).toBe(57.5);

      // Verify composite was stored in Redis
      expect(redis.hMSet).toHaveBeenCalledWith(
        DOMAIN_REDIS_KEYS.risk(countryCode),
        expect.objectContaining({
          compositeScore: expect.any(String),
          riskLevel: expect.any(String),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. DomainAggregationService: handleLivestockCensusCreated
// ═══════════════════════════════════════════════════════════════════

describe('DomainAggregationService', () => {
  let redis: ReturnType<typeof createMockRedisClient>;
  let service: DomainAggregationService;

  beforeEach(() => {
    redis = createMockRedisClient();
    service = new DomainAggregationService(redis as any);
  });

  describe('handleLivestockCensusCreated', () => {
    it('should set species population and recalculate total from all species fields', async () => {
      const payload = {
        id: 'census-001',
        tenantId: 'tenant-ke',
        countryCode: 'KE',
        speciesId: 'cattle',
        population: 25000,
        year: 2026,
      };

      // After setting species:cattle, hGetAll returns all species
      redis.hGetAll.mockResolvedValue({
        'species:cattle': '25000',
        'species:goats': '18000',
        'species:sheep': '12000',
        lastUpdated: '2026-02-20T10:00:00Z',
      });

      await service.handleLivestockCensusCreated(payload);

      const expectedKey = DOMAIN_REDIS_KEYS.livestock('KE');

      // Verify species population was set
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'species:cattle',
        '25000',
      );

      // Verify lastUpdated was set
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'lastUpdated',
        expect.any(String),
      );

      // Verify hGetAll was called to read all fields for total recalculation
      expect(redis.hGetAll).toHaveBeenCalledWith(expectedKey);

      // Verify total = 25000 + 18000 + 12000 = 55000
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'totalPopulation',
        '55000',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 10. DomainAggregationService: handleTradeFlowCreated
  // ═══════════════════════════════════════════════════════════════════

  describe('handleTradeFlowCreated', () => {
    it('should increment exports/imports and recalculate trade balance', async () => {
      const payload = {
        id: 'trade-001',
        tenantId: 'tenant-ke',
        countryCode: 'KE',
        partnerCountryCode: 'TZ',
        flowDirection: 'EXPORT' as const,
        commodity: 'live-cattle',
        valueFob: 250000,
        currency: 'USD',
        quantity: 500,
        unit: 'heads',
      };

      // After incrementing export, hGetAll returns updated state
      redis.hGetAll.mockResolvedValue({
        exports: '750000',   // 500000 existing + 250000 new
        imports: '300000',
        'partner:TZ': '250000',
        lastUpdated: '2026-02-20T10:00:00Z',
      });

      await service.handleTradeFlowCreated(payload);

      const expectedKey = DOMAIN_REDIS_KEYS.trade('KE');

      // Verify exports was incremented (EXPORT direction)
      expect(redis.hIncrByFloat).toHaveBeenCalledWith(
        expectedKey,
        'exports',
        250000,
      );

      // Verify partner volume was tracked
      expect(redis.hIncrByFloat).toHaveBeenCalledWith(
        expectedKey,
        'partner:TZ',
        250000,
      );

      // Verify hGetAll was called for balance recalculation
      expect(redis.hGetAll).toHaveBeenCalledWith(expectedKey);

      // Verify balance = exports - imports = 750000 - 300000 = 450000
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'balance',
        '450000',
      );

      // Verify lastUpdated was set
      expect(redis.hSet).toHaveBeenCalledWith(
        expectedKey,
        'lastUpdated',
        expect.any(String),
      );
    });
  });
});
