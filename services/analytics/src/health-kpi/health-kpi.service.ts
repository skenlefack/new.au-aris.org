import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import type { HealthKpis } from './dto/health-kpis.dto';

const REDIS_PREFIX = 'analytics:health:kpi';

export const KPI_KEYS = {
  ACTIVE_OUTBREAKS: `${REDIS_PREFIX}:active_outbreaks`,
  VACCINATION_COVERAGE: `${REDIS_PREFIX}:vaccination_coverage`,
  AVG_LAB_TURNAROUND: `${REDIS_PREFIX}:avg_lab_turnaround`,
  QUALITY_PASS_RATE: `${REDIS_PREFIX}:quality_pass_rate`,
  LAST_UPDATED: `${REDIS_PREFIX}:last_updated`,
  EVENTS_PROCESSED: `${REDIS_PREFIX}:events_processed`,
} as const;

@Injectable()
export class HealthKpiService {
  private readonly logger = new Logger(HealthKpiService.name);

  constructor(private readonly redis: RedisService) {}

  async getKpis(): Promise<HealthKpis> {
    const [
      activeOutbreaks,
      vaccinationCoverage,
      avgLabTurnaround,
      qualityPassRate,
      lastUpdated,
    ] = await Promise.all([
      this.redis.get(KPI_KEYS.ACTIVE_OUTBREAKS),
      this.redis.get(KPI_KEYS.VACCINATION_COVERAGE),
      this.redis.get(KPI_KEYS.AVG_LAB_TURNAROUND),
      this.redis.get(KPI_KEYS.QUALITY_PASS_RATE),
      this.redis.get(KPI_KEYS.LAST_UPDATED),
    ]);

    return {
      activeOutbreaks: parseInt(activeOutbreaks ?? '0', 10),
      vaccinationCoverage: parseFloat(vaccinationCoverage ?? '0'),
      avgLabTurnaround: parseFloat(avgLabTurnaround ?? '0'),
      qualityPassRate: parseFloat(qualityPassRate ?? '0'),
      lastUpdated: lastUpdated ?? new Date().toISOString(),
    };
  }

  async handleHealthEventCreated(payload: Record<string, unknown>): Promise<void> {
    await this.redis.incr(KPI_KEYS.ACTIVE_OUTBREAKS);
    await this.redis.incr(KPI_KEYS.EVENTS_PROCESSED);
    await this.redis.set(KPI_KEYS.LAST_UPDATED, new Date().toISOString());

    this.logger.log(
      `Health event processed — outbreak count incremented (eventId=${payload['id'] ?? 'unknown'})`,
    );
  }

  async seedMockKpis(): Promise<void> {
    const client = this.redis.getClient();
    const existing = await client.get(KPI_KEYS.EVENTS_PROCESSED);
    if (existing) return;

    await Promise.all([
      this.redis.set(KPI_KEYS.ACTIVE_OUTBREAKS, '42'),
      this.redis.set(KPI_KEYS.VACCINATION_COVERAGE, '67.3'),
      this.redis.set(KPI_KEYS.AVG_LAB_TURNAROUND, '4.2'),
      this.redis.set(KPI_KEYS.QUALITY_PASS_RATE, '89.1'),
      this.redis.set(KPI_KEYS.LAST_UPDATED, new Date().toISOString()),
      this.redis.set(KPI_KEYS.EVENTS_PROCESSED, '0'),
    ]);

    this.logger.log('Mock KPIs seeded into Redis');
  }
}
