import type { RedisClient } from './redis-client';
import { REDIS_KEYS } from './aggregation.service';
import { DOMAIN_REDIS_KEYS } from './domain-aggregation.service';
import type {
  Correlation,
  CorrelationsResponse,
  CountryRiskScore,
  RiskComponent,
  LivestockPopulation,
  FisheriesCatches,
  TradeBalance,
  WildlifeCrimeTrends,
  ClimateAlert,
  PvsScoreEntry,
  ContinentalKpiResponse,
  KpiCard,
} from '../dto/cross-domain.dto';

// ── Risk score weights ──
const RISK_WEIGHTS = {
  health: 0.30,
  climate: 0.20,
  trade: 0.15,
  wildlife: 0.10,
  governance: 0.15,
  livestock: 0.10,
} as const;

export class CrossDomainService {
  constructor(private readonly redis: RedisClient) {}

  // ── Correlation Engine ──

  async getCorrelations(countryCode?: string): Promise<CorrelationsResponse> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountries();

    const correlations: Correlation[] = [];

    for (const cc of countries) {
      const [
        outbreakClimate,
        tradeHealth,
        livestockVacc,
        wildlifeCrime,
      ] = await Promise.all([
        this.correlateOutbreakClimate(cc),
        this.correlateTradeHealth(cc),
        this.correlateLivestockVaccination(cc),
        this.correlateWildlifeCrime(cc),
      ]);

      correlations.push(...outbreakClimate, ...tradeHealth, ...livestockVacc, ...wildlifeCrime);
    }

    return {
      correlations,
      total: correlations.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /** Outbreak + Climate: correlate active outbreaks with environmental hotspots */
  async correlateOutbreakClimate(countryCode: string): Promise<Correlation[]> {
    const results: Correlation[] = [];
    const climateData = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.climate(countryCode));
    const activeHotspots = parseInt(climateData['activeHotspots'] ?? '0', 10);
    const criticalHotspots = parseInt(climateData['severity:CRITICAL'] ?? '0', 10);

    if (activeHotspots === 0) return results;

    // Check for active health events in same country
    const healthKeys = await this.redis.scanKeys(`analytics:health:${countryCode}:*`);
    let totalActive = 0;
    for (const key of healthKeys) {
      const data = await this.redis.hGetAll(key);
      totalActive += parseInt(data['active'] ?? '0', 10);
    }

    if (totalActive > 0 && activeHotspots > 0) {
      const severity = criticalHotspots > 0 && totalActive >= 3
        ? 'CRITICAL'
        : totalActive >= 2 || activeHotspots >= 3
          ? 'HIGH'
          : 'MEDIUM';

      results.push({
        id: `corr:oc:${countryCode}:${Date.now()}`,
        type: 'OUTBREAK_CLIMATE',
        severity,
        description:
          `${totalActive} active outbreak(s) coincide with ${activeHotspots} environmental hotspot(s)` +
          (criticalHotspots > 0 ? ` (${criticalHotspots} critical)` : '') +
          ` in ${countryCode}`,
        countryCode,
        relatedEntities: healthKeys,
        detectedAt: new Date().toISOString(),
      });
    }

    return results;
  }

  /** Trade + Health: flag trade flows from countries with active outbreaks */
  async correlateTradeHealth(countryCode: string): Promise<Correlation[]> {
    const results: Correlation[] = [];
    const tradeData = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.trade(countryCode));

    // Find partner countries from trade data
    const partners: string[] = [];
    for (const field of Object.keys(tradeData)) {
      if (field.startsWith('partner:')) {
        partners.push(field.replace('partner:', ''));
      }
    }

