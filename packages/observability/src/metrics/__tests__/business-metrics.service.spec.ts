import { describe, it, expect, beforeEach } from 'vitest';
import * as client from 'prom-client';
import { BusinessMetricsService } from '../business-metrics.service';

beforeEach(() => {
  client.register.clear();
});

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;

  beforeEach(() => {
    service = new BusinessMetricsService();
  });

  it('should increment a generic counter', async () => {
    service.increment('test_counter', { region: 'east_africa' });
    service.increment('test_counter', { region: 'east_africa' });

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_test_counter');
    expect(metrics).toContain('east_africa');
  });

  it('should set a gauge value', async () => {
    service.setGauge('pending_reviews', 15, { level: 'national' });

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_pending_reviews');
    expect(metrics).toContain('15');
  });

  it('should record domain events created', async () => {
    service.recordEventCreated('health');
    service.recordEventCreated('fisheries');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_events_created_total');
    expect(metrics).toContain('health');
    expect(metrics).toContain('fisheries');
  });

  it('should record forms submitted', async () => {
    service.recordFormSubmitted('tenant-ke');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_forms_submitted_total');
    expect(metrics).toContain('tenant-ke');
  });

  it('should record workflows completed', async () => {
    service.recordWorkflowCompleted('level_2');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_workflows_completed_total');
  });

  it('should record outbreaks reported', async () => {
    service.recordOutbreakReported('KE');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_outbreaks_reported_total');
    expect(metrics).toContain('KE');
  });

  it('should record interop exports', async () => {
    service.recordInteropExport('WAHIS');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_interop_exports_total');
    expect(metrics).toContain('WAHIS');
  });

  it('should set active users gauge', async () => {
    service.setActiveUsers(250);

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_active_users');
    expect(metrics).toContain('250');
  });

  it('should set active campaigns gauge', async () => {
    service.setActiveCampaigns(12);

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_business_active_campaigns');
    expect(metrics).toContain('12');
  });
});
