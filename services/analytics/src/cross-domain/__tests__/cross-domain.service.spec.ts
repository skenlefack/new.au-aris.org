import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrossDomainService } from '../cross-domain.service';
import { DOMAIN_REDIS_KEYS } from '../../domain-aggregation/domain-aggregation.service';
import { REDIS_KEYS } from '../../aggregation/aggregation.service';

const mockRedis = {
  hGetAll: vi.fn(),
  scanKeys: vi.fn(),
  hMSet: vi.fn(),
};

describe('CrossDomainService', () => {
  let service: CrossDomainService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockRedis.hGetAll.mockResolvedValue({});
    mockRedis.scanKeys.mockResolvedValue([]);
    mockRedis.hMSet.mockResolvedValue('OK');
    service = new CrossDomainService(mockRedis as any);
  });

  // ════════════════════════════════════════════════════════════════════
  // Correlation Engine
  // ════════════════════════════════════════════════════════════════════

  describe('correlateOutbreakClimate', () => {
    it('should return CRITICAL when active outbreaks >= 3 AND critical hotspots exist', async () => {
      // Climate data with critical hotspots
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '5', 'severity:CRITICAL': '2' };
        }
        // Each health key returns active outbreaks
        if (key === 'analytics:health:KE:FMD') {
          return { active: '2' };
        }
        if (key === 'analytics:health:KE:PPR') {
          return { active: '1' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue([
        'analytics:health:KE:FMD',
        'analytics:health:KE:PPR',
      ]);

      const result = await service.correlateOutbreakClimate('KE');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('OUTBREAK_CLIMATE');
      expect(result[0].severity).toBe('CRITICAL');
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].description).toContain('3 active outbreak(s)');
      expect(result[0].description).toContain('5 environmental hotspot(s)');
      expect(result[0].description).toContain('2 critical');
      expect(result[0].relatedEntities).toEqual([
        'analytics:health:KE:FMD',
        'analytics:health:KE:PPR',
      ]);
    });

    it('should return empty array when no hotspots exist (activeHotspots = 0)', async () => {
      mockRedis.hGetAll.mockResolvedValue({ activeHotspots: '0' });

      const result = await service.correlateOutbreakClimate('KE');

      expect(result).toHaveLength(0);
      // Should not even scan for health keys when there are no hotspots
      expect(mockRedis.scanKeys).not.toHaveBeenCalled();
    });

    it('should return empty array when activeHotspots field is missing', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.correlateOutbreakClimate('NG');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when hotspots exist but no active outbreaks', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '3', 'severity:HIGH': '1' };
        }
        return { active: '0' };
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:health:KE:FMD']);

      const result = await service.correlateOutbreakClimate('KE');

      expect(result).toHaveLength(0);
    });

    it('should return HIGH severity when active outbreaks >= 2 but no critical hotspots', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('NG')) {
          return { activeHotspots: '2' };
        }
        if (key === 'analytics:health:NG:FMD') {
          return { active: '2' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:health:NG:FMD']);

      const result = await service.correlateOutbreakClimate('NG');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('HIGH');
    });

    it('should return HIGH severity when hotspots >= 3 but active outbreaks < 2', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('NG')) {
          return { activeHotspots: '3' };
        }
        if (key === 'analytics:health:NG:FMD') {
          return { active: '1' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:health:NG:FMD']);

      const result = await service.correlateOutbreakClimate('NG');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('HIGH');
    });

    it('should return MEDIUM severity when 1 active outbreak and < 3 hotspots with no critical', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('ET')) {
          return { activeHotspots: '1' };
        }
        if (key === 'analytics:health:ET:RVF') {
          return { active: '1' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:health:ET:RVF']);

      const result = await service.correlateOutbreakClimate('ET');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('MEDIUM');
    });

    it('should return empty when health scan returns no keys', async () => {
      mockRedis.hGetAll.mockResolvedValue({ activeHotspots: '3', 'severity:CRITICAL': '1' });
      mockRedis.scanKeys.mockResolvedValue([]);

      const result = await service.correlateOutbreakClimate('KE');

      expect(result).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────

  describe('correlateTradeHealth', () => {
    it('should flag a trade partner with active outbreaks', async () => {
      // Trade data with one partner
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { 'partner:ET': '5000000', exports: '3000000', imports: '2000000' };
        }
        if (key === 'analytics:health:ET:FMD') {
          return { active: '3' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:ET:*') {
          return ['analytics:health:ET:FMD'];
        }
        return [];
      });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('TRADE_HEALTH');
      expect(result[0].severity).toBe('HIGH'); // 3 active >= 3
      expect(result[0].description).toContain('Trade partner ET');
      expect(result[0].description).toContain('3 active outbreak(s)');
      expect(result[0].description).toContain('FMD');
      expect(result[0].description).toContain('$5000000');
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].relatedEntities).toContain('trade:ET');
      expect(result[0].relatedEntities).toContain('analytics:health:ET:FMD');
    });

    it('should return empty when no partners have outbreaks', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { 'partner:NG': '2000000', 'partner:ET': '3000000' };
        }
        return { active: '0' };
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:NG:*') {
          return ['analytics:health:NG:FMD'];
        }
        if (pattern === 'analytics:health:ET:*') {
          return ['analytics:health:ET:PPR'];
        }
        return [];
      });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(0);
    });

    it('should return empty when trade data has no partner fields', async () => {
      mockRedis.hGetAll.mockResolvedValue({ exports: '1000', imports: '500', balance: '500' });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(0);
      // scanKeys should not be called since there are no partners
      expect(mockRedis.scanKeys).not.toHaveBeenCalled();
    });

    it('should return CRITICAL severity when partner has >= 5 active outbreaks', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { 'partner:NG': '10000000' };
        }
        if (key === 'analytics:health:NG:FMD') {
          return { active: '3' };
        }
        if (key === 'analytics:health:NG:PPR') {
          return { active: '3' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:NG:*') {
          return ['analytics:health:NG:FMD', 'analytics:health:NG:PPR'];
        }
        return [];
      });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('CRITICAL'); // 6 >= 5
    });

    it('should return MEDIUM severity when partner has 1-2 active outbreaks', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { 'partner:ET': '1000000' };
        }
        if (key === 'analytics:health:ET:FMD') {
          return { active: '1' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:ET:*') {
          return ['analytics:health:ET:FMD'];
        }
        return [];
      });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('MEDIUM');
    });

    it('should flag multiple partners independently', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { 'partner:NG': '5000000', 'partner:ET': '3000000' };
        }
        if (key === 'analytics:health:NG:FMD') {
          return { active: '2' };
        }
        if (key === 'analytics:health:ET:PPR') {
          return { active: '1' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:NG:*') {
          return ['analytics:health:NG:FMD'];
        }
        if (pattern === 'analytics:health:ET:*') {
          return ['analytics:health:ET:PPR'];
        }
        return [];
      });

      const result = await service.correlateTradeHealth('KE');

      expect(result).toHaveLength(2);
      const partners = result.map((r) => r.description);
      expect(partners.some((d) => d.includes('NG'))).toBe(true);
      expect(partners.some((d) => d.includes('ET'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────

  describe('correlateLivestockVaccination', () => {
    it('should flag diseases with vaccination coverage < 70%', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000', 'species:cattle': '3000000', 'species:goat': '2000000' };
        }
        if (key === 'analytics:vaccination:KE:FMD') {
          return { coverage: '45.5' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:vaccination:KE:FMD']);

      const result = await service.correlateLivestockVaccination('KE');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('LIVESTOCK_VACCINATION');
      expect(result[0].severity).toBe('HIGH'); // 45.5 < 55 => HIGH
      expect(result[0].description).toContain('FMD');
      expect(result[0].description).toContain('coverage 45.5%');
      expect(result[0].description).toContain('gap of 24.5pp');
      expect(result[0].description).toContain('5,000,000');
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].relatedEntities).toContain('analytics:vaccination:KE:FMD');
      expect(result[0].relatedEntities).toContain(DOMAIN_REDIS_KEYS.livestock('KE'));
    });

    it('should return empty when no livestock data exists (totalPopulation = 0)', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.correlateLivestockVaccination('KE');

      expect(result).toHaveLength(0);
      // Should not scan for vaccination keys when there is no population
      expect(mockRedis.scanKeys).not.toHaveBeenCalled();
    });

    it('should return empty when totalPopulation is explicitly 0', async () => {
      mockRedis.hGetAll.mockResolvedValue({ totalPopulation: '0' });

      const result = await service.correlateLivestockVaccination('KE');

      expect(result).toHaveLength(0);
    });

    it('should return CRITICAL severity when coverage < 40%', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('NG')) {
          return { totalPopulation: '10000000' };
        }
        if (key === 'analytics:vaccination:NG:PPR') {
          return { coverage: '25' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:vaccination:NG:PPR']);

      const result = await service.correlateLivestockVaccination('NG');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('CRITICAL');
    });

    it('should return MEDIUM severity when coverage is between 55% and 70%', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('ET')) {
          return { totalPopulation: '8000000' };
        }
        if (key === 'analytics:vaccination:ET:FMD') {
          return { coverage: '60' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:vaccination:ET:FMD']);

      const result = await service.correlateLivestockVaccination('ET');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('MEDIUM');
    });

    it('should not flag diseases with coverage >= 70%', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000' };
        }
        if (key === 'analytics:vaccination:KE:FMD') {
          return { coverage: '80' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:vaccination:KE:FMD']);

      const result = await service.correlateLivestockVaccination('KE');

      expect(result).toHaveLength(0);
    });

    it('should not flag diseases with coverage = 0 (no vaccination data)', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000' };
        }
        // Vaccination data has coverage = 0 or missing
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue(['analytics:vaccination:KE:FMD']);

      const result = await service.correlateLivestockVaccination('KE');

      // coverage is 0, condition is coverage < 70 AND coverage > 0, so this should not flag
      expect(result).toHaveLength(0);
    });

    it('should flag multiple diseases independently', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000' };
        }
        if (key === 'analytics:vaccination:KE:FMD') {
          return { coverage: '30' };
        }
        if (key === 'analytics:vaccination:KE:PPR') {
          return { coverage: '60' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue([
        'analytics:vaccination:KE:FMD',
        'analytics:vaccination:KE:PPR',
      ]);

      const result = await service.correlateLivestockVaccination('KE');

      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe('CRITICAL'); // 30 < 40
      expect(result[1].severity).toBe('MEDIUM');   // 60 >= 55 but < 70
    });
  });

  // ────────────────────────────────────────────────────────────────────

  describe('correlateWildlifeCrime', () => {
    it('should flag protected areas with >= 3 crimes', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '8',
        speciesAffected: '5',
        'pa:Serengeti': '4',
        'pa:Masai Mara': '2',
        'pa:Tsavo': '3',
        'crimeType:POACHING': '6',
      });

      const result = await service.correlateWildlifeCrime('KE');

      // Serengeti (4 >= 3) and Tsavo (3 >= 3) should be flagged, Masai Mara (2 < 3) not
      expect(result).toHaveLength(2);

      const paNames = result.map((r) => r.description);
      expect(paNames.some((d) => d.includes('Serengeti'))).toBe(true);
      expect(paNames.some((d) => d.includes('Tsavo'))).toBe(true);

      // Serengeti: 4 crimes => MEDIUM (< 5)
      const serengeti = result.find((r) => r.description.includes('Serengeti'))!;
      expect(serengeti.type).toBe('WILDLIFE_CRIME');
      expect(serengeti.severity).toBe('MEDIUM');
      expect(serengeti.description).toContain('4 wildlife crime(s)');
      expect(serengeti.description).toContain('5 species affected');
      expect(serengeti.countryCode).toBe('KE');
    });

    it('should return empty when totalCrimes is 0', async () => {
      mockRedis.hGetAll.mockResolvedValue({ totalCrimes: '0' });

      const result = await service.correlateWildlifeCrime('KE');

      expect(result).toHaveLength(0);
    });

    it('should return empty when no wildlife data exists', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.correlateWildlifeCrime('KE');

      expect(result).toHaveLength(0);
    });

    it('should return HIGH severity when PA has >= 5 crimes but < 10', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '7',
        speciesAffected: '3',
        'pa:Kruger': '7',
      });

      const result = await service.correlateWildlifeCrime('ZA');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('HIGH');
    });

    it('should return CRITICAL severity when PA has >= 10 crimes', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '15',
        speciesAffected: '8',
        'pa:Virunga': '12',
      });

      const result = await service.correlateWildlifeCrime('CD');

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('CRITICAL');
    });

    it('should not flag protected areas with < 3 crimes even when totalCrimes > 0', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '4',
        speciesAffected: '2',
        'pa:ParkA': '2',
        'pa:ParkB': '2',
      });

      const result = await service.correlateWildlifeCrime('TZ');

      expect(result).toHaveLength(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // getCorrelations (orchestrator)
  // ════════════════════════════════════════════════════════════════════

  describe('getCorrelations', () => {
    it('should aggregate correlations from all four engines for a single country', async () => {
      // Set up a scenario where each correlation engine finds something
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '2' };
        }
        if (key === 'analytics:health:KE:FMD') {
          return { active: '1' };
        }
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return {}; // no partners
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return {}; // no population
        }
        if (key === DOMAIN_REDIS_KEYS.wildlife('KE')) {
          return {}; // no crimes
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === `analytics:health:KE:*`) {
          return ['analytics:health:KE:FMD'];
        }
        return [];
      });

      const result = await service.getCorrelations('KE');

      expect(result.correlations.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBe(result.correlations.length);
      expect(result.lastUpdated).toBeTruthy();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Risk Score
  // ════════════════════════════════════════════════════════════════════

  describe('getRiskScore', () => {
    it('should calculate weighted composite score correctly and assign proper riskLevel', async () => {
      // Health: 3 active outbreaks on one disease, 10 deaths => score = min(100, 3*10 + min(10*0.5, 50)) = min(100, 30+5) = 35
      // Climate: 2 critical, 1 high, 4 hotspots => score = min(100, 2*25 + 1*15 + 4*5) = min(100, 50+15+20) = 85
      // Trade: balance = -2000000 => score = min(100, 2000000/1000000) = 2
      // Wildlife: 5 crimes, 3 species => score = min(100, 5*8 + 3*5) = min(100, 40+15) = 55
      // Governance: pvsScore = 60 => score = max(0, 100-60) = 40
      // Livestock: no vaccination data => coverageGap = 30, score = min(100, 30*1.4) = 42

      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === 'analytics:health:KE:FMD') {
          return { active: '3', deaths: '10' };
        }
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '4', 'severity:CRITICAL': '2', 'severity:HIGH': '1' };
        }
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { balance: '-2000000' };
        }
        if (key === DOMAIN_REDIS_KEYS.wildlife('KE')) {
          return { totalCrimes: '5', speciesAffected: '3' };
        }
        if (key === DOMAIN_REDIS_KEYS.governance('KE')) {
          return { latestScore: '60' };
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '1000000' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:KE:*') {
          return ['analytics:health:KE:FMD'];
        }
        if (pattern === 'analytics:vaccination:KE:*') {
          return []; // No vaccination data
        }
        return [];
      });

      const result = await service.getRiskScore('KE');

      // Verify components
      expect(result.countryCode).toBe('KE');
      expect(result.components).toHaveLength(6);

      const healthComp = result.components.find((c) => c.domain === 'health')!;
      expect(healthComp.score).toBe(35); // 3*10 + min(10*0.5, 50) = 35
      expect(healthComp.weight).toBe(0.30);

      const climateComp = result.components.find((c) => c.domain === 'climate')!;
      expect(climateComp.score).toBe(85); // 2*25 + 1*15 + 4*5 = 85
      expect(climateComp.weight).toBe(0.20);

      const tradeComp = result.components.find((c) => c.domain === 'trade')!;
      expect(tradeComp.score).toBe(2); // 2000000/1000000 = 2
      expect(tradeComp.weight).toBe(0.15);

      const wildlifeComp = result.components.find((c) => c.domain === 'wildlife')!;
      expect(wildlifeComp.score).toBe(55); // 5*8 + 3*5 = 55
      expect(wildlifeComp.weight).toBe(0.10);

      const govComp = result.components.find((c) => c.domain === 'governance')!;
      expect(govComp.score).toBe(40); // 100 - 60 = 40
      expect(govComp.weight).toBe(0.15);

      const livestockComp = result.components.find((c) => c.domain === 'livestock')!;
      expect(livestockComp.score).toBe(42); // gap=30, 30*1.4 = 42
      expect(livestockComp.weight).toBe(0.10);

      // Composite = 35*0.30 + 85*0.20 + 2*0.15 + 55*0.10 + 40*0.15 + 42*0.10
      //           = 10.5 + 17 + 0.3 + 5.5 + 6 + 4.2 = 43.5
      const expected = Math.round(
        (35 * 0.30 + 85 * 0.20 + 2 * 0.15 + 55 * 0.10 + 40 * 0.15 + 42 * 0.10) * 100,
      ) / 100;
      expect(result.compositeScore).toBe(expected);
      expect(result.riskLevel).toBe('MEDIUM'); // 25 <= 43.5 < 50

      // Verify it was stored in Redis
      expect(mockRedis.hMSet).toHaveBeenCalledWith(
        DOMAIN_REDIS_KEYS.risk('KE'),
        expect.objectContaining({
          compositeScore: String(expected),
          riskLevel: 'MEDIUM',
        }),
      );
    });

    it('should return LOW riskLevel for a country with no data', async () => {
      // All hGetAll return empty, all scanKeys return empty
      mockRedis.hGetAll.mockResolvedValue({});
      mockRedis.scanKeys.mockResolvedValue([]);

      const result = await service.getRiskScore('XX');

      expect(result.countryCode).toBe('XX');

      // Health: no keys => score = 0
      const healthComp = result.components.find((c) => c.domain === 'health')!;
      expect(healthComp.score).toBe(0);

      // Climate: no data => score = 0
      const climateComp = result.components.find((c) => c.domain === 'climate')!;
      expect(climateComp.score).toBe(0);

      // Trade: no balance => score = 0
      const tradeComp = result.components.find((c) => c.domain === 'trade')!;
      expect(tradeComp.score).toBe(0);

      // Wildlife: no data => score = 0
      const wildlifeComp = result.components.find((c) => c.domain === 'wildlife')!;
      expect(wildlifeComp.score).toBe(0);

      // Governance: no PVS => defaults to 50
      const govComp = result.components.find((c) => c.domain === 'governance')!;
      expect(govComp.score).toBe(50);
      expect(govComp.factors).toContain('No PVS data');

      // Livestock: no vacc data => coverageGap=30, score = min(100, 30*1.4) = 42
      const livestockComp = result.components.find((c) => c.domain === 'livestock')!;
      expect(livestockComp.score).toBe(42);

      // Composite = 0*0.30 + 0*0.20 + 0*0.15 + 0*0.10 + 50*0.15 + 42*0.10
      //           = 0 + 0 + 0 + 0 + 7.5 + 4.2 = 11.7
      const expected = Math.round((50 * 0.15 + 42 * 0.10) * 100) / 100;
      expect(result.compositeScore).toBe(expected);
      expect(result.riskLevel).toBe('LOW'); // 11.7 < 25
    });

    it('should return CRITICAL riskLevel when composite >= 75', async () => {
      // Set up very high scores across all domains
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key.startsWith('analytics:health:')) {
          return { active: '10', deaths: '100' };
        }
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '20', 'severity:CRITICAL': '4', 'severity:HIGH': '5' };
        }
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { balance: '-500000000' };
        }
        if (key === DOMAIN_REDIS_KEYS.wildlife('KE')) {
          return { totalCrimes: '50', speciesAffected: '20' };
        }
        if (key === DOMAIN_REDIS_KEYS.governance('KE')) {
          return {}; // no PVS => defaults to 50
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '10000000' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:KE:*') {
          return ['analytics:health:KE:FMD'];
        }
        if (pattern === 'analytics:vaccination:KE:*') {
          return []; // No vaccination => high livestock risk
        }
        return [];
      });

      const result = await service.getRiskScore('KE');

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.compositeScore).toBeGreaterThanOrEqual(75);
    });

    it('should return HIGH riskLevel when composite is between 50 and 74', async () => {
      // Moderate-high scores
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key.startsWith('analytics:health:')) {
          return { active: '5', deaths: '20' };
        }
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '5', 'severity:CRITICAL': '2', 'severity:HIGH': '2' };
        }
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { balance: '-50000000' };
        }
        if (key === DOMAIN_REDIS_KEYS.wildlife('KE')) {
          return { totalCrimes: '8', speciesAffected: '4' };
        }
        if (key === DOMAIN_REDIS_KEYS.governance('KE')) {
          return { latestScore: '30' }; // Low PVS = high risk (100-30=70)
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:KE:*') {
          return ['analytics:health:KE:FMD'];
        }
        if (pattern === 'analytics:vaccination:KE:*') {
          return [];
        }
        return [];
      });

      const result = await service.getRiskScore('KE');

      // Health: min(100, 5*10 + min(20*0.5, 50)) = min(100, 50+10) = 60
      // Climate: min(100, 2*25 + 2*15 + 5*5) = min(100, 50+30+25) = 100
      // Trade: min(100, 50000000/1000000) = 50
      // Wildlife: min(100, 8*8 + 4*5) = min(100, 64+20) = 84
      // Governance: 100-30 = 70
      // Livestock: 42 (no vacc data)
      // Composite = 60*0.30 + 100*0.20 + 50*0.15 + 84*0.10 + 70*0.15 + 42*0.10
      //           = 18 + 20 + 7.5 + 8.4 + 10.5 + 4.2 = 68.6
      expect(result.riskLevel).toBe('HIGH');
      expect(result.compositeScore).toBeGreaterThanOrEqual(50);
      expect(result.compositeScore).toBeLessThan(75);
    });

    it('should store risk score in Redis', async () => {
      mockRedis.hGetAll.mockResolvedValue({});
      mockRedis.scanKeys.mockResolvedValue([]);

      await service.getRiskScore('KE');

      expect(mockRedis.hMSet).toHaveBeenCalledWith(
        DOMAIN_REDIS_KEYS.risk('KE'),
        expect.objectContaining({
          compositeScore: expect.any(String),
          riskLevel: expect.any(String),
          lastUpdated: expect.any(String),
        }),
      );
    });

    it('should include factors for each risk component', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === 'analytics:health:KE:FMD') {
          return { active: '3', deaths: '5' };
        }
        if (key === DOMAIN_REDIS_KEYS.climate('KE')) {
          return { activeHotspots: '2', 'severity:CRITICAL': '1' };
        }
        if (key === DOMAIN_REDIS_KEYS.trade('KE')) {
          return { balance: '-1500000' };
        }
        if (key === DOMAIN_REDIS_KEYS.wildlife('KE')) {
          return { totalCrimes: '3', speciesAffected: '2' };
        }
        if (key === DOMAIN_REDIS_KEYS.governance('KE')) {
          return { latestScore: '75' };
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '2000000' };
        }
        if (key === 'analytics:vaccination:KE:FMD') {
          return { coverage: '50' };
        }
        return {};
      });

      mockRedis.scanKeys.mockImplementation(async (pattern: string) => {
        if (pattern === 'analytics:health:KE:*') return ['analytics:health:KE:FMD'];
        if (pattern === 'analytics:vaccination:KE:*') return ['analytics:vaccination:KE:FMD'];
        return [];
      });

      const result = await service.getRiskScore('KE');

      const healthComp = result.components.find((c) => c.domain === 'health')!;
      expect(healthComp.factors.length).toBeGreaterThan(0);
      expect(healthComp.factors.some((f) => f.includes('FMD'))).toBe(true);

      const climateComp = result.components.find((c) => c.domain === 'climate')!;
      expect(climateComp.factors).toContain('2 hotspot(s)');
      expect(climateComp.factors).toContain('1 critical');

      const tradeComp = result.components.find((c) => c.domain === 'trade')!;
      expect(tradeComp.factors.some((f) => f.includes('Trade deficit'))).toBe(true);

      const wildlifeComp = result.components.find((c) => c.domain === 'wildlife')!;
      expect(wildlifeComp.factors).toContain('3 crime(s)');
      expect(wildlifeComp.factors).toContain('2 species affected');

      const govComp = result.components.find((c) => c.domain === 'governance')!;
      expect(govComp.factors).toContain('PVS score: 75');

      const livestockComp = result.components.find((c) => c.domain === 'livestock')!;
      expect(livestockComp.factors.some((f) => f.includes('2,000,000'))).toBe(true);
      expect(livestockComp.factors.some((f) => f.includes('Avg vaccination coverage'))).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Individual Risk Component Calculations
  // ════════════════════════════════════════════════════════════════════

  describe('calculateHealthRisk', () => {
    it('should cap score at 100', async () => {
      mockRedis.scanKeys.mockResolvedValue(['analytics:health:KE:FMD']);
      mockRedis.hGetAll.mockResolvedValue({ active: '20', deaths: '200' });

      const result = await service.calculateHealthRisk('KE');

      // 20*10 + min(200*0.5, 50) = 200+50 = 250 => capped at 100
      expect(result.score).toBe(100);
    });
  });

  describe('calculateGovernanceRisk', () => {
    it('should assign score 50 when no PVS data exists', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.calculateGovernanceRisk('XX');

      expect(result.score).toBe(50);
      expect(result.factors).toContain('No PVS data');
    });

    it('should invert PVS score (high PVS = low risk)', async () => {
      mockRedis.hGetAll.mockResolvedValue({ latestScore: '90' });

      const result = await service.calculateGovernanceRisk('KE');

      expect(result.score).toBe(10); // 100 - 90
    });
  });

  describe('calculateLivestockRisk', () => {
    it('should compute risk based on average vaccination coverage gap', async () => {
      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000' };
        }
        if (key === 'analytics:vaccination:KE:FMD') {
          return { coverage: '50' };
        }
        if (key === 'analytics:vaccination:KE:PPR') {
          return { coverage: '60' };
        }
        return {};
      });

      mockRedis.scanKeys.mockResolvedValue([
        'analytics:vaccination:KE:FMD',
        'analytics:vaccination:KE:PPR',
      ]);

      const result = await service.calculateLivestockRisk('KE');

      // avgCoverage = (50 + 60) / 2 = 55
      // coverageGap = 70 - 55 = 15
      // score = min(100, 15 * 1.4) = 21
      expect(result.score).toBe(21);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Domain Query Methods
  // ════════════════════════════════════════════════════════════════════

  describe('getLivestockPopulation', () => {
    it('should return parsed data from Redis with species breakdown', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalPopulation: '5000000',
        'species:cattle': '3000000',
        'species:goat': '1500000',
        'species:sheep': '500000',
        lastUpdated: '2026-01-15T10:00:00Z',
      });

      const result = await service.getLivestockPopulation('KE');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].totalPopulation).toBe(5000000);
      expect(result[0].bySpecies).toEqual({
        cattle: 3000000,
        goat: 1500000,
        sheep: 500000,
      });
      expect(result[0].lastUpdated).toBe('2026-01-15T10:00:00Z');
    });

    it('should return empty species breakdown when no species fields exist', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalPopulation: '1000',
        lastUpdated: '2026-01-01T00:00:00Z',
      });

      const result = await service.getLivestockPopulation('NG');

      expect(result).toHaveLength(1);
      expect(result[0].bySpecies).toEqual({});
      expect(result[0].totalPopulation).toBe(1000);
    });

    it('should discover countries and return multiple results when no country filter', async () => {
      mockRedis.scanKeys.mockResolvedValue([
        'analytics:livestock:KE',
        'analytics:livestock:NG',
      ]);

      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.livestock('KE')) {
          return { totalPopulation: '5000000', 'species:cattle': '3000000', lastUpdated: '2026-01-10' };
        }
        if (key === DOMAIN_REDIS_KEYS.livestock('NG')) {
          return { totalPopulation: '8000000', 'species:cattle': '6000000', lastUpdated: '2026-01-12' };
        }
        return {};
      });

      const result = await service.getLivestockPopulation();

      expect(result).toHaveLength(2);
      expect(result[0].countryCode).toBe('KE');
      expect(result[1].countryCode).toBe('NG');
    });

    it('should return zero totalPopulation when field is missing', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.getLivestockPopulation('XX');

      expect(result).toHaveLength(1);
      expect(result[0].totalPopulation).toBe(0);
      expect(result[0].lastUpdated).toBe('');
    });
  });

  describe('getTradeBalance', () => {
    it('should return parsed data with sorted trade partners', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        exports: '5000000',
        imports: '3000000',
        balance: '2000000',
        'partner:ET': '2000000',
        'partner:NG': '4000000',
        'partner:ZA': '1000000',
        lastUpdated: '2026-01-20T08:00:00Z',
      });

      const result = await service.getTradeBalance('KE');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].exports).toBe(5000000);
      expect(result[0].imports).toBe(3000000);
      expect(result[0].balance).toBe(2000000);
      expect(result[0].lastUpdated).toBe('2026-01-20T08:00:00Z');

      // Partners should be sorted by value descending
      expect(result[0].topPartners).toEqual([
        { country: 'NG', value: 4000000 },
        { country: 'ET', value: 2000000 },
        { country: 'ZA', value: 1000000 },
      ]);
    });

    it('should limit topPartners to 10 entries', async () => {
      const tradeData: Record<string, string> = {
        exports: '10000000',
        imports: '5000000',
        balance: '5000000',
        lastUpdated: '2026-01-20',
      };
      // Create 15 partner entries
      for (let i = 0; i < 15; i++) {
        tradeData[`partner:P${String(i).padStart(2, '0')}`] = String((15 - i) * 100000);
      }

      mockRedis.hGetAll.mockResolvedValue(tradeData);

      const result = await service.getTradeBalance('KE');

      expect(result[0].topPartners).toHaveLength(10);
      // First partner should have the highest value
      expect(result[0].topPartners[0].value).toBe(1500000);
    });

    it('should return empty topPartners when no partner fields exist', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        exports: '1000',
        imports: '500',
        balance: '500',
        lastUpdated: '2026-01-01',
      });

      const result = await service.getTradeBalance('NG');

      expect(result[0].topPartners).toEqual([]);
    });

    it('should default to zero values when Redis has empty data', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.getTradeBalance('XX');

      expect(result[0].exports).toBe(0);
      expect(result[0].imports).toBe(0);
      expect(result[0].balance).toBe(0);
      expect(result[0].topPartners).toEqual([]);
    });
  });

  describe('getPvsScores', () => {
    it('should return PVS scores when data exists', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        latestScore: '72.5',
        evaluationType: 'FULL',
        year: '2025',
        lastUpdated: '2026-01-15T10:00:00Z',
      });

      const result = await service.getPvsScores('KE');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].latestScore).toBe(72.5);
      expect(result[0].evaluationType).toBe('FULL');
      expect(result[0].year).toBe(2025);
      expect(result[0].lastUpdated).toBe('2026-01-15T10:00:00Z');
    });

    it('should return empty array when no PVS data exists', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.getPvsScores('XX');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when latestScore field is missing', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        evaluationType: 'FOLLOW_UP',
        year: '2024',
      });

      const result = await service.getPvsScores('NG');

      expect(result).toHaveLength(0);
    });

    it('should discover countries and return multiple scores when no filter', async () => {
      mockRedis.scanKeys.mockResolvedValue([
        'analytics:governance:KE',
        'analytics:governance:NG',
      ]);

      mockRedis.hGetAll.mockImplementation(async (key: string) => {
        if (key === DOMAIN_REDIS_KEYS.governance('KE')) {
          return { latestScore: '80', evaluationType: 'FULL', year: '2025', lastUpdated: '2026-01-10' };
        }
        if (key === DOMAIN_REDIS_KEYS.governance('NG')) {
          return { latestScore: '65', evaluationType: 'FOLLOW_UP', year: '2024', lastUpdated: '2026-01-12' };
        }
        return {};
      });

      const result = await service.getPvsScores();

      expect(result).toHaveLength(2);
    });
  });

  describe('getFisheriesCatches', () => {
    it('should return parsed fisheries data with species and method breakdown', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCatchesKg: '150000.5',
        'species:tilapia': '80000',
        'species:catfish': '70000.5',
        'method:gillnet': '100000',
        'method:trawl': '50000.5',
        lastUpdated: '2026-01-18T12:00:00Z',
      });

      const result = await service.getFisheriesCatches('KE');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('KE');
      expect(result[0].totalCatchesKg).toBe(150000.5);
      expect(result[0].bySpecies).toEqual({
        tilapia: 80000,
        catfish: 70000.5,
      });
      expect(result[0].byMethod).toEqual({
        gillnet: 100000,
        trawl: 50000.5,
      });
      expect(result[0].lastUpdated).toBe('2026-01-18T12:00:00Z');
    });
  });

  describe('getWildlifeCrimeTrends', () => {
    it('should return crime data with type and protected area breakdowns', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        totalCrimes: '15',
        speciesAffected: '8',
        'crimeType:POACHING': '10',
        'crimeType:TRAFFICKING': '5',
        'pa:Serengeti': '7',
        'pa:Ngorongoro': '3',
        lastUpdated: '2026-02-01T09:00:00Z',
      });

      const result = await service.getWildlifeCrimeTrends('TZ');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('TZ');
      expect(result[0].totalCrimes).toBe(15);
      expect(result[0].speciesAffected).toBe(8);
      expect(result[0].byCrimeType).toEqual({
        POACHING: 10,
        TRAFFICKING: 5,
      });
      expect(result[0].byProtectedArea).toEqual({
        Serengeti: 7,
        Ngorongoro: 3,
      });
    });
  });

  describe('getClimateAlerts', () => {
    it('should return climate alerts with severity and type breakdowns', async () => {
      mockRedis.hGetAll.mockResolvedValue({
        activeHotspots: '6',
        'severity:CRITICAL': '2',
        'severity:HIGH': '3',
        'severity:MEDIUM': '1',
        'type:DROUGHT': '4',
        'type:FLOOD': '2',
        lastUpdated: '2026-02-10T14:00:00Z',
      });

      const result = await service.getClimateAlerts('ET');

      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('ET');
      expect(result[0].activeHotspots).toBe(6);
      expect(result[0].bySeverity).toEqual({
        CRITICAL: 2,
        HIGH: 3,
        MEDIUM: 1,
      });
      expect(result[0].byType).toEqual({
        DROUGHT: 4,
        FLOOD: 2,
      });
    });

    it('should return zero hotspots and empty breakdowns for empty data', async () => {
      mockRedis.hGetAll.mockResolvedValue({});

      const result = await service.getClimateAlerts('XX');

      expect(result).toHaveLength(1);
      expect(result[0].activeHotspots).toBe(0);
      expect(result[0].bySeverity).toEqual({});
      expect(result[0].byType).toEqual({});
    });
  });
});
