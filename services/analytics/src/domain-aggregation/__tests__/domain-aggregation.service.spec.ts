import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DomainAggregationService, DOMAIN_REDIS_KEYS } from '../domain-aggregation.service';
import type {
  LivestockCensusPayload,
  FishCapturePayload,
  WildlifeCrimePayload,
  TradeFlowPayload,
  ClimateHotspotPayload,
  ApicultureProductionPayload,
  GovernancePvsPayload,
} from '../../cross-domain/dto/cross-domain.dto';

const mockRedis = {
  hSet: vi.fn(),
  hGetAll: vi.fn(),
  hIncrBy: vi.fn(),
  hIncrByFloat: vi.fn(),
  hMSet: vi.fn(),
};

describe('DomainAggregationService', () => {
  let service: DomainAggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DomainAggregationService(mockRedis as any);
  });

  // ── Livestock ──

  describe('handleLivestockCensusCreated', () => {
    const payload: LivestockCensusPayload = {
      id: 'census-001',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      speciesId: 'CATTLE',
      population: 18000000,
      year: 2025,
    };

    it('should set species population and recalculate totalPopulation', async () => {
      const key = DOMAIN_REDIS_KEYS.livestock('KE');

      mockRedis.hGetAll.mockResolvedValue({
        'species:CATTLE': '18000000',
        'species:GOAT': '5000000',
        lastUpdated: '2025-01-01T00:00:00.000Z',
      });

      await service.handleLivestockCensusCreated(payload);

      // Should set the species field with the population value
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'species:CATTLE',
        '18000000',
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );

      // Should fetch all fields to recalculate total
      expect(mockRedis.hGetAll).toHaveBeenCalledWith(key);

      // Should set totalPopulation as sum of all species:* fields (18M + 5M = 23M)
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'totalPopulation',
        '23000000',
      );
    });

    it('should handle a single species correctly', async () => {
      const key = DOMAIN_REDIS_KEYS.livestock('KE');

      mockRedis.hGetAll.mockResolvedValue({
        'species:CATTLE': '18000000',
        lastUpdated: '2025-06-01T00:00:00.000Z',
      });

      await service.handleLivestockCensusCreated(payload);

      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'totalPopulation',
        '18000000',
      );
    });
  });

  // ── Fisheries ──

  describe('handleFishCaptureRecorded', () => {
    const payload: FishCapturePayload = {
      id: 'capture-001',
      tenantId: 'tenant-tz',
      countryCode: 'TZ',
      speciesId: 'NILE_PERCH',
      quantityKg: 1250.5,
      gearType: 'GILLNET',
      landingSite: 'Mwanza',
    };

    it('should increment all counters', async () => {
      const key = DOMAIN_REDIS_KEYS.fisheries('TZ');

      await service.handleFishCaptureRecorded(payload);

      // Should increment totalCatchesKg
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'totalCatchesKg',
        1250.5,
      );

      // Should increment species-specific counter
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'species:NILE_PERCH',
        1250.5,
      );

      // Should increment method-specific counter
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'method:GILLNET',
        1250.5,
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );
    });
  });

  // ── Wildlife Crime ──

  describe('handleWildlifeCrimeReported', () => {
    const basePayload: WildlifeCrimePayload = {
      id: 'crime-001',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      crimeType: 'POACHING',
      speciesIds: ['ELEPHANT', 'RHINO'],
    };

    it('should track crimes by type and count unique species', async () => {
      const key = DOMAIN_REDIS_KEYS.wildlife('KE');

      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '5',
        'crimeType:POACHING': '3',
        'affectedSpecies:ELEPHANT': '1',
        'affectedSpecies:RHINO': '1',
        'affectedSpecies:LION': '1',
        lastUpdated: '2025-06-01T00:00:00.000Z',
      });

      await service.handleWildlifeCrimeReported(basePayload);

      // Should increment totalCrimes
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(key, 'totalCrimes', 1);

      // Should increment crimeType counter
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'crimeType:POACHING',
        1,
      );

      // Should set affected species flags
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'affectedSpecies:ELEPHANT',
        '1',
      );
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'affectedSpecies:RHINO',
        '1',
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );

      // Should recount unique species (3 unique: ELEPHANT, RHINO, LION)
      expect(mockRedis.hGetAll).toHaveBeenCalledWith(key);
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'speciesAffected',
        '3',
      );
    });

    it('should track protected area when provided', async () => {
      const key = DOMAIN_REDIS_KEYS.wildlife('KE');
      const payloadWithPA: WildlifeCrimePayload = {
        ...basePayload,
        protectedAreaId: 'pa-001',
        protectedAreaName: 'Tsavo National Park',
      };

      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '1',
        'crimeType:POACHING': '1',
        'affectedSpecies:ELEPHANT': '1',
        'affectedSpecies:RHINO': '1',
        'pa:Tsavo National Park': '1',
        lastUpdated: '2025-06-01T00:00:00.000Z',
      });

      await service.handleWildlifeCrimeReported(payloadWithPA);

      // Should increment protected area counter using name when available
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'pa:Tsavo National Park',
        1,
      );
    });

    it('should use protectedAreaId as key when protectedAreaName is not provided', async () => {
      const key = DOMAIN_REDIS_KEYS.wildlife('KE');
      const payloadWithPAIdOnly: WildlifeCrimePayload = {
        ...basePayload,
        protectedAreaId: 'pa-001',
      };

      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '1',
        'crimeType:POACHING': '1',
        'affectedSpecies:ELEPHANT': '1',
        'affectedSpecies:RHINO': '1',
        'pa:pa-001': '1',
        lastUpdated: '2025-06-01T00:00:00.000Z',
      });

      await service.handleWildlifeCrimeReported(payloadWithPAIdOnly);

      // Should fall back to protectedAreaId when name is not present
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'pa:pa-001',
        1,
      );
    });

    it('should NOT increment protected area counter when protectedAreaId is absent', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '1',
        'crimeType:POACHING': '1',
        'affectedSpecies:ELEPHANT': '1',
        'affectedSpecies:RHINO': '1',
        lastUpdated: '2025-06-01T00:00:00.000Z',
      });

      await service.handleWildlifeCrimeReported(basePayload);

      // hIncrBy should only be called for totalCrimes and crimeType, not for pa:*
      const paIncrCalls = mockRedis.hIncrBy.mock.calls.filter(
        ([, field]: [string, string, number]) => (field as string).startsWith('pa:'),
      );
      expect(paIncrCalls).toHaveLength(0);
    });
  });

  // ── Trade ──

  describe('handleTradeFlowCreated', () => {
    const exportPayload: TradeFlowPayload = {
      id: 'trade-001',
      tenantId: 'tenant-et',
      countryCode: 'ET',
      partnerCountryCode: 'DJ',
      flowDirection: 'EXPORT',
      commodity: 'LIVE_CATTLE',
      valueFob: 500000,
      currency: 'USD',
      quantity: 200,
      unit: 'heads',
    };

    const importPayload: TradeFlowPayload = {
      ...exportPayload,
      id: 'trade-002',
      flowDirection: 'IMPORT',
      valueFob: 150000,
    };

    it('should correctly handle EXPORT flow', async () => {
      const key = DOMAIN_REDIS_KEYS.trade('ET');

      mockRedis.hGetAll.mockResolvedValue({
        exports: '500000',
        imports: '100000',
      });

      await service.handleTradeFlowCreated(exportPayload);

      // Should increment exports
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'exports',
        500000,
      );

      // Should NOT increment imports
      const importCalls = mockRedis.hIncrByFloat.mock.calls.filter(
        ([, field]: [string, string, number]) => field === 'imports',
      );
      expect(importCalls).toHaveLength(0);

      // Should track partner volume
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'partner:DJ',
        500000,
      );
    });

    it('should correctly handle IMPORT flow', async () => {
      const key = DOMAIN_REDIS_KEYS.trade('ET');

      mockRedis.hGetAll.mockResolvedValue({
        exports: '500000',
        imports: '150000',
      });

      await service.handleTradeFlowCreated(importPayload);

      // Should increment imports
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'imports',
        150000,
      );

      // Should NOT increment exports
      const exportCalls = mockRedis.hIncrByFloat.mock.calls.filter(
        ([, field]: [string, string, number]) => field === 'exports',
      );
      expect(exportCalls).toHaveLength(0);

      // Should track partner volume
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'partner:DJ',
        150000,
      );
    });

    it('should recalculate balance as exports minus imports', async () => {
      const key = DOMAIN_REDIS_KEYS.trade('ET');

      mockRedis.hGetAll.mockResolvedValue({
        exports: '750000',
        imports: '200000',
      });

      await service.handleTradeFlowCreated(exportPayload);

      // Balance should be exports - imports = 750000 - 200000 = 550000
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'balance',
        '550000',
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );
    });

    it('should default valueFob to 0 when not provided', async () => {
      const key = DOMAIN_REDIS_KEYS.trade('ET');
      const noValuePayload: TradeFlowPayload = {
        ...exportPayload,
        valueFob: undefined,
      };

      mockRedis.hGetAll.mockResolvedValue({
        exports: '0',
        imports: '0',
      });

      await service.handleTradeFlowCreated(noValuePayload);

      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'exports',
        0,
      );
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'partner:DJ',
        0,
      );
    });

    it('should not increment exports or imports for TRANSIT flow', async () => {
      const key = DOMAIN_REDIS_KEYS.trade('ET');
      const transitPayload: TradeFlowPayload = {
        ...exportPayload,
        flowDirection: 'TRANSIT',
        valueFob: 100000,
      };

      mockRedis.hGetAll.mockResolvedValue({
        exports: '0',
        imports: '0',
      });

      await service.handleTradeFlowCreated(transitPayload);

      // Should not call hIncrByFloat for exports or imports
      const exportImportCalls = mockRedis.hIncrByFloat.mock.calls.filter(
        ([, field]: [string, string, number]) =>
          field === 'exports' || field === 'imports',
      );
      expect(exportImportCalls).toHaveLength(0);

      // Should still track partner volume
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'partner:DJ',
        100000,
      );
    });
  });

  // ── Climate ──

  describe('handleClimateHotspotDetected', () => {
    const payload: ClimateHotspotPayload = {
      id: 'hotspot-001',
      tenantId: 'tenant-ng',
      countryCode: 'NG',
      type: 'DROUGHT',
      severity: 'HIGH',
      geoEntityId: 'geo-lagos',
      affectedSpecies: ['CATTLE', 'GOAT'],
    };

    it('should increment all counters', async () => {
      const key = DOMAIN_REDIS_KEYS.climate('NG');

      await service.handleClimateHotspotDetected(payload);

      // Should increment activeHotspots
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'activeHotspots',
        1,
      );

      // Should increment severity counter
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'severity:HIGH',
        1,
      );

      // Should increment type counter
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'type:DROUGHT',
        1,
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );
    });
  });

  // ── Apiculture ──

  describe('handleApicultureProductionRecorded', () => {
    const payload: ApicultureProductionPayload = {
      id: 'apiary-prod-001',
      tenantId: 'tenant-et',
      countryCode: 'ET',
      apiaryId: 'apiary-42',
      quantityKg: 85.3,
      quality: 'GRADE_A',
      floralSource: 'ACACIA',
    };

    it('should increment all counters', async () => {
      const key = DOMAIN_REDIS_KEYS.apiculture('ET');

      await service.handleApicultureProductionRecorded(payload);

      // Should increment totalProductionKg
      expect(mockRedis.hIncrByFloat).toHaveBeenCalledWith(
        key,
        'totalProductionKg',
        85.3,
      );

      // Should increment harvestCount
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'harvestCount',
        1,
      );

      // Should increment quality counter
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'quality:GRADE_A',
        1,
      );

      // Should increment floral source counter
      expect(mockRedis.hIncrBy).toHaveBeenCalledWith(
        key,
        'floral:ACACIA',
        1,
      );

      // Should set lastUpdated
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        key,
        'lastUpdated',
        expect.any(String),
      );
    });
  });

  // ── Governance ──

  describe('handleGovernancePvsEvaluated', () => {
    const payload: GovernancePvsPayload = {
      id: 'pvs-001',
      tenantId: 'tenant-sn',
      countryCode: 'SN',
      evaluationType: 'INITIAL',
      overallScore: 3.7,
      year: 2025,
    };

    it('should store all fields via hMSet', async () => {
      const key = DOMAIN_REDIS_KEYS.governance('SN');

      await service.handleGovernancePvsEvaluated(payload);

      expect(mockRedis.hMSet).toHaveBeenCalledWith(key, {
        latestScore: '3.7',
        evaluationType: 'INITIAL',
        year: '2025',
        lastUpdated: expect.any(String),
      });
    });

    it('should not call hSet or hIncrBy', async () => {
      await service.handleGovernancePvsEvaluated(payload);

      expect(mockRedis.hSet).not.toHaveBeenCalled();
      expect(mockRedis.hIncrBy).not.toHaveBeenCalled();
      expect(mockRedis.hIncrByFloat).not.toHaveBeenCalled();
    });
  });

  // ── Redis key patterns ──

  describe('DOMAIN_REDIS_KEYS', () => {
    it('should produce correct key patterns for each domain', () => {
      expect(DOMAIN_REDIS_KEYS.livestock('KE')).toBe('analytics:livestock:KE');
      expect(DOMAIN_REDIS_KEYS.fisheries('TZ')).toBe('analytics:fisheries:TZ');
      expect(DOMAIN_REDIS_KEYS.trade('ET')).toBe('analytics:trade:ET');
      expect(DOMAIN_REDIS_KEYS.wildlife('KE')).toBe('analytics:wildlife:KE');
      expect(DOMAIN_REDIS_KEYS.climate('NG')).toBe('analytics:climate:NG');
      expect(DOMAIN_REDIS_KEYS.apiculture('ET')).toBe('analytics:apiculture:ET');
      expect(DOMAIN_REDIS_KEYS.governance('SN')).toBe('analytics:governance:SN');
    });
  });
});
