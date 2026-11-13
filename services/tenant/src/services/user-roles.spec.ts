import { describe, it, expect } from 'vitest';
import { resolvePrimaryRole, roleRank, toPrimaryRole } from './user-roles';

describe('user-roles', () => {
  it('picks the most privileged system role', () => {
    expect(resolvePrimaryRole(['FIELD_AGENT', 'NATIONAL_ADMIN', 'DATA_STEWARD'])).toBe('NATIONAL_ADMIN');
  });

  it('maps governance roles to their system role', () => {
    expect(resolvePrimaryRole(['DATA_COLLECTOR_NATIONAL', 'DATA_STEWARD_NATIONAL'])).toBe('DATA_STEWARD');
    expect(toPrimaryRole('DATA_COLLECTOR_REGIONAL')).toBe('FIELD_AGENT');
  });

  it('ignores custom roles with no system equivalent', () => {
    expect(resolvePrimaryRole(['NAT_ADMIN', 'LAB_FP'])).toBeNull();
    expect(resolvePrimaryRole(['NAT_ADMIN', 'FIELD_AGENT'])).toBe('FIELD_AGENT');
  });

  it('keeps PAID_ADMIN above NATIONAL_ADMIN', () => {
    expect(resolvePrimaryRole(['NATIONAL_ADMIN', 'PAID_ADMIN'])).toBe('PAID_ADMIN');
  });

  it('ranks unknown codes last', () => {
    expect(roleRank('SUPER_ADMIN')).toBe(0);
    expect(roleRank('NAT_ADMIN')).toBeGreaterThan(roleRank('FIELD_AGENT'));
    expect(roleRank(undefined)).toBeGreaterThan(roleRank('FIELD_AGENT'));
  });
});
