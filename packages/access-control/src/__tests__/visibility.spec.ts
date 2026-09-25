import { describe, it, expect } from 'vitest';
import { canViewCampaign, buildNodeCode, parseNodeCode } from '../visibility';
import type { VisibilityInput } from '../types';
import type { UserRole } from '@aris/shared-types';

// ── Helpers ────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return {
    userNodeCodes: [],
    userScopes: {},
    campaignScopes: {},
    options: {
      userRole: 'FIELD_AGENT' as UserRole,
      isAssignedAgent: false,
      featureEnabled: true,
    },
    ...overrides,
  };
}

// ── Truth Table ────────────────────────────────────────────────────────

describe('canViewCampaign', () => {
  // ── R8: Feature flag disabled ──────────────────────────────────────

  it('returns true when featureEnabled is false (R8 - backward compat)', () => {
    const input = makeInput({
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
      options: { userRole: 'FIELD_AGENT' as UserRole, isAssignedAgent: false, featureEnabled: false },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── R6: Admin bypass ───────────────────────────────────────────────

  it('SUPER_ADMIN sees any campaign (R6 - admin bypass)', () => {
    const input = makeInput({
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
      options: { userRole: 'SUPER_ADMIN' as UserRole, isAssignedAgent: false, featureEnabled: true },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('CONTINENTAL_ADMIN sees any campaign (R6 - admin bypass)', () => {
    const input = makeInput({
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
      options: { userRole: 'CONTINENTAL_ADMIN' as UserRole, isAssignedAgent: false, featureEnabled: true },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('REC_ADMIN does NOT bypass (R6 - only SUPER/CONTINENTAL)', () => {
    const input = makeInput({
      userNodeCodes: [],
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
      options: { userRole: 'REC_ADMIN' as UserRole, isAssignedAgent: false, featureEnabled: true },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── R6: Assigned agent bypass ──────────────────────────────────────

  it('assigned agent sees campaign even without matching levels (R6)', () => {
    const input = makeInput({
      userNodeCodes: [],
      userScopes: {},
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
      options: { userRole: 'FIELD_AGENT' as UserRole, isAssignedAgent: true, featureEnabled: true },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── Backward compatibility: campaign with no scopes ────────────────

  it('campaign with empty scopes is visible to everyone (R8 backward compat)', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: {},
      campaignScopes: {},
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('campaign with empty scopes is visible even to user with no nodes', () => {
    const input = makeInput({
      userNodeCodes: [],
      userScopes: {},
      campaignScopes: {},
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── R4: Open campaign on a node (empty levels array) ───────────────

  it('open campaign on node → visible to user assigned to that node', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: {},
      campaignScopes: { 'animal-health': [] },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('open campaign on node → NOT visible if user is not assigned to that node', () => {
    const input = makeInput({
      userNodeCodes: ['livestock-prod'],
      userScopes: {},
      campaignScopes: { 'animal-health': [] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── R4: Non-empty intersection ─────────────────────────────────────

  it('user has matching level → visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: { 'animal-health': ['LEVEL_A', 'LEVEL_B'] },
      campaignScopes: { 'animal-health': ['LEVEL_B', 'LEVEL_C'] },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── R4: Empty intersection ─────────────────────────────────────────

  it('user has no matching level → NOT visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: { 'animal-health': ['LEVEL_A'] },
      campaignScopes: { 'animal-health': ['LEVEL_B', 'LEVEL_C'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── R3: Node not covered ───────────────────────────────────────────

  it('user not assigned to any campaign node → NOT visible', () => {
    const input = makeInput({
      userNodeCodes: ['fisheries'],
      userScopes: { fisheries: ['LEVEL_A'] },
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── R1: No propagation domain ↔ subdomain ─────────────────────────

  it('user on domain does NOT inherit subdomain levels (R1)', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: { 'animal-health': ['LEVEL_A'] },
      campaignScopes: { 'animal-health.PPR': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  it('user on subdomain does NOT inherit domain levels (R1)', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health.PPR'],
      userScopes: { 'animal-health.PPR': ['LEVEL_A'] },
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  it('user on one subdomain does NOT see campaign on sibling subdomain (R1)', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health.PPR'],
      userScopes: { 'animal-health.PPR': ['LEVEL_A'] },
      campaignScopes: { 'animal-health.AMR': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── R5: User without levels on a node ──────────────────────────────

  it('user assigned to node but with no levels → sees open campaigns only', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: {},
      campaignScopes: { 'animal-health': [] },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('user assigned to node but with no levels → does NOT see restricted campaigns', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: {},
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  // ── Multi-node campaigns ───────────────────────────────────────────

  it('multi-node campaign: user matches one node → visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health', 'livestock-prod'],
      userScopes: {
        'animal-health': ['LEVEL_X'],
        'livestock-prod': ['LEVEL_A'],
      },
      campaignScopes: {
        'animal-health': ['LEVEL_A'], // no match
        'livestock-prod': ['LEVEL_A'], // match!
      },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('multi-node campaign: user matches no node → NOT visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health', 'livestock-prod'],
      userScopes: {
        'animal-health': ['LEVEL_X'],
        'livestock-prod': ['LEVEL_Y'],
      },
      campaignScopes: {
        'animal-health': ['LEVEL_A'],
        'livestock-prod': ['LEVEL_A'],
      },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  it('multi-node campaign with one open node: user on open node → visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health', 'livestock-prod'],
      userScopes: { 'animal-health': ['LEVEL_X'] },
      campaignScopes: {
        'animal-health': ['LEVEL_A'], // no match
        'livestock-prod': [], // open
      },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── Mixed domain + subdomain campaign ──────────────────────────────

  it('campaign on domain + subdomain: user matches subdomain only → visible', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health.PPR'],
      userScopes: { 'animal-health.PPR': ['LEVEL_A'] },
      campaignScopes: {
        'animal-health': ['LEVEL_B'], // user not on this node
        'animal-health.PPR': ['LEVEL_A'], // match
      },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── Deactivated levels ─────────────────────────────────────────────
  // Deactivated levels are filtered out BEFORE reaching canViewCampaign.
  // If somehow present, they should be treated as any other level code.

  it('deactivated level still matches if present in input (filtering is upstream)', () => {
    const input = makeInput({
      userNodeCodes: ['animal-health'],
      userScopes: { 'animal-health': ['DEACTIVATED_LEVEL'] },
      campaignScopes: { 'animal-health': ['DEACTIVATED_LEVEL'] },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it('user has levels but is not in userNodeCodes → NOT visible', () => {
    // This tests that userNodeCodes (from JWT domains) is the gate,
    // not just userScopes
    const input = makeInput({
      userNodeCodes: [], // not assigned to any node
      userScopes: { 'animal-health': ['LEVEL_A'] }, // has levels (anomaly)
      campaignScopes: { 'animal-health': ['LEVEL_A'] },
    });
    expect(canViewCampaign(input)).toBe(false);
  });

  it('campaign with single node, single level, exact match', () => {
    const input = makeInput({
      userNodeCodes: ['trade-sps'],
      userScopes: { 'trade-sps': ['EXPORT_CERT'] },
      campaignScopes: { 'trade-sps': ['EXPORT_CERT'] },
    });
    expect(canViewCampaign(input)).toBe(true);
  });

  it('campaign targets many nodes, user only on one with no levels → sees only if open', () => {
    const input = makeInput({
      userNodeCodes: ['fisheries'],
      userScopes: {},
      campaignScopes: {
        'animal-health': ['LEVEL_A'],
        'livestock-prod': ['LEVEL_B'],
        fisheries: ['LEVEL_C'],
      },
    });
    // fisheries has levels, user has none on fisheries → cannot see
    expect(canViewCampaign(input)).toBe(false);
  });
});

// ── Utility functions ────────────────────────────────────────────────

describe('buildNodeCode', () => {
  it('returns domain code when no subdomain', () => {
    expect(buildNodeCode('animal-health')).toBe('animal-health');
  });

  it('returns domain.subdomain when subdomain provided', () => {
    expect(buildNodeCode('animal-health', 'PPR')).toBe('animal-health.PPR');
  });

  it('returns domain code when subdomain is null', () => {
    expect(buildNodeCode('animal-health', null)).toBe('animal-health');
  });

  it('returns domain code when subdomain is empty string', () => {
    expect(buildNodeCode('animal-health', '')).toBe('animal-health');
  });
});

describe('parseNodeCode', () => {
  it('parses domain-only nodeCode', () => {
    expect(parseNodeCode('animal-health')).toEqual({
      domainCode: 'animal-health',
      subDomainCode: undefined,
    });
  });

  it('parses domain.subdomain nodeCode', () => {
    expect(parseNodeCode('animal-health.PPR')).toEqual({
      domainCode: 'animal-health',
      subDomainCode: 'PPR',
    });
  });

  it('handles subdomain with underscores', () => {
    expect(parseNodeCode('livestock-prod.RED_MEAT')).toEqual({
      domainCode: 'livestock-prod',
      subDomainCode: 'RED_MEAT',
    });
  });
});
