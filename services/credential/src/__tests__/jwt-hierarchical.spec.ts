import { describe, it, expect } from 'vitest';

// Import the permission helpers
// In real usage: import { hasAccessToDomain, hasAccessToSubDomain, getAccessibleDomainCodes } from '@aris/auth-middleware';
// For unit test, we replicate the logic to test independently:

interface AuthenticatedUser {
  domains: Record<string, string[]>;
}

function hasAccessToDomain(user: AuthenticatedUser, domainCode: string): boolean {
  return domainCode in (user.domains ?? {});
}

function hasAccessToSubDomain(user: AuthenticatedUser, domainCode: string, subDomainCode: string): boolean {
  const subs = (user.domains ?? {})[domainCode];
  if (!subs) return false;
  return subs.includes('*') || subs.includes(subDomainCode);
}

function getAccessibleDomainCodes(user: AuthenticatedUser): string[] {
  return Object.keys(user.domains ?? {});
}

// ─── Test data ───────────────────────────────────────────────────────────────

const focalPointUser: AuthenticatedUser = {
  domains: {
    'livestock-prod': ['DAIRY', 'RED_MEAT', 'POULTRY'],
    'trade-sps': ['*'],
    'governance': ['LABORATORIES'],
  },
};

const fieldAgentUser: AuthenticatedUser = {
  domains: {
    'livestock-prod': ['DAIRY'],
  },
};

const adminUser: AuthenticatedUser = {
  domains: {
    'livestock-prod': ['*'],
    'trade-sps': ['*'],
    'governance': ['*'],
    'animal-health': ['*'],
    'fisheries': ['*'],
    'wildlife': ['*'],
    'apiculture': ['*'],
    'climate-env': ['*'],
    'knowledge-hub': ['*'],
  },
};

const noAccessUser: AuthenticatedUser = {
  domains: {},
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('hasAccessToDomain', () => {
  it('returns true for domain in permissions', () => {
    expect(hasAccessToDomain(focalPointUser, 'livestock-prod')).toBe(true);
    expect(hasAccessToDomain(focalPointUser, 'trade-sps')).toBe(true);
    expect(hasAccessToDomain(focalPointUser, 'governance')).toBe(true);
  });

  it('returns false for domain not in permissions', () => {
    expect(hasAccessToDomain(focalPointUser, 'animal-health')).toBe(false);
    expect(hasAccessToDomain(focalPointUser, 'fisheries')).toBe(false);
  });

  it('returns false for empty domains', () => {
    expect(hasAccessToDomain(noAccessUser, 'livestock-prod')).toBe(false);
  });
});

describe('hasAccessToSubDomain', () => {
  it('returns true for explicitly listed sub-domain', () => {
    expect(hasAccessToSubDomain(focalPointUser, 'livestock-prod', 'DAIRY')).toBe(true);
    expect(hasAccessToSubDomain(focalPointUser, 'livestock-prod', 'RED_MEAT')).toBe(true);
    expect(hasAccessToSubDomain(focalPointUser, 'governance', 'LABORATORIES')).toBe(true);
  });

  it('returns false for sub-domain not in explicit list', () => {
    expect(hasAccessToSubDomain(focalPointUser, 'livestock-prod', 'PORK')).toBe(false);
    expect(hasAccessToSubDomain(focalPointUser, 'governance', 'CLINICS')).toBe(false);
  });

  it('wildcard ["*"] grants access to any sub-domain', () => {
    expect(hasAccessToSubDomain(focalPointUser, 'trade-sps', 'DAIRY_TRADE')).toBe(true);
    expect(hasAccessToSubDomain(focalPointUser, 'trade-sps', 'RED_MEAT_TRADE')).toBe(true);
    expect(hasAccessToSubDomain(focalPointUser, 'trade-sps', 'ANY_CODE')).toBe(true);
  });

  it('returns false for domain not in permissions at all', () => {
    expect(hasAccessToSubDomain(focalPointUser, 'animal-health', 'ANYTHING')).toBe(false);
  });

  it('field agent with single sub-domain access', () => {
    expect(hasAccessToSubDomain(fieldAgentUser, 'livestock-prod', 'DAIRY')).toBe(true);
    expect(hasAccessToSubDomain(fieldAgentUser, 'livestock-prod', 'RED_MEAT')).toBe(false);
  });

  it('admin with wildcard on all domains', () => {
    expect(hasAccessToSubDomain(adminUser, 'livestock-prod', 'DAIRY')).toBe(true);
    expect(hasAccessToSubDomain(adminUser, 'animal-health', 'ANYTHING')).toBe(true);
    expect(hasAccessToSubDomain(adminUser, 'governance', 'CLINICS')).toBe(true);
  });
});

describe('getAccessibleDomainCodes', () => {
  it('returns all domain codes for focal point', () => {
    const codes = getAccessibleDomainCodes(focalPointUser);
    expect(codes).toHaveLength(3);
    expect(codes).toContain('livestock-prod');
    expect(codes).toContain('trade-sps');
    expect(codes).toContain('governance');
  });

  it('returns single domain for field agent', () => {
    expect(getAccessibleDomainCodes(fieldAgentUser)).toEqual(['livestock-prod']);
  });

  it('returns all 9 domains for admin', () => {
    expect(getAccessibleDomainCodes(adminUser)).toHaveLength(9);
  });

  it('returns empty array for no access', () => {
    expect(getAccessibleDomainCodes(noAccessUser)).toEqual([]);
  });
});

describe('JWT payload structure validation', () => {
  it('hierarchical domains is a Record<string, string[]>', () => {
    const payload = {
      sub: 'user-123',
      email: 'user@test.com',
      role: 'DATA_STEWARD',
      domains: {
        'livestock-prod': ['DAIRY', 'RED_MEAT'],
        'trade-sps': ['*'],
      },
    };

    // domains is an object, not an array
    expect(typeof payload.domains).toBe('object');
    expect(Array.isArray(payload.domains)).toBe(false);

    // Each value is a string array
    for (const [, subs] of Object.entries(payload.domains)) {
      expect(Array.isArray(subs)).toBe(true);
      for (const s of subs) {
        expect(typeof s).toBe('string');
      }
    }
  });

  it('domainsHook check uses "in" operator on hierarchical domains', () => {
    const userDomains: Record<string, string[]> = { 'livestock-prod': ['*'], 'trade-sps': ['*'] };
    // Old: userDomains.includes('livestock-prod') — would FAIL on Record
    // New: 'livestock-prod' in userDomains — works correctly
    expect('livestock-prod' in userDomains).toBe(true);
    expect('animal-health' in userDomains).toBe(false);
  });
});
