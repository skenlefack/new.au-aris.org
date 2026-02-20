/**
 * Integration test: Analytics Full Flow
 *
 * Tests the pipeline:
 *   1. Consumer receives health events → aggregation → Redis
 *   2. Consumer receives vaccination event → Redis
 *   3. Consumer receives lab results → Redis
 *   4. Consumer receives quality events → Redis
 *   5. Consumer receives workflow approval → Redis
 *   6. KPI endpoint reads aggregated data
 *   7. Trends endpoint returns time-series
 *   8. Quality dashboard endpoint
 *   9. Workflow timeliness endpoint
 *  10. Denominators endpoint
 *  11. CSV export
 *
 * Uses in-memory Redis mock via manual stub.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AggregationService } from '../src/aggregation/aggregation.service';
import { HealthKpiService } from '../src/health-kpi/health-kpi.service';
import type {
  HealthEventPayload,
  VaccinationPayload,
  LabResultPayload,
  QualityRecordPayload,
  WorkflowApprovedPayload,
} from '../src/aggregation/aggregation.service';

// ── In-memory Redis mock ──

class InMemoryRedis {
  private strings = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async del(key: string): Promise<number> {
    const had = this.strings.has(key) || this.hashes.has(key) || this.sortedSets.has(key);
    this.strings.delete(key);
    this.hashes.delete(key);
    this.sortedSets.delete(key);
    return had ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.strings.get(key) ?? '0', 10) + 1;
    this.strings.set(key, String(val));
    return val;
  }

  async incrBy(key: string, amount: number): Promise<number> {
    const val = parseInt(this.strings.get(key) ?? '0', 10) + amount;
    this.strings.set(key, String(val));
    return val;
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const h = this.hashes.get(key)!;
    const isNew = !h.has(field);
    h.set(field, value);
    return isNew ? 1 : 0;
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const h = this.hashes.get(key);
    if (!h) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of h.entries()) result[k] = v;
    return result;
  }

  async hIncrBy(key: string, field: string, amount: number): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const h = this.hashes.get(key)!;
    const val = parseInt(h.get(field) ?? '0', 10) + amount;
    h.set(field, String(val));
    return val;
  }

  async hIncrByFloat(key: string, field: string, amount: number): Promise<string> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const h = this.hashes.get(key)!;
    const val = parseFloat(h.get(field) ?? '0') + amount;
    h.set(field, String(val));
    return String(val);
  }

  async hMSet(key: string, data: Record<string, string>): Promise<'OK'> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const h = this.hashes.get(key)!;
    for (const [k, v] of Object.entries(data)) h.set(k, v);
    return 'OK';
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, []);
    const set = this.sortedSets.get(key)!;
    set.push({ score, member });
    set.sort((a, b) => a.score - b.score);
    return 1;
  }

  async zRangeByScore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const set = this.sortedSets.get(key) ?? [];
    const minVal = min === '-inf' ? -Infinity : Number(min);
    const maxVal = max === '+inf' ? Infinity : Number(max);
    return set
      .filter((e) => e.score >= minVal && e.score <= maxVal)
      .map((e) => e.member);
  }

  async zRangeByScoreWithScores(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<Array<{ member: string; score: number }>> {
    const set = this.sortedSets.get(key) ?? [];
    const minVal = min === '-inf' ? -Infinity : Number(min);
    const maxVal = max === '+inf' ? Infinity : Number(max);
    return set.filter((e) => e.score >= minVal && e.score <= maxVal);
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '[^:]*').replace(/\?/g, '.') + '$',
    );
    const allKeys = new Set<string>();
    for (const k of this.strings.keys()) {
      if (regex.test(k)) allKeys.add(k);
    }
    for (const k of this.hashes.keys()) {
      if (regex.test(k)) allKeys.add(k);
    }
    for (const k of this.sortedSets.keys()) {
      if (regex.test(k)) allKeys.add(k);
    }
    return Array.from(allKeys);
  }

  getClient() {
    return this;
  }
}

describe('Analytics — Full Flow (Integration)', () => {
  let redis: InMemoryRedis;
  let aggregation: AggregationService;
  let kpiService: HealthKpiService;

  beforeAll(() => {
    redis = new InMemoryRedis();
    aggregation = new AggregationService(redis as never);
    kpiService = new HealthKpiService(redis as never);
  });

  // ── Step 1: Health Events ──

  it('Step 1: Health event created → increments active outbreaks', async () => {
    const event1: HealthEventPayload = {
      id: 'evt-001',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      diseaseId: 'FMD',
      cases: 5,
      deaths: 2,
      eventType: 'SUSPECT',
      timestamp: '2026-02-10T10:00:00Z',
    };

    const event2: HealthEventPayload = {
      id: 'evt-002',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      diseaseId: 'FMD',
      cases: 3,
      deaths: 0,
      eventType: 'SUSPECT',
      timestamp: '2026-02-12T08:00:00Z',
    };

    const event3: HealthEventPayload = {
      id: 'evt-003',
      tenantId: 'tenant-ng',
      countryCode: 'NG',
      diseaseId: 'PPR',
      cases: 10,
      deaths: 5,
      eventType: 'SUSPECT',
      timestamp: '2026-02-11T14:00:00Z',
    };

    await aggregation.handleHealthEventCreated(event1);
    await aggregation.handleHealthEventCreated(event2);
    await aggregation.handleHealthEventCreated(event3);

    // Verify Redis state directly
    const keData = await redis.hGetAll('analytics:health:KE:FMD');
    expect(parseInt(keData['active'])).toBe(2);
    expect(parseInt(keData['cases'])).toBe(8);
    expect(parseInt(keData['deaths'])).toBe(2);

    const ngData = await redis.hGetAll('analytics:health:NG:PPR');
    expect(parseInt(ngData['active'])).toBe(1);
    expect(parseInt(ngData['cases'])).toBe(10);
  });

  // ── Step 2: Health Event Confirmed ──

  it('Step 2: Health event confirmed → updates confirmed count', async () => {
    await aggregation.handleHealthEventConfirmed({
      id: 'evt-001',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      diseaseId: 'FMD',
    });

    const data = await redis.hGetAll('analytics:health:KE:FMD');
    expect(parseInt(data['confirmed'])).toBe(1);
  });

  // ── Step 3: Vaccination ──

  it('Step 3: Vaccination completed → updates coverage', async () => {
    const payload: VaccinationPayload = {
      id: 'vac-001',
      tenantId: 'tenant-ke',
      countryCode: 'KE',
      diseaseId: 'FMD',
      dosesUsed: 5000,
      targetPopulation: 20000,
      coverageEstimate: 25,
    };

    await aggregation.handleVaccinationCompleted(payload);

    const data = await redis.hGetAll('analytics:vaccination:KE:FMD');
    expect(parseInt(data['doses'])).toBe(5000);
    expect(parseFloat(data['coverage'])).toBe(25);
    expect(parseInt(data['campaigns'])).toBe(1);

    // Second campaign
    await aggregation.handleVaccinationCompleted({
      ...payload,
      id: 'vac-002',
      dosesUsed: 3000,
      targetPopulation: 10000,
    });

    const updated = await redis.hGetAll('analytics:vaccination:KE:FMD');
    expect(parseInt(updated['doses'])).toBe(8000);
    // 8000/30000 = 26.67
    expect(parseFloat(updated['coverage'])).toBeCloseTo(26.67, 1);
    expect(parseInt(updated['campaigns'])).toBe(2);
  });

  // ── Step 4: Lab Results ──

  it('Step 4: Lab results → updates turnaround and positive rate', async () => {
    await aggregation.handleLabResultCreated({
      id: 'lab-001', tenantId: 'tenant-ke', countryCode: 'KE',
      result: 'POSITIVE', turnaroundDays: 3,
    });
    await aggregation.handleLabResultCreated({
      id: 'lab-002', tenantId: 'tenant-ke', countryCode: 'KE',
      result: 'NEGATIVE', turnaroundDays: 5,
    });
    await aggregation.handleLabResultCreated({
      id: 'lab-003', tenantId: 'tenant-ke', countryCode: 'KE',
      result: 'POSITIVE', turnaroundDays: 4,
    });

    const data = await redis.hGetAll('analytics:lab:KE');
    expect(parseInt(data['totalTests'])).toBe(3);
    expect(parseInt(data['positiveCount'])).toBe(2);
    // (3+5+4)/3 = 4
    expect(parseFloat(data['avgTurnaround'])).toBe(4);
    // 2/3 = 66.67
    expect(parseFloat(data['positiveRate'])).toBeCloseTo(66.67, 1);
  });

  // ── Step 5: Quality Events ──

  it('Step 5: Quality validated/rejected → updates pass/fail rates', async () => {
    // 8 passed, 2 rejected
    for (let i = 0; i < 8; i++) {
      await aggregation.handleQualityValidated({
        id: `rec-pass-${i}`, tenantId: 'tenant-ke', entityType: 'health_event',
      });
    }
    for (let i = 0; i < 2; i++) {
      await aggregation.handleQualityRejected({
        id: `rec-fail-${i}`, tenantId: 'tenant-ke', entityType: 'health_event',
      });
    }

    const data = await redis.hGetAll('analytics:quality:global');
    expect(parseInt(data['totalRecords'])).toBe(10);
    expect(parseInt(data['passCount'])).toBe(8);
    expect(parseInt(data['failCount'])).toBe(2);
    expect(parseFloat(data['passRate'])).toBe(80);
    expect(parseFloat(data['failRate'])).toBe(20);
  });

  // ── Step 6: Workflow Timeliness ──

  it('Step 6: Workflow approval → updates timeliness', async () => {
    await aggregation.handleWorkflowApproved({
      instanceId: 'wf-001', tenantId: 'tenant-ke',
      level: 'NATIONAL_TECHNICAL', daysAtLevel: 2,
    });
    await aggregation.handleWorkflowApproved({
      instanceId: 'wf-002', tenantId: 'tenant-ke',
      level: 'NATIONAL_TECHNICAL', daysAtLevel: 4,
    });
    await aggregation.handleWorkflowApproved({
      instanceId: 'wf-003', tenantId: 'tenant-ke',
      level: 'NATIONAL_OFFICIAL', daysAtLevel: 5,
    });

    const data = await redis.hGetAll('analytics:workflow:timeliness');
    expect(parseFloat(data['NATIONAL_TECHNICAL:avgDays'])).toBe(3);
    expect(parseInt(data['NATIONAL_TECHNICAL:count'])).toBe(2);
    expect(parseFloat(data['NATIONAL_OFFICIAL:avgDays'])).toBe(5);
    expect(parseInt(data['NATIONAL_OFFICIAL:count'])).toBe(1);
  });

  // ── Step 7: Health KPIs Endpoint ──

  it('Step 7: GET /analytics/health/kpis — global aggregation', async () => {
    const kpis = await kpiService.getHealthKpis();

    expect(kpis.activeOutbreaks).toBe(3); // 2 KE:FMD + 1 NG:PPR
    expect(kpis.confirmed).toBe(1);
    expect(kpis.suspected).toBe(2); // 3 - 1
    expect(kpis.cases).toBe(18); // 8 + 10
    expect(kpis.deaths).toBe(7); // 2 + 5
    expect(kpis.qualityPassRate).toBe(80);
  });

  it('Step 7b: GET /analytics/health/kpis?country=KE&disease=FMD — filtered', async () => {
    const kpis = await kpiService.getHealthKpis('KE', 'FMD');

    expect(kpis.activeOutbreaks).toBe(2);
    expect(kpis.confirmed).toBe(1);
    expect(kpis.cases).toBe(8);
    expect(kpis.deaths).toBe(2);
  });

  // ── Step 8: Health Trends ──

  it('Step 8: GET /analytics/health/trends — time series data', async () => {
    const trends = await kpiService.getHealthTrends(1);

    expect(trends.period).toBe('1m');
    expect(trends.totalEvents).toBeGreaterThanOrEqual(3);
    expect(trends.entries[0]).toHaveProperty('countryCode');
    expect(trends.entries[0]).toHaveProperty('diseaseId');
    expect(trends.entries[0]).toHaveProperty('cases');
  });

  // ── Step 9: Quality Dashboard ──

  it('Step 9: GET /analytics/quality/dashboard — quality metrics', async () => {
    const dashboard = await kpiService.getQualityDashboard();

    expect(dashboard.passRate).toBe(80);
    expect(dashboard.failRate).toBe(20);
    expect(dashboard.totalRecords).toBe(10);
    expect(dashboard.passCount).toBe(8);
    expect(dashboard.failCount).toBe(2);
  });

  // ── Step 10: Workflow Timeliness ──

  it('Step 10: GET /analytics/workflow/timeliness — per level', async () => {
    const timeliness = await kpiService.getWorkflowTimeliness();

    expect(timeliness.levels['NATIONAL_TECHNICAL'].avgDays).toBe(3);
    expect(timeliness.levels['NATIONAL_TECHNICAL'].count).toBe(2);
    expect(timeliness.levels['NATIONAL_OFFICIAL'].avgDays).toBe(5);
    expect(timeliness.levels['REC_HARMONIZATION'].count).toBe(0);
  });

  // ── Step 11: Denominators ──

  it('Step 11: GET /analytics/denominators — vaccination coverage data', async () => {
    const denoms = await kpiService.getDenominators('KE');

    expect(denoms).toHaveLength(1);
    expect(denoms[0].countryCode).toBe('KE');
    expect(denoms[0].diseaseId).toBe('FMD');
    expect(denoms[0].dosesUsed).toBe(8000);
    expect(denoms[0].campaigns).toBe(2);
  });

  // ── Step 12: Disease Breakdown ──

  it('Step 12: Disease-level KPI breakdown', async () => {
    const breakdown = await kpiService.getHealthKpisByDisease();

    expect(breakdown.length).toBeGreaterThanOrEqual(2);
    const keFmd = breakdown.find(
      (b) => b.countryCode === 'KE' && b.diseaseId === 'FMD',
    );
    expect(keFmd).toBeDefined();
    expect(keFmd!.active).toBe(2);
    expect(keFmd!.confirmed).toBe(1);
  });
});
