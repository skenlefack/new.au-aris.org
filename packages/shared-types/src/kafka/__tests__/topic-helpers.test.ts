import { describe, it, expect } from 'vitest';
import { domainSubDomainTopic } from '../topic-names';

describe('domainSubDomainTopic', () => {
  it('builds correct topic with default version', () => {
    expect(domainSubDomainTopic('ms', 'livestock-prod', 'dairy', 'metric.updated'))
      .toBe('ms.livestock-prod.dairy.metric.updated.v1');
  });

  it('lowercases domain and subdomain codes', () => {
    expect(domainSubDomainTopic('ms', 'LIVESTOCK_PRODUCTION', 'DAIRY', 'metric.updated'))
      .toBe('ms.livestock_production.dairy.metric.updated.v1');
  });

  it('supports custom version', () => {
    expect(domainSubDomainTopic('au', 'trade-sps', 'dairy_trade', 'import.recorded', 'v2'))
      .toBe('au.trade-sps.dairy_trade.import.recorded.v2');
  });

  it('supports all scopes', () => {
    expect(domainSubDomainTopic('ms', 'governance', 'laboratories', 'capacity.updated'))
      .toBe('ms.governance.laboratories.capacity.updated.v1');
    expect(domainSubDomainTopic('rec', 'governance', 'laboratories', 'capacity.updated'))
      .toBe('rec.governance.laboratories.capacity.updated.v1');
    expect(domainSubDomainTopic('au', 'governance', 'laboratories', 'capacity.updated'))
      .toBe('au.governance.laboratories.capacity.updated.v1');
    expect(domainSubDomainTopic('sys', 'governance', 'laboratories', 'capacity.updated'))
      .toBe('sys.governance.laboratories.capacity.updated.v1');
  });
});