    // Check which partners have active outbreaks
    for (const partner of partners) {
      const partnerHealthKeys = await this.redis.scanKeys(`analytics:health:${partner}:*`);
      let partnerActiveOutbreaks = 0;
      const diseases: string[] = [];

      for (const key of partnerHealthKeys) {
        const data = await this.redis.hGetAll(key);
        const active = parseInt(data['active'] ?? '0', 10);
        if (active > 0) {
          partnerActiveOutbreaks += active;
          const disease = key.split(':').pop() ?? 'unknown';
          diseases.push(disease);
        }
      }

      if (partnerActiveOutbreaks > 0) {
        const tradeValue = parseFloat(tradeData[`partner:${partner}`] ?? '0');
        const severity = partnerActiveOutbreaks >= 5
          ? 'CRITICAL'
          : partnerActiveOutbreaks >= 3
            ? 'HIGH'
            : 'MEDIUM';

        results.push({
          id: `corr:th:${countryCode}:${partner}:${Date.now()}`,
          type: 'TRADE_HEALTH',
          severity,
          description:
            `Trade partner ${partner} has ${partnerActiveOutbreaks} active outbreak(s) ` +
            `(${diseases.join(', ')}) with trade value $${tradeValue.toFixed(0)}`,
          countryCode,
          relatedEntities: [`trade:${partner}`, ...partnerHealthKeys],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /** Livestock + Vaccination: calculate herd immunity gaps */
  async correlateLivestockVaccination(countryCode: string): Promise<Correlation[]> {
    const results: Correlation[] = [];
    const livestockData = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.livestock(countryCode));
    const totalPop = parseInt(livestockData['totalPopulation'] ?? '0', 10);
    if (totalPop === 0) return results;

    // Check vaccination coverage across diseases
    const vaccKeys = await this.redis.scanKeys(`analytics:vaccination:${countryCode}:*`);
    for (const key of vaccKeys) {
      const vaccData = await this.redis.hGetAll(key);
      const coverage = parseFloat(vaccData['coverage'] ?? '0');
      const disease = key.split(':').pop() ?? 'unknown';

      // Flag if coverage below 70% threshold (WHO/OIE standard for herd immunity)
      if (coverage < 70 && coverage > 0) {
        const gap = 70 - coverage;
        const severity = coverage < 40
          ? 'CRITICAL'
          : coverage < 55
            ? 'HIGH'
            : 'MEDIUM';

        results.push({
          id: `corr:lv:${countryCode}:${disease}:${Date.now()}`,
          type: 'LIVESTOCK_VACCINATION',
          severity,
          description:
            `Herd immunity gap for ${disease} in ${countryCode}: ` +
            `coverage ${coverage.toFixed(1)}% (gap of ${gap.toFixed(1)}pp to 70% target), ` +
            `population at risk: ${totalPop.toLocaleString()}`,
          countryCode,
          relatedEntities: [key, DOMAIN_REDIS_KEYS.livestock(countryCode)],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /** Wildlife + Crime: trend analysis per protected area */
  async correlateWildlifeCrime(countryCode: string): Promise<Correlation[]> {
    const results: Correlation[] = [];
    const wildlifeData = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.wildlife(countryCode));
    const totalCrimes = parseInt(wildlifeData['totalCrimes'] ?? '0', 10);

    if (totalCrimes === 0) return results;

    // Check for protected area concentration
    const paEntries: Array<{ name: string; count: number }> = [];
    for (const [field, value] of Object.entries(wildlifeData)) {
      if (field.startsWith('pa:')) {
        paEntries.push({ name: field.replace('pa:', ''), count: parseInt(value, 10) || 0 });
      }
    }

    // Flag areas with high concentration
    for (const pa of paEntries) {
      if (pa.count >= 3) {
        const severity = pa.count >= 10 ? 'CRITICAL' : pa.count >= 5 ? 'HIGH' : 'MEDIUM';
        results.push({
          id: `corr:wc:${countryCode}:${pa.name}:${Date.now()}`,
          type: 'WILDLIFE_CRIME',
          severity,
          description:
            `${pa.count} wildlife crime(s) concentrated in ${pa.name} (${countryCode}). ` +
            `${parseInt(wildlifeData['speciesAffected'] ?? '0', 10)} species affected overall.`,
          countryCode,
          relatedEntities: [DOMAIN_REDIS_KEYS.wildlife(countryCode)],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  // ── Composite Risk Score ──

  async getRiskScore(countryCode: string): Promise<CountryRiskScore> {
    const components: RiskComponent[] = [];

    // Health risk (0-100)
    const healthScore = await this.calculateHealthRisk(countryCode);
    components.push(healthScore);

    // Climate risk (0-100)
    const climateScore = await this.calculateClimateRisk(countryCode);
    components.push(climateScore);

    // Trade risk (0-100)
    const tradeScore = await this.calculateTradeRisk(countryCode);
    components.push(tradeScore);

    // Wildlife risk (0-100)
    const wildlifeScore = await this.calculateWildlifeRisk(countryCode);
    components.push(wildlifeScore);

    // Governance (inverse: higher PVS = lower risk)
    const govScore = await this.calculateGovernanceRisk(countryCode);
    components.push(govScore);

    // Livestock vulnerability
    const livestockScore = await this.calculateLivestockRisk(countryCode);
    components.push(livestockScore);

    const compositeScore = Math.round(
      components.reduce((sum, c) => sum + c.score * c.weight, 0) * 100,
    ) / 100;

    const riskLevel = compositeScore >= 75
      ? 'CRITICAL'
      : compositeScore >= 50
        ? 'HIGH'
        : compositeScore >= 25
          ? 'MEDIUM'
          : 'LOW';

    // Store composite in Redis
    await this.redis.hMSet(DOMAIN_REDIS_KEYS.risk(countryCode), {
      compositeScore: String(compositeScore),
      riskLevel,
      lastUpdated: new Date().toISOString(),
    });

    return {
      countryCode,
      compositeScore,
      riskLevel,
      components,
      lastUpdated: new Date().toISOString(),
    };
  }

  async calculateHealthRisk(countryCode: string): Promise<RiskComponent> {
    const keys = await this.redis.scanKeys(`analytics:health:${countryCode}:*`);
    let activeOutbreaks = 0;
    let totalDeaths = 0;
    const factors: string[] = [];

    for (const key of keys) {
      const data = await this.redis.hGetAll(key);
      const active = parseInt(data['active'] ?? '0', 10);
      const deaths = parseInt(data['deaths'] ?? '0', 10);
      activeOutbreaks += active;
      totalDeaths += deaths;
      if (active > 0) {
        factors.push(`${key.split(':').pop()}: ${active} active`);
      }
    }

    // Score: 0-100 based on active outbreaks and mortality
    const score = Math.min(100, activeOutbreaks * 10 + Math.min(totalDeaths * 0.5, 50));
    return { domain: 'health', score, weight: RISK_WEIGHTS.health, factors };
  }

  async calculateClimateRisk(countryCode: string): Promise<RiskComponent> {
    const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.climate(countryCode));
    const hotspots = parseInt(data['activeHotspots'] ?? '0', 10);
    const critical = parseInt(data['severity:CRITICAL'] ?? '0', 10);
    const high = parseInt(data['severity:HIGH'] ?? '0', 10);

    const factors: string[] = [];
    if (hotspots > 0) factors.push(`${hotspots} hotspot(s)`);
    if (critical > 0) factors.push(`${critical} critical`);

    const score = Math.min(100, critical * 25 + high * 15 + hotspots * 5);
    return { domain: 'climate', score, weight: RISK_WEIGHTS.climate, factors };
  }

  async calculateTradeRisk(countryCode: string): Promise<RiskComponent> {
    const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.trade(countryCode));
    const balance = parseFloat(data['balance'] ?? '0');
    const factors: string[] = [];

    // Negative balance = dependency on imports = higher risk
    let score = 0;
    if (balance < 0) {
      score = Math.min(100, Math.abs(balance) / 1000000); // $1M increments
      factors.push(`Trade deficit: $${Math.abs(balance).toFixed(0)}`);
    }
    return { domain: 'trade', score, weight: RISK_WEIGHTS.trade, factors };
  }

  async calculateWildlifeRisk(countryCode: string): Promise<RiskComponent> {
    const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.wildlife(countryCode));
    const crimes = parseInt(data['totalCrimes'] ?? '0', 10);
    const species = parseInt(data['speciesAffected'] ?? '0', 10);
    const factors: string[] = [];

    if (crimes > 0) factors.push(`${crimes} crime(s)`);
    if (species > 0) factors.push(`${species} species affected`);

    const score = Math.min(100, crimes * 8 + species * 5);
    return { domain: 'wildlife', score, weight: RISK_WEIGHTS.wildlife, factors };
  }

  async calculateGovernanceRisk(countryCode: string): Promise<RiskComponent> {
    const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.governance(countryCode));
    const pvsScore = parseFloat(data['latestScore'] ?? '0');
    const factors: string[] = [];

    // Inverse: high PVS = low risk. PVS scale is roughly 0-100.
    const score = pvsScore > 0 ? Math.max(0, 100 - pvsScore) : 50; // 50 = unknown
    if (pvsScore > 0) factors.push(`PVS score: ${pvsScore}`);
    else factors.push('No PVS data');

    return { domain: 'governance', score, weight: RISK_WEIGHTS.governance, factors };
  }

  async calculateLivestockRisk(countryCode: string): Promise<RiskComponent> {
    const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.livestock(countryCode));
    const totalPop = parseInt(data['totalPopulation'] ?? '0', 10);
    const factors: string[] = [];

    // Check vaccination gaps
    const vaccKeys = await this.redis.scanKeys(`analytics:vaccination:${countryCode}:*`);
    let avgCoverage = 0;
    let vaccCount = 0;
    for (const key of vaccKeys) {
      const vaccData = await this.redis.hGetAll(key);
      const cov = parseFloat(vaccData['coverage'] ?? '0');
      if (cov > 0) {
        avgCoverage += cov;
        vaccCount++;
      }
    }
    if (vaccCount > 0) avgCoverage /= vaccCount;

    if (totalPop > 0) factors.push(`Population: ${totalPop.toLocaleString()}`);
    if (vaccCount > 0) factors.push(`Avg vaccination coverage: ${avgCoverage.toFixed(1)}%`);

    // Higher population with lower coverage = higher risk
    const coverageGap = vaccCount > 0 ? Math.max(0, 70 - avgCoverage) : 30;
    const score = Math.min(100, coverageGap * 1.4);
    return { domain: 'livestock', score, weight: RISK_WEIGHTS.livestock, factors };
  }

  // ── Domain-specific query methods ──

  async getLivestockPopulation(countryCode?: string): Promise<LivestockPopulation[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:livestock:');

    const results: LivestockPopulation[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.livestock(cc));
      const bySpecies: Record<string, number> = {};
      for (const [field, value] of Object.entries(data)) {
        if (field.startsWith('species:')) {
          bySpecies[field.replace('species:', '')] = parseInt(value, 10) || 0;
        }
      }
      results.push({
        countryCode: cc,
        totalPopulation: parseInt(data['totalPopulation'] ?? '0', 10),
        bySpecies,
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }
    return results;
  }

  async getFisheriesCatches(countryCode?: string): Promise<FisheriesCatches[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:fisheries:');

    const results: FisheriesCatches[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.fisheries(cc));
      const bySpecies: Record<string, number> = {};
      const byMethod: Record<string, number> = {};
      for (const [field, value] of Object.entries(data)) {
        if (field.startsWith('species:')) {
          bySpecies[field.replace('species:', '')] = parseFloat(value) || 0;
        } else if (field.startsWith('method:')) {
          byMethod[field.replace('method:', '')] = parseFloat(value) || 0;
        }
      }
      results.push({
        countryCode: cc,
        totalCatchesKg: parseFloat(data['totalCatchesKg'] ?? '0'),
        bySpecies,
        byMethod,
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }
    return results;
  }

  async getTradeBalance(countryCode?: string): Promise<TradeBalance[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:trade:');

    const results: TradeBalance[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.trade(cc));
      const topPartners: Array<{ country: string; value: number }> = [];
      for (const [field, value] of Object.entries(data)) {
        if (field.startsWith('partner:')) {
          topPartners.push({
            country: field.replace('partner:', ''),
            value: parseFloat(value) || 0,
          });
        }
      }
      topPartners.sort((a, b) => b.value - a.value);

      results.push({
        countryCode: cc,
        exports: parseFloat(data['exports'] ?? '0'),
        imports: parseFloat(data['imports'] ?? '0'),
        balance: parseFloat(data['balance'] ?? '0'),
        topPartners: topPartners.slice(0, 10),
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }
    return results;
  }

  async getWildlifeCrimeTrends(countryCode?: string): Promise<WildlifeCrimeTrends[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:wildlife:');

    const results: WildlifeCrimeTrends[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.wildlife(cc));
      const byCrimeType: Record<string, number> = {};
      const byProtectedArea: Record<string, number> = {};
      for (const [field, value] of Object.entries(data)) {
        if (field.startsWith('crimeType:')) {
          byCrimeType[field.replace('crimeType:', '')] = parseInt(value, 10) || 0;
        } else if (field.startsWith('pa:')) {
          byProtectedArea[field.replace('pa:', '')] = parseInt(value, 10) || 0;
        }
      }
      results.push({
        countryCode: cc,
        totalCrimes: parseInt(data['totalCrimes'] ?? '0', 10),
        byCrimeType,
        byProtectedArea,
        speciesAffected: parseInt(data['speciesAffected'] ?? '0', 10),
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }
    return results;
  }

  async getClimateAlerts(countryCode?: string): Promise<ClimateAlert[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:climate:');

    const results: ClimateAlert[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.climate(cc));
      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const [field, value] of Object.entries(data)) {
        if (field.startsWith('severity:')) {
          bySeverity[field.replace('severity:', '')] = parseInt(value, 10) || 0;
        } else if (field.startsWith('type:')) {
          byType[field.replace('type:', '')] = parseInt(value, 10) || 0;
        }
      }
      results.push({
        countryCode: cc,
        activeHotspots: parseInt(data['activeHotspots'] ?? '0', 10),
        bySeverity,
        byType,
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }
    return results;
  }

  async getPvsScores(countryCode?: string): Promise<PvsScoreEntry[]> {
    const countries = countryCode
      ? [countryCode]
      : await this.discoverCountriesForPrefix('analytics:governance:');

    const results: PvsScoreEntry[] = [];
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.governance(cc));
      if (data['latestScore']) {
        results.push({
          countryCode: cc,
          latestScore: parseFloat(data['latestScore']),
          evaluationType: data['evaluationType'] ?? '',
          year: parseInt(data['year'] ?? '0', 10),
          lastUpdated: data['lastUpdated'] ?? '',
        });
      }
    }
    return results;
  }

  // ── Continental KPIs (aggregated across all domains & countries) ──

  async getContinentalKpis(): Promise<ContinentalKpiResponse> {
    const countries = await this.discoverCountries();
    const countriesReporting = countries.length;

    // Health: aggregate outbreaks, cases, deaths across all countries
    let totalActiveOutbreaks = 0;
    let totalCases = 0;
    let totalDeaths = 0;
    for (const cc of countries) {
      const healthKeys = await this.redis.scanKeys(`analytics:health:${cc}:*`);
      for (const key of healthKeys) {
        if (key.includes(':trend:')) continue;
        const data = await this.redis.hGetAll(key);
        totalActiveOutbreaks += parseInt(data['active'] ?? '0', 10);
        totalCases += parseInt(data['cases'] ?? '0', 10);
        totalDeaths += parseInt(data['deaths'] ?? '0', 10);
      }
    }

    // Vaccination coverage (average across all countries/diseases)
    let totalCoverage = 0;
    let vaccCount = 0;
    for (const cc of countries) {
      const vaccKeys = await this.redis.scanKeys(`analytics:vaccination:${cc}:*`);
      for (const key of vaccKeys) {
        const data = await this.redis.hGetAll(key);
        const cov = parseFloat(data['coverage'] ?? '0');
        if (cov > 0) {
          totalCoverage += cov;
          vaccCount++;
        }
      }
    }
    const avgVaccinationCoverage = vaccCount > 0 ? Math.round(totalCoverage / vaccCount * 10) / 10 : 0;

    // Livestock: total population
    let totalLivestockPop = 0;
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.livestock(cc));
      totalLivestockPop += parseInt(data['totalPopulation'] ?? '0', 10);
    }

    // Fisheries: total catches
    let totalCatchesKg = 0;
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.fisheries(cc));
      totalCatchesKg += parseFloat(data['totalCatchesKg'] ?? '0');
    }

    // Trade: total exports
    let totalExports = 0;
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.trade(cc));
      totalExports += parseFloat(data['exports'] ?? '0');
    }

    // Wildlife crimes
    let totalWildlifeCrimes = 0;
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.wildlife(cc));
      totalWildlifeCrimes += parseInt(data['totalCrimes'] ?? '0', 10);
    }

    // Climate hotspots
    let totalHotspots = 0;
    for (const cc of countries) {
      const data = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.climate(cc));
      totalHotspots += parseInt(data['activeHotspots'] ?? '0', 10);
    }

    // Quality pass rate
    const qualityData = await this.redis.hGetAll(REDIS_KEYS.qualityGlobal);
    const qualityPassRate = parseFloat(qualityData['passRate'] ?? '0');

    const kpis: KpiCard[] = [
      {
        key: 'countries_reporting',
        label: 'Countries Reporting',
        value: countriesReporting,
        unit: '',
        trend: 'stable',
        trendPercent: 0,
      },
      {
        key: 'active_outbreaks',
        label: 'Active Outbreaks',
        value: totalActiveOutbreaks,
        unit: '',
        trend: totalActiveOutbreaks > 10 ? 'up' : 'stable',
        trendPercent: 0,
      },
      {
        key: 'total_cases',
        label: 'Total Cases',
        value: totalCases,
        unit: '',
        trend: 'stable',
        trendPercent: 0,
      },
      {
        key: 'vaccination_coverage',
        label: 'Avg Vaccination Coverage',
        value: avgVaccinationCoverage,
        unit: '%',
        trend: avgVaccinationCoverage >= 70 ? 'up' : 'down',
        trendPercent: 0,
      },
      {
        key: 'livestock_population',
        label: 'Livestock Population',
        value: totalLivestockPop,
        unit: 'heads',
        trend: 'stable',
        trendPercent: 0,
      },
      {
        key: 'fisheries_catches',
        label: 'Fisheries Catches',
        value: Math.round(totalCatchesKg / 1000),
        unit: 'tonnes',
        trend: 'stable',
        trendPercent: 0,
      },
      {
        key: 'trade_exports',
        label: 'Trade Exports',
        value: totalExports,
        unit: 'USD',
        trend: 'stable',
        trendPercent: 0,
      },
      {
        key: 'wildlife_crimes',
        label: 'Wildlife Crimes',
        value: totalWildlifeCrimes,
        unit: '',
        trend: totalWildlifeCrimes > 0 ? 'up' : 'stable',
        trendPercent: 0,
      },
      {
        key: 'climate_hotspots',
        label: 'Climate Hotspots',
        value: totalHotspots,
        unit: '',
        trend: totalHotspots > 5 ? 'up' : 'stable',
        trendPercent: 0,
      },
      {
        key: 'quality_pass_rate',
        label: 'Data Quality Pass Rate',
        value: qualityPassRate,
        unit: '%',
        trend: qualityPassRate >= 80 ? 'up' : 'down',
        trendPercent: 0,
      },
    ];

    return {
      kpis,
      asOf: new Date().toISOString(),
    };
  }

