import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { REDIS_KEYS } from '../aggregation/aggregation.service';
import type {
  HealthKpis,
  HealthKpisByDisease,
  HealthTrends,
  HealthTrendEntry,
  QualityDashboard,
  WorkflowTimeliness,
  DenominatorEntry,
} from './dto/health-kpis.dto';

const WORKFLOW_LEVELS = [
  'NATIONAL_TECHNICAL',
  'NATIONAL_OFFICIAL',
  'REC_HARMONIZATION',
  'CONTINENTAL_PUBLICATION',
];

@Injectable()
export class HealthKpiService {
  private readonly logger = new Logger(HealthKpiService.name);

  constructor(private readonly redis: RedisService) {}

  // ── Health KPIs ──

  async getHealthKpis(
    country?: string,
    disease?: string,
  ): Promise<HealthKpis> {
    if (country && disease) {
      return this.getKpisForCountryDisease(country, disease);
    }

    // Aggregate across all country/disease combinations
    const pattern = 'analytics:health:*:*';
    const keys = await this.redis.scanKeys(pattern);

    let totalActive = 0;
    let totalConfirmed = 0;
    let totalCases = 0;
    let totalDeaths = 0;
    let latestUpdate = '';

    for (const key of keys) {
      // Skip trend keys
      if (key.includes(':trend:')) continue;
      const data = await this.redis.hGetAll(key);
      totalActive += parseInt(data['active'] ?? '0', 10);
      totalConfirmed += parseInt(data['confirmed'] ?? '0', 10);
      totalCases += parseInt(data['cases'] ?? '0', 10);
      totalDeaths += parseInt(data['deaths'] ?? '0', 10);
      if (data['lastUpdated'] && data['lastUpdated'] > latestUpdate) {
        latestUpdate = data['lastUpdated'];
      }
    }

    // Also read vaccination and quality from their global keys
    const qualityData = await this.redis.hGetAll(REDIS_KEYS.qualityGlobal);
    const vaccinationKeys = await this.redis.scanKeys('analytics:vaccination:*:*');
    let totalCoverage = 0;
    let vacCount = 0;
    for (const vk of vaccinationKeys) {
      const vd = await this.redis.hGetAll(vk);
      const cov = parseFloat(vd['coverage'] ?? '0');
      if (cov > 0) {
        totalCoverage += cov;
        vacCount++;
      }
    }

    const labKeys = await this.redis.scanKeys('analytics:lab:*');
    let totalTurnaround = 0;
    let labCount = 0;
    for (const lk of labKeys) {
      const ld = await this.redis.hGetAll(lk);
      const avg = parseFloat(ld['avgTurnaround'] ?? '0');
      if (avg > 0) {
        totalTurnaround += avg;
        labCount++;
      }
    }

    return {
      activeOutbreaks: totalActive,
      confirmed: totalConfirmed,
      suspected: totalActive - totalConfirmed,
      deaths: totalDeaths,
      cases: totalCases,
      vaccinationCoverage: vacCount > 0
        ? Math.round((totalCoverage / vacCount) * 100) / 100
        : 0,
      avgLabTurnaround: labCount > 0
        ? Math.round((totalTurnaround / labCount) * 100) / 100
        : 0,
      qualityPassRate: parseFloat(qualityData['passRate'] ?? '0'),
      lastUpdated: latestUpdate || new Date().toISOString(),
    };
  }

  private async getKpisForCountryDisease(
    country: string,
    disease: string,
  ): Promise<HealthKpis> {
    const healthData = await this.redis.hGetAll(
      REDIS_KEYS.health(country, disease),
    );
    const vacData = await this.redis.hGetAll(
      REDIS_KEYS.vaccination(country, disease),
    );
    const labData = await this.redis.hGetAll(REDIS_KEYS.lab(country));
    const qualityData = await this.redis.hGetAll(REDIS_KEYS.qualityGlobal);

    const active = parseInt(healthData['active'] ?? '0', 10);
    const confirmed = parseInt(healthData['confirmed'] ?? '0', 10);

    return {
      activeOutbreaks: active,
      confirmed,
      suspected: active - confirmed,
      deaths: parseInt(healthData['deaths'] ?? '0', 10),
      cases: parseInt(healthData['cases'] ?? '0', 10),
      vaccinationCoverage: parseFloat(vacData['coverage'] ?? '0'),
      avgLabTurnaround: parseFloat(labData['avgTurnaround'] ?? '0'),
      qualityPassRate: parseFloat(qualityData['passRate'] ?? '0'),
      lastUpdated: healthData['lastUpdated'] ?? new Date().toISOString(),
    };
  }

