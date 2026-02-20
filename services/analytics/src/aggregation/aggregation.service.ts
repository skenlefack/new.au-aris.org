import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

/** Redis key prefixes for CQRS read models */
export const REDIS_KEYS = {
  /** Hash: active, confirmed, suspected, deaths, cases */
  health: (country: string, disease: string) =>
    `analytics:health:${country}:${disease}`,

  /** Hash: doses, coverage, campaigns, targetPopulation */
  vaccination: (country: string, disease: string) =>
    `analytics:vaccination:${country}:${disease}`,

  /** Hash: avgTurnaround, totalTests, positiveRate, positiveCount */
  lab: (country: string) => `analytics:lab:${country}`,

  /** Hash: passRate, failRate, totalRecords, passCount, failCount */
  qualityGlobal: 'analytics:quality:global',

  /** Hash: avgDays per level (NATIONAL_TECHNICAL, NATIONAL_OFFICIAL, ...) */
  workflowTimeliness: 'analytics:workflow:timeliness',

  /** Sorted set: score=epoch, member=JSON payload */
  healthTrend: (yearMonth: string) =>
    `analytics:health:trend:${yearMonth}`,

  /** Track last-updated timestamps */
  lastUpdated: 'analytics:meta:last_updated',
} as const;

export interface HealthEventPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  diseaseId: string;
  cases?: number;
  deaths?: number;
  eventType?: string;
  confidenceLevel?: string;
  dateOnset?: string;
  timestamp?: string;
}

export interface VaccinationPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  diseaseId: string;
  dosesUsed: number;
  targetPopulation: number;
  coverageEstimate: number;
}

export interface LabResultPayload {
  id: string;
  tenantId: string;
  countryCode: string;
  result: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  turnaroundDays: number;
}

export interface QualityRecordPayload {
  id: string;
  tenantId: string;
  entityType: string;
  gateResults?: Record<string, string>;
  score?: number;
}

