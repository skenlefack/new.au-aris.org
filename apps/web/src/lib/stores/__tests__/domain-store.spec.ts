import { describe, it, expect, beforeEach } from 'vitest';
import type { SubDomain, ValueChainCode } from '../domain-store';

// We test the store logic in isolation by replicating the getter functions
// (Zustand stores are hard to unit-test with persist middleware in Node)

function createState(
  domainPermissions: Record<string, string[]>,
  subDomainsMetadata: SubDomain[],
  valueChainCodes: ValueChainCode[],
) {
  const hasAccessToSubDomain = (domainCode: string, subDomainCode: string) => {
    const subs = domainPermissions[domainCode];
    if (!subs) return false;
    return subs.includes('*') || subs.includes(subDomainCode);
  };

  return {
    domainPermissions,
    subDomainsMetadata,
    valueChainCodes,

    hasAccess: (code: string) => code in domainPermissions,
    hasAccessToSubDomain,

    hasAccessToValueChain: (valueChainCode: string) => {
      return subDomainsMetadata
        .filter((sd) => sd.valueChainCode === valueChainCode && sd.active)
        .some((sd) => hasAccessToSubDomain(sd.domainCode, sd.code));
    },

    getSubDomainsOfDomain: (domainCode: string) => {
      return subDomainsMetadata
        .filter((sd) => sd.domainCode === domainCode && sd.active && hasAccessToSubDomain(domainCode, sd.code))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },

    getSubDomainsByValueChain: (valueChainCode: string) => {
      return subDomainsMetadata
        .filter((sd) => sd.valueChainCode === valueChainCode && sd.active && hasAccessToSubDomain(sd.domainCode, sd.code))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },

    getAccessibleValueChainCodes: () => {
      const accessible = new Set<string>();
      for (const sd of subDomainsMetadata) {
        if (sd.valueChainCode && sd.active && hasAccessToSubDomain(sd.domainCode, sd.code)) {
          accessible.add(sd.valueChainCode);
        }
      }
      return Array.from(accessible);
    },
  };
}

// ─── Test data ───────────────────────────────────────────────────────────────

const SUB_DOMAINS: SubDomain[] = [
  { id: '1', code: 'DAIRY', domainCode: 'livestock-prod', valueChainCode: 'DAIRY', labelFr: 'Lait', labelEn: 'Dairy', labelAr: null, labelPt: null, typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 10, description: null },
  { id: '2', code: 'RED_MEAT', domainCode: 'livestock-prod', valueChainCode: 'RED_MEAT', labelFr: 'Viande rouge', labelEn: 'Red meat', labelAr: null, labelPt: null, typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 20, description: null },
  { id: '3', code: 'APICULTURE', domainCode: 'livestock-prod', valueChainCode: 'APICULTURE', labelFr: 'Apiculture', labelEn: 'Apiculture', labelAr: null, labelPt: null, typeEnum: 'VALUE_CHAIN', active: false, displayOrder: 60, description: null },
  { id: '4', code: 'DAIRY_TRADE', domainCode: 'trade-sps', valueChainCode: 'DAIRY', labelFr: 'Commerce du lait', labelEn: 'Dairy trade', labelAr: null, labelPt: null, typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 10, description: null },
  { id: '5', code: 'CLINICS', domainCode: 'governance', valueChainCode: null, labelFr: 'Cliniques', labelEn: 'Clinics', labelAr: null, labelPt: null, typeEnum: 'ORGANIZATIONAL', active: true, displayOrder: 10, description: null },
  { id: '6', code: 'LABORATORIES', domainCode: 'governance', valueChainCode: null, labelFr: 'Laboratoires', labelEn: 'Laboratories', labelAr: null, labelPt: null, typeEnum: 'ORGANIZATIONAL', active: true, displayOrder: 60, description: null },
];

const VALUE_CHAINS: ValueChainCode[] = [
  { code: 'DAIRY', labelFr: 'Lait', labelEn: 'Dairy', labelAr: null, labelPt: null, active: true, displayOrder: 10 },
  { code: 'RED_MEAT', labelFr: 'Viande rouge', labelEn: 'Red meat', labelAr: null, labelPt: null, active: true, displayOrder: 20 },
  { code: 'APICULTURE', labelFr: 'Apiculture', labelEn: 'Apiculture', labelAr: null, labelPt: null, active: true, displayOrder: 70 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DomainStore — wildcard permissions', () => {
  const state = createState({ 'livestock-prod': ['*'], 'trade-sps': ['*'] }, SUB_DOMAINS, VALUE_CHAINS);

  it('hasAccess returns true for domains in permissions', () => {
    expect(state.hasAccess('livestock-prod')).toBe(true);
    expect(state.hasAccess('trade-sps')).toBe(true);
    expect(state.hasAccess('governance')).toBe(false);
  });

  it('getSubDomainsOfDomain returns active subs sorted by displayOrder', () => {
    const subs = state.getSubDomainsOfDomain('livestock-prod');
    expect(subs).toHaveLength(2); // APICULTURE is inactive
    expect(subs[0].code).toBe('DAIRY');
    expect(subs[1].code).toBe('RED_MEAT');
  });

  it('inactive sub-domains are never returned', () => {
    const subs = state.getSubDomainsOfDomain('livestock-prod');
    expect(subs.find((s) => s.code === 'APICULTURE')).toBeUndefined();
  });

  it('hasAccessToValueChain returns true for DAIRY (transverse)', () => {
    expect(state.hasAccessToValueChain('DAIRY')).toBe(true);
  });

  it('getSubDomainsByValueChain returns subs from multiple domains', () => {
    const subs = state.getSubDomainsByValueChain('DAIRY');
    expect(subs).toHaveLength(2);
    expect(subs.map((s) => s.domainCode)).toContain('livestock-prod');
    expect(subs.map((s) => s.domainCode)).toContain('trade-sps');
  });
});

describe('DomainStore — explicit permissions', () => {
  const state = createState(
    { 'livestock-prod': ['DAIRY'], 'governance': ['LABORATORIES'] },
    SUB_DOMAINS,
    VALUE_CHAINS,
  );

  it('only returns explicitly listed sub-domains', () => {
    const subs = state.getSubDomainsOfDomain('livestock-prod');
    expect(subs).toHaveLength(1);
    expect(subs[0].code).toBe('DAIRY');
  });

  it('does not return RED_MEAT (not in explicit list)', () => {
    expect(state.hasAccessToSubDomain('livestock-prod', 'RED_MEAT')).toBe(false);
  });

  it('governance LABORATORIES accessible, CLINICS not', () => {
    expect(state.hasAccessToSubDomain('governance', 'LABORATORIES')).toBe(true);
    expect(state.hasAccessToSubDomain('governance', 'CLINICS')).toBe(false);
  });

  it('getAccessibleValueChainCodes returns only DAIRY', () => {
    const codes = state.getAccessibleValueChainCodes();
    expect(codes).toEqual(['DAIRY']);
  });
});

describe('DomainStore — no permissions', () => {
  const state = createState({}, SUB_DOMAINS, VALUE_CHAINS);

  it('hasAccess returns false for all domains', () => {
    expect(state.hasAccess('livestock-prod')).toBe(false);
  });

  it('getSubDomainsOfDomain returns empty', () => {
    expect(state.getSubDomainsOfDomain('livestock-prod')).toEqual([]);
  });

  it('getAccessibleValueChainCodes returns empty', () => {
    expect(state.getAccessibleValueChainCodes()).toEqual([]);
  });
});