  async getHealthKpisByDisease(
    country?: string,
  ): Promise<HealthKpisByDisease[]> {
    const pattern = country
      ? `analytics:health:${country}:*`
      : 'analytics:health:*:*';
    const keys = await this.redis.scanKeys(pattern);
    const results: HealthKpisByDisease[] = [];

    for (const key of keys) {
      if (key.includes(':trend:')) continue;
      const parts = key.split(':');
      // analytics:health:{country}:{disease}
      if (parts.length !== 4) continue;
      const data = await this.redis.hGetAll(key);
      results.push({
        countryCode: parts[2],
        diseaseId: parts[3],
        active: parseInt(data['active'] ?? '0', 10),
        confirmed: parseInt(data['confirmed'] ?? '0', 10),
        cases: parseInt(data['cases'] ?? '0', 10),
        deaths: parseInt(data['deaths'] ?? '0', 10),
        lastUpdated: data['lastUpdated'] ?? '',
      });
    }

    return results;
  }

  // ── Health Trends ──

  async getHealthTrends(periodMonths: number = 6): Promise<HealthTrends> {
    const now = new Date();
    const entries: HealthTrendEntry[] = [];

    for (let i = 0; i < periodMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const key = REDIS_KEYS.healthTrend(yearMonth);

      const raw = await this.redis.zRangeByScoreWithScores(key, '-inf', '+inf');
      for (const item of raw) {
        try {
          const parsed = JSON.parse(item.member);
          entries.push({
            timestamp: item.score,
            id: parsed.id,
            countryCode: parsed.countryCode,
            diseaseId: parsed.diseaseId,
            cases: parsed.cases ?? 0,
            deaths: parsed.deaths ?? 0,
            eventType: parsed.eventType ?? 'SUSPECT',
          });
        } catch {
          this.logger.warn(`Failed to parse trend entry: ${item.member}`);
        }
      }
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);

    return {
      period: `${periodMonths}m`,
      entries,
      totalEvents: entries.length,
    };
  }

  // ── Quality Dashboard ──

  async getQualityDashboard(): Promise<QualityDashboard> {
    const data = await this.redis.hGetAll(REDIS_KEYS.qualityGlobal);
    return {
      passRate: parseFloat(data['passRate'] ?? '0'),
      failRate: parseFloat(data['failRate'] ?? '0'),
      totalRecords: parseInt(data['totalRecords'] ?? '0', 10),
      passCount: parseInt(data['passCount'] ?? '0', 10),
      failCount: parseInt(data['failCount'] ?? '0', 10),
      lastUpdated: data['lastUpdated'] ?? new Date().toISOString(),
    };
  }

  // ── Workflow Timeliness ──

  async getWorkflowTimeliness(): Promise<WorkflowTimeliness> {
    const data = await this.redis.hGetAll(REDIS_KEYS.workflowTimeliness);
    const levels: Record<string, { avgDays: number; count: number }> = {};

    for (const level of WORKFLOW_LEVELS) {
      levels[level] = {
        avgDays: parseFloat(data[`${level}:avgDays`] ?? '0'),
        count: parseInt(data[`${level}:count`] ?? '0', 10),
      };
    }

    return {
      levels,
      lastUpdated: data['lastUpdated'] ?? new Date().toISOString(),
    };
  }

  // ── Denominators (Vaccination Coverage) ──

  async getDenominators(country?: string): Promise<DenominatorEntry[]> {
    const pattern = country
      ? `analytics:vaccination:${country}:*`
      : 'analytics:vaccination:*:*';
    const keys = await this.redis.scanKeys(pattern);
    const results: DenominatorEntry[] = [];

    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length !== 4) continue;
      const data = await this.redis.hGetAll(key);
      results.push({
        countryCode: parts[2],
        diseaseId: parts[3],
        dosesUsed: parseInt(data['doses'] ?? '0', 10),
        targetPopulation: parseInt(data['targetPopulation'] ?? '0', 10),
        coverage: parseFloat(data['coverage'] ?? '0'),
        campaigns: parseInt(data['campaigns'] ?? '0', 10),
      });
    }

    return results;
  }
}
