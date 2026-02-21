import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

const PREFIX = 'aris_business_';

@Injectable()
export class BusinessMetricsService {
  private readonly counters = new Map<string, client.Counter>();
  private readonly gauges = new Map<string, client.Gauge>();

  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): client.Counter {
    const fullName = `${PREFIX}${name}`;
    let counter = this.counters.get(fullName);
    if (!counter) {
      try {
        counter = new client.Counter({
          name: fullName,
          help,
          labelNames,
        });
      } catch {
        // Metric already registered (e.g. in tests) — retrieve existing
        counter = client.register.getSingleMetric(fullName) as client.Counter;
      }
      this.counters.set(fullName, counter);
    }
    return counter;
  }

  private getOrCreateGauge(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): client.Gauge {
    const fullName = `${PREFIX}${name}`;
    let gauge = this.gauges.get(fullName);
    if (!gauge) {
      try {
        gauge = new client.Gauge({
          name: fullName,
          help,
          labelNames,
        });
      } catch {
        gauge = client.register.getSingleMetric(fullName) as client.Gauge;
      }
      this.gauges.set(fullName, gauge);
    }
    return gauge;
  }

  /** Increment a named counter. Creates on first use. */
  increment(
    name: string,
    labels?: Record<string, string>,
    help?: string,
  ): void {
    const labelNames = labels ? Object.keys(labels) : [];
    const counter = this.getOrCreateCounter(
      name,
      help ?? `Business counter: ${name}`,
      labelNames,
    );
    counter.inc(labels ?? {});
  }

  /** Set a named gauge value. Creates on first use. */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
    help?: string,
  ): void {
    const labelNames = labels ? Object.keys(labels) : [];
    const gauge = this.getOrCreateGauge(
      name,
      help ?? `Business gauge: ${name}`,
      labelNames,
    );
    gauge.set(labels ?? {}, value);
  }

  // ── Convenience methods for common ARIS events ──

  recordEventCreated(domain: string): void {
    this.increment('events_created_total', { domain }, 'Total domain events created');
  }

  recordFormSubmitted(tenantId: string): void {
    this.increment(
      'forms_submitted_total',
      { tenant_id: tenantId },
      'Total forms submitted',
    );
  }

  recordWorkflowCompleted(level: string): void {
    this.increment(
      'workflows_completed_total',
      { level },
      'Total workflows completed',
    );
  }

  recordOutbreakReported(country: string): void {
    this.increment(
      'outbreaks_reported_total',
      { country },
      'Total outbreaks reported',
    );
  }

  recordInteropExport(target: string): void {
    this.increment(
      'interop_exports_total',
      { target },
      'Total interop exports',
    );
  }

  setActiveUsers(count: number): void {
    this.setGauge('active_users', count, {}, 'Number of active users');
  }

  setActiveCampaigns(count: number): void {
    this.setGauge('active_campaigns', count, {}, 'Number of active campaigns');
  }
}