  // ── Domain-specific KPIs (generic endpoint) ──

  async getDomainKpis(domainKey: string): Promise<ContinentalKpiResponse> {
    const kpis: KpiCard[] = [];
    const now = new Date().toISOString();

    switch (domainKey) {
      case 'health': {
        const countries = await this.discoverCountriesForPrefix('analytics:health:');
        let active = 0, cases = 0, deaths = 0;
        for (const cc of countries) {
          const keys = await this.redis.scanKeys(`analytics:health:${cc}:*`);
          for (const key of keys) {
            if (key.includes(':trend:')) continue;
            const d = await this.redis.hGetAll(key);
            active += parseInt(d['active'] ?? '0', 10);
            cases += parseInt(d['cases'] ?? '0', 10);
            deaths += parseInt(d['deaths'] ?? '0', 10);
          }
        }
        kpis.push(
          { key: 'active_outbreaks', label: 'Active Outbreaks', value: active, unit: '', trend: 'stable', trendPercent: 0 },
          { key: 'total_cases', label: 'Total Cases', value: cases, unit: '', trend: 'stable', trendPercent: 0 },
          { key: 'total_deaths', label: 'Total Deaths', value: deaths, unit: '', trend: 'stable', trendPercent: 0 },
        );
        break;
      }
      case 'livestock': {
        const countries = await this.discoverCountriesForPrefix('analytics:livestock:');
        let pop = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.livestock(cc));
          pop += parseInt(d['totalPopulation'] ?? '0', 10);
        }
        kpis.push({ key: 'livestock_population', label: 'Total Population', value: pop, unit: 'heads', trend: 'stable', trendPercent: 0 });
        break;
      }
      case 'fisheries': {
        const countries = await this.discoverCountriesForPrefix('analytics:fisheries:');
        let catches = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.fisheries(cc));
          catches += parseFloat(d['totalCatchesKg'] ?? '0');
        }
        kpis.push({ key: 'total_catches', label: 'Total Catches', value: Math.round(catches / 1000), unit: 'tonnes', trend: 'stable', trendPercent: 0 });
        break;
      }
      case 'trade': {
        const countries = await this.discoverCountriesForPrefix('analytics:trade:');
        let exp = 0, imp = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.trade(cc));
          exp += parseFloat(d['exports'] ?? '0');
          imp += parseFloat(d['imports'] ?? '0');
        }
        kpis.push(
          { key: 'total_exports', label: 'Exports', value: exp, unit: 'USD', trend: 'stable', trendPercent: 0 },
          { key: 'total_imports', label: 'Imports', value: imp, unit: 'USD', trend: 'stable', trendPercent: 0 },
          { key: 'trade_balance', label: 'Balance', value: exp - imp, unit: 'USD', trend: (exp - imp) >= 0 ? 'up' : 'down', trendPercent: 0 },
        );
        break;
      }
      case 'wildlife': {
        const countries = await this.discoverCountriesForPrefix('analytics:wildlife:');
        let crimes = 0, species = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.wildlife(cc));
          crimes += parseInt(d['totalCrimes'] ?? '0', 10);
          species += parseInt(d['speciesAffected'] ?? '0', 10);
        }
        kpis.push(
          { key: 'total_crimes', label: 'Wildlife Crimes', value: crimes, unit: '', trend: 'stable', trendPercent: 0 },
          { key: 'species_affected', label: 'Species Affected', value: species, unit: '', trend: 'stable', trendPercent: 0 },
        );
        break;
      }
      case 'climate': {
        const countries = await this.discoverCountriesForPrefix('analytics:climate:');
        let hotspots = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.climate(cc));
          hotspots += parseInt(d['activeHotspots'] ?? '0', 10);
        }
        kpis.push({ key: 'active_hotspots', label: 'Active Hotspots', value: hotspots, unit: '', trend: 'stable', trendPercent: 0 });
        break;
      }
      case 'governance': {
        const entries = await this.getPvsScores();
        const avgScore = entries.length > 0
          ? Math.round(entries.reduce((s, e) => s + e.latestScore, 0) / entries.length * 10) / 10
          : 0;
        kpis.push(
          { key: 'avg_pvs_score', label: 'Avg PVS Score', value: avgScore, unit: '', trend: 'stable', trendPercent: 0 },
          { key: 'countries_evaluated', label: 'Countries Evaluated', value: entries.length, unit: '', trend: 'stable', trendPercent: 0 },
        );
        break;
      }
      case 'apiculture': {
        const countries = await this.discoverCountriesForPrefix('analytics:apiculture:');
        let totalKg = 0;
        for (const cc of countries) {
          const d = await this.redis.hGetAll(DOMAIN_REDIS_KEYS.apiculture(cc));
          totalKg += parseFloat(d['totalProductionKg'] ?? '0');
        }
        kpis.push({ key: 'total_production', label: 'Honey Production', value: Math.round(totalKg), unit: 'kg', trend: 'stable', trendPercent: 0 });
        break;
      }
      default:
        break;
    }

    return { kpis, asOf: now };
  }

  // ── Helpers ──

  private async discoverCountries(): Promise<string[]> {
    const allKeys = new Set<string>();
    const prefixes = [
      'analytics:health:*',
      'analytics:livestock:*',
      'analytics:fisheries:*',
      'analytics:trade:*',
      'analytics:wildlife:*',
      'analytics:climate:*',
      'analytics:governance:*',
    ];

    for (const pattern of prefixes) {
      const keys = await this.redis.scanKeys(pattern);
      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length >= 3) allKeys.add(parts[2]);
      }
    }
    return Array.from(allKeys);
  }

  private async discoverCountriesForPrefix(prefix: string): Promise<string[]> {
    const keys = await this.redis.scanKeys(`${prefix}*`);
    const countries = new Set<string>();
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 3) countries.add(parts[2]);
    }
    return Array.from(countries);
  }
}