export interface WorkflowApprovedPayload {
  instanceId: string;
  tenantId: string;
  level: string;
  daysAtLevel: number;
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly redis: RedisService) {}

  // ── Health Events ──

  async handleHealthEventCreated(payload: HealthEventPayload): Promise<void> {
    const key = REDIS_KEYS.health(payload.countryCode, payload.diseaseId);
    await Promise.all([
      this.redis.hIncrBy(key, 'active', 1),
      this.redis.hIncrBy(key, 'cases', payload.cases ?? 1),
      this.redis.hIncrBy(key, 'deaths', payload.deaths ?? 0),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);

    await this.addTrendEntry(payload);
    this.logger.debug(
      `Health event created: ${payload.countryCode}/${payload.diseaseId} (${payload.id})`,
    );
  }

  async handleHealthEventConfirmed(payload: HealthEventPayload): Promise<void> {
    const key = REDIS_KEYS.health(payload.countryCode, payload.diseaseId);
    await Promise.all([
      this.redis.hIncrBy(key, 'confirmed', 1),
      this.redis.hSet(key, 'lastUpdated', new Date().toISOString()),
    ]);

    this.logger.debug(
      `Health event confirmed: ${payload.countryCode}/${payload.diseaseId} (${payload.id})`,
    );
  }

  // ── Vaccination ──

  async handleVaccinationCompleted(payload: VaccinationPayload): Promise<void> {
    const key = REDIS_KEYS.vaccination(payload.countryCode, payload.diseaseId);

    const existing = await this.redis.hGetAll(key);
    const prevDoses = parseInt(existing['doses'] ?? '0', 10);
    const prevTarget = parseInt(existing['targetPopulation'] ?? '0', 10);
    const prevCampaigns = parseInt(existing['campaigns'] ?? '0', 10);

    const newDoses = prevDoses + payload.dosesUsed;
    const newTarget = prevTarget + payload.targetPopulation;
    const newCoverage = newTarget > 0
      ? Math.round((newDoses / newTarget) * 10000) / 100
      : 0;

    await this.redis.hMSet(key, {
      doses: String(newDoses),
      targetPopulation: String(newTarget),
      coverage: String(newCoverage),
      campaigns: String(prevCampaigns + 1),
      lastUpdated: new Date().toISOString(),
    });

    this.logger.debug(
      `Vaccination completed: ${payload.countryCode}/${payload.diseaseId} coverage=${newCoverage}%`,
    );
  }

  // ── Lab Results ──

  async handleLabResultCreated(payload: LabResultPayload): Promise<void> {
    const key = REDIS_KEYS.lab(payload.countryCode);

    const existing = await this.redis.hGetAll(key);
    const prevTotal = parseInt(existing['totalTests'] ?? '0', 10);
    const prevPositive = parseInt(existing['positiveCount'] ?? '0', 10);
    const prevTurnaroundSum = parseFloat(existing['turnaroundSum'] ?? '0');

    const newTotal = prevTotal + 1;
    const newPositive = payload.result === 'POSITIVE' ? prevPositive + 1 : prevPositive;
    const newTurnaroundSum = prevTurnaroundSum + payload.turnaroundDays;

    const avgTurnaround = Math.round((newTurnaroundSum / newTotal) * 100) / 100;
    const positiveRate = Math.round((newPositive / newTotal) * 10000) / 100;

    await this.redis.hMSet(key, {
      totalTests: String(newTotal),
      positiveCount: String(newPositive),
      turnaroundSum: String(newTurnaroundSum),
      avgTurnaround: String(avgTurnaround),
      positiveRate: String(positiveRate),
      lastUpdated: new Date().toISOString(),
    });

    this.logger.debug(
      `Lab result: ${payload.countryCode} avg_turnaround=${avgTurnaround}d positive_rate=${positiveRate}%`,
    );
  }

  // ── Quality Gates ──

  async handleQualityValidated(payload: QualityRecordPayload): Promise<void> {
    const key = REDIS_KEYS.qualityGlobal;

    const existing = await this.redis.hGetAll(key);
    const prevPass = parseInt(existing['passCount'] ?? '0', 10);
    const prevTotal = parseInt(existing['totalRecords'] ?? '0', 10);

    const newPass = prevPass + 1;
    const newTotal = prevTotal + 1;
    const passRate = Math.round((newPass / newTotal) * 10000) / 100;
    const failRate = Math.round(((newTotal - newPass) / newTotal) * 10000) / 100;

    await this.redis.hMSet(key, {
      passCount: String(newPass),
      totalRecords: String(newTotal),
      passRate: String(passRate),
      failRate: String(failRate),
      lastUpdated: new Date().toISOString(),
    });
  }

  async handleQualityRejected(payload: QualityRecordPayload): Promise<void> {
    const key = REDIS_KEYS.qualityGlobal;

    const existing = await this.redis.hGetAll(key);
    const prevFail = parseInt(existing['failCount'] ?? '0', 10);
    const prevTotal = parseInt(existing['totalRecords'] ?? '0', 10);
    const prevPass = parseInt(existing['passCount'] ?? '0', 10);

    const newFail = prevFail + 1;
    const newTotal = prevTotal + 1;
    const passRate = Math.round((prevPass / newTotal) * 10000) / 100;
    const failRate = Math.round((newFail / newTotal) * 10000) / 100;

    await this.redis.hMSet(key, {
      failCount: String(newFail),
      totalRecords: String(newTotal),
      passRate: String(passRate),
      failRate: String(failRate),
      lastUpdated: new Date().toISOString(),
    });
  }

  // ── Workflow Timeliness ──

  async handleWorkflowApproved(payload: WorkflowApprovedPayload): Promise<void> {
    const key = REDIS_KEYS.workflowTimeliness;
    const level = payload.level;

    const existing = await this.redis.hGetAll(key);
    const prevCount = parseInt(existing[`${level}:count`] ?? '0', 10);
    const prevSum = parseFloat(existing[`${level}:sumDays`] ?? '0');

    const newCount = prevCount + 1;
    const newSum = prevSum + payload.daysAtLevel;
    const avgDays = Math.round((newSum / newCount) * 100) / 100;

    await this.redis.hMSet(key, {
      [`${level}:count`]: String(newCount),
      [`${level}:sumDays`]: String(newSum),
      [`${level}:avgDays`]: String(avgDays),
      lastUpdated: new Date().toISOString(),
    });
  }

  // ── Trend Time Series ──

  private async addTrendEntry(payload: HealthEventPayload): Promise<void> {
    const date = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = REDIS_KEYS.healthTrend(yearMonth);

    const entry = JSON.stringify({
      id: payload.id,
      countryCode: payload.countryCode,
      diseaseId: payload.diseaseId,
      cases: payload.cases ?? 0,
      deaths: payload.deaths ?? 0,
      eventType: payload.eventType ?? 'SUSPECT',
    });

    await this.redis.zAdd(key, date.getTime(), entry);
  }
}
