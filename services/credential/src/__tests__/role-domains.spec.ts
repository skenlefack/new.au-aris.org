import { describe, it, expect } from 'vitest';
import { withRoleDomains } from '../services/auth.service';

describe('withRoleDomains', () => {
  it('grants the PAID programme domain to PAID_ADMIN', () => {
    expect(withRoleDomains({}, ['PAID_ADMIN'])).toEqual({ paid: ['*'] });
  });

  it('keeps existing domains and does not override them', () => {
    expect(withRoleDomains({ 'animal-health': ['*'], paid: ['X'] }, ['PAID_ADMIN'])).toEqual({ 'animal-health': ['*'], paid: ['X'] });
  });

  it('leaves other roles unchanged', () => {
    const perms = { 'animal-health': ['*'] };
    expect(withRoleDomains(perms, ['FIELD_AGENT'])).toBe(perms);
  });
});
