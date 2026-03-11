import type { RedisClient } from './redis-client';
import type {
  LivestockCensusPayload,
  FishCapturePayload,
  WildlifeCrimePayload,
  TradeFlowPayload,
  ClimateHotspotPayload,
  ApicultureProductionPayload,
  GovernancePvsPayload,
} from '../dto/cross-domain.dto';

/** Redis key patterns for domain aggregation read models */
export const DOMAIN_REDIS_KEYS = {
  livestock: (country: string) => `analytics:livestock:${country}`,
  fisheries: (country: string) => `analytics:fisheries:${country}`,
  trade: (country: string) => `analytics:trade:${country}`,
  wildlife: (country: string) => `analytics:wildlife:${country}`,
  climate: (country: string) => `analytics:climate:${country}`,
  apiculture: (country: string) => `analytics:apiculture:${country}`,
  governance: (country: string) => `analytics:governance:${country}`,
  risk: (country: string) => `analytics:risk:${country}`,
} as const;

export class DomainAggregationService {
  constructor(private readonly redis: RedisClient) {}

  // ── Livestock ──

  async handleLivestockCensusCreated(payload: LivestockCensusPayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.livestock(payload.countryCode);
    const speciesField = `species:${payload.speciesId}`;

    await Promise.all([
      this.redis.hSet(key, speciesField, String(payload.population)),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);

    // Recalculate total
    const all = await this.redis.hGetAll(key);
    let total = 0;
    for (const [field, value] of Object.entries(all)) {
      if (field.startsWith('species:')) {
        total += parseInt(value, 10) || 0;
      }
    }
    await this.redis.hSet(key, 'totalPopulation', String(total));
  }

  // ── Fisheries ──

  async handleFishCaptureRecorded(payload: FishCapturePayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.fisheries(payload.countryCode);

    await Promise.all([
      this.redis.hIncrByFloat(key, 'totalCatchesKg', payload.quantityKg),
      this.redis.hIncrByFloat(key, `species:${payload.speciesId}`, payload.quantityKg),
      this.redis.hIncrByFloat(key, `method:${payload.gearType}`, payload.quantityKg),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);
  }

  // ── Wildlife Crime ──

  async handleWildlifeCrimeReported(payload: WildlifeCrimePayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.wildlife(payload.countryCode);

    const promises: Promise<unknown>[] = [
      this.redis.hIncrBy(key, 'totalCrimes', 1),
      this.redis.hIncrBy(key, `crimeType:${payload.crimeType}`, 1),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ];

    if (payload.protectedAreaId) {
      const paKey = payload.protectedAreaName ?? payload.protectedAreaId;
      promises.push(this.redis.hIncrBy(key, `pa:${paKey}`, 1));
    }

    // Track unique affected species count
    for (const speciesId of payload.speciesIds) {
      promises.push(this.redis.hSet(key, `affectedSpecies:${speciesId}`, '1'));
    }

    await Promise.all(promises);

    // Count unique species
    const all = await this.redis.hGetAll(key);
    let speciesCount = 0;
    for (const field of Object.keys(all)) {
      if (field.startsWith('affectedSpecies:')) speciesCount++;
    }
    await this.redis.hSet(key, 'speciesAffected', String(speciesCount));
  }

  // ── Trade ──

  async handleTradeFlowCreated(payload: TradeFlowPayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.trade(payload.countryCode);
    const value = payload.valueFob ?? 0;

    if (payload.flowDirection === 'EXPORT') {
      await this.redis.hIncrByFloat(key, 'exports', value);
    } else if (payload.flowDirection === 'IMPORT') {
      await this.redis.hIncrByFloat(key, 'imports', value);
    }

    // Track partner volumes
    const partnerField = `partner:${payload.partnerCountryCode}`;
    await this.redis.hIncrByFloat(key, partnerField, value);

    // Recalculate balance
    const all = await this.redis.hGetAll(key);
    const exports = parseFloat(all['exports'] ?? '0');
    const imports = parseFloat(all['imports'] ?? '0');
    await Promise.all([
      this.redis.hSet(key, 'balance', String(exports - imports)),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);
  }

  // ── Climate / Environment ──

  async handleClimateHotspotDetected(payload: ClimateHotspotPayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.climate(payload.countryCode);

    await Promise.all([
      this.redis.hIncrBy(key, 'activeHotspots', 1),
      this.redis.hIncrBy(key, `severity:${payload.severity}`, 1),
      this.redis.hIncrBy(key, `type:${payload.type}`, 1),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);
  }

  // ── Apiculture ──

  async handleApicultureProductionRecorded(payload: ApicultureProductionPayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.apiculture(payload.countryCode);

    await Promise.all([
      this.redis.hIncrByFloat(key, 'totalProductionKg', payload.quantityKg),
      this.redis.hIncrBy(key, 'harvestCount', 1),
      this.redis.hIncrBy(key, `quality:${payload.quality}`, 1),
      this.redis.hIncrBy(key, `floral:${payload.floralSource}`, 1),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);
  }

  // ── Governance ──

  async handleGovernancePvsEvaluated(payload: GovernancePvsPayload): Promise<void> {
    const key = DOMAIN_REDIS_KEYS.governance(payload.countryCode);

    await this.redis.hMSet(key, {
      latestScore: String(payload.overallScore),
      evaluationType: payload.evaluationType,
      year: String(payload.year),
      lastUpdated: new Date().toISOString(),
    });
  }
}
