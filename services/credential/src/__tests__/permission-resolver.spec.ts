import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionResolver } from '../services/permission-resolver.js';

function createMockPrisma() {
  return {
    user: { findUnique: vi.fn() },
    domain: { findMany: vi.fn(), findUnique: vi.fn() },
    subDomain: { findMany: vi.fn(), findUnique: vi.fn() },
    valueChainCode: { findUnique: vi.fn() },
  } as any;
}

const DOMAINS = [
  { id: 'd1', code: 'livestock-prod', isActive: true },
  { id: 'd2', code: 'trade-sps', isActive: true },
  { id: 'd3', code: 'governance', isActive: true },
];

const SUB_DOMAINS = [
  { id: 's1', code: 'DAIRY', domainId: 'd1', valueChainCode: 'DAIRY', labelFr: 'Lait', labelEn: 'Dairy', typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 10, domain: { code: 'livestock-prod' } },
  { id: 's2', code: 'RED_MEAT', domainId: 'd1', valueChainCode: 'RED_MEAT', labelFr: 'Viande rouge', labelEn: 'Red meat', typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 20, domain: { code: 'livestock-prod' } },
  { id: 's3', code: 'APICULTURE', domainId: 'd1', valueChainCode: 'APICULTURE', labelFr: 'Apiculture', labelEn: 'Apiculture', typeEnum: 'VALUE_CHAIN', active: false, displayOrder: 60, domain: { code: 'livestock-prod' } },
  { id: 's4', code: 'DAIRY_TRADE', domainId: 'd2', valueChainCode: 'DAIRY', labelFr: 'Commerce du lait', labelEn: 'Dairy trade', typeEnum: 'VALUE_CHAIN', active: true, displayOrder: 10, domain: { code: 'trade-sps' } },
  { id: 's5', code: 'CLINICS', domainId: 'd3', valueChainCode: null, labelFr: 'Cliniques', labelEn: 'Clinics', typeEnum: 'ORGANIZATIONAL', active: true, displayOrder: 10, domain: { code: 'governance' } },
  { id: 's6', code: 'LABORATORIES', domainId: 'd3', valueChainCode: null, labelFr: 'Laboratoires', labelEn: 'Laboratories', typeEnum: 'ORGANIZATIONAL', active: true, displayOrder: 60, domain: { code: 'governance' } },
];

describe('PermissionResolver', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let resolver: PermissionResolver;

  beforeEach(() => {
    prisma = createMockPrisma();
    resolver = new PermissionResolver(prisma);

    // Default mock: return active sub-domains (excluding APICULTURE which is inactive)
    prisma.subDomain.findMany.mockImplementation(async ({ where }: any) => {
      return SUB_DOMAINS.filter((sd) => {
        if (where.active === true && !sd.active) return false;
        if (where.domainId?.in) return where.domainId.in.includes(sd.domainId);
        return true;
      });
    });

    prisma.domain.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.code?.in) return DOMAINS.filter((d) => where.code.in.includes(d.code));
      if (where?.isActive) return DOMAINS;
      return DOMAINS;
    });

    prisma.valueChainCode.findUnique.mockImplementation(async ({ where }: any) => {
      const map: Record<string, any> = {
        'DAIRY': { code: 'DAIRY', labelFr: 'Lait', labelEn: 'Dairy' },
        'RED_MEAT': { code: 'RED_MEAT', labelFr: 'Viande rouge', labelEn: 'Red meat' },
      };
      return map[where.code] ?? null;
    });
  });

  describe('resolveUserAccess — wildcard', () => {
    it('user with ["*"] on livestock-prod should see all active sub-domains (not APICULTURE)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'DATA_STEWARD',
        permissions: { 'livestock-prod': ['*'] },
        userDomains: [],
      });

      const access = await resolver.resolveUserAccess('user-1');

      expect(access.domains['livestock-prod']).toEqual(['*']);
      const codes = access.subDomainsDetails.map((sd) => sd.code);
      expect(codes).toContain('DAIRY');
      expect(codes).toContain('RED_MEAT');
      expect(codes).not.toContain('APICULTURE'); // inactive
    });
  });

  describe('resolveUserAccess — explicit list', () => {
    it('user with explicit codes sees only those codes', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'FIELD_AGENT',
        permissions: { 'livestock-prod': ['DAIRY'], 'governance': ['LABORATORIES'] },
        userDomains: [],
      });

      const access = await resolver.resolveUserAccess('user-2');

      expect(access.subDomainsDetails).toHaveLength(2);
      expect(access.subDomainsDetails[0].code).toBe('DAIRY');
      expect(access.subDomainsDetails[1].code).toBe('LABORATORIES');
    });
  });

  describe('resolveUserAccess — admin', () => {
    it('SUPER_ADMIN gets wildcard on all domains', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'SUPER_ADMIN',
        permissions: null,
        userDomains: [],
      });

      const access = await resolver.resolveUserAccess('admin-1');

      expect(Object.keys(access.domains)).toHaveLength(3);
      for (const codes of Object.values(access.domains)) {
        expect(codes).toEqual(['*']);
      }
    });
  });

  describe('resolveUserAccess — transverse value chain', () => {
    it('user with access to livestock-prod + trade-sps should see DAIRY in valueChainCodes', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'DATA_STEWARD',
        permissions: { 'livestock-prod': ['DAIRY'], 'trade-sps': ['DAIRY_TRADE'] },
        userDomains: [],
      });

      const access = await resolver.resolveUserAccess('user-3');

      const dairyVcc = access.valueChainCodes.find((vc) => vc.code === 'DAIRY');
      expect(dairyVcc).toBeDefined();
      expect(dairyVcc!.accessibleVia).toContain('livestock-prod.DAIRY');
      expect(dairyVcc!.accessibleVia).toContain('trade-sps.DAIRY_TRADE');
    });
  });

  describe('canAccessSubDomain', () => {
    it('returns true for wildcard access on active sub-domain', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'DATA_STEWARD',
        permissions: { 'livestock-prod': ['*'] },
        userDomains: [],
      });
      prisma.domain.findUnique.mockResolvedValue(DOMAINS[0]);
      prisma.subDomain.findUnique.mockResolvedValue({ active: true });

      const result = await resolver.canAccessSubDomain('user-1', 'livestock-prod', 'DAIRY');
      expect(result).toBe(true);
    });

    it('returns false for inactive sub-domain even with wildcard', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'DATA_STEWARD',
        permissions: { 'livestock-prod': ['*'] },
        userDomains: [],
      });
      prisma.domain.findUnique.mockResolvedValue(DOMAINS[0]);
      prisma.subDomain.findUnique.mockResolvedValue({ active: false });

      const result = await resolver.canAccessSubDomain('user-1', 'livestock-prod', 'APICULTURE');
      expect(result).toBe(false);
    });

    it('returns false for domain not in permissions', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'FIELD_AGENT',
        permissions: { 'governance': ['CLINICS'] },
        userDomains: [],
      });

      const result = await resolver.canAccessSubDomain('user-4', 'livestock-prod', 'DAIRY');
      expect(result).toBe(false);
    });
  });

  describe('canAccessValueChain', () => {
    it('returns true when user has access to a sub-domain with that value chain code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'DATA_STEWARD',
        permissions: { 'livestock-prod': ['DAIRY'] },
        userDomains: [],
      });

      const result = await resolver.canAccessValueChain('user-1', 'DAIRY');
      expect(result).toBe(true);
    });

    it('returns false when user has no sub-domain with that value chain code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'FIELD_AGENT',
        permissions: { 'governance': ['CLINICS'] },
        userDomains: [],
      });

      const result = await resolver.canAccessValueChain('user-5', 'DAIRY');
      expect(result).toBe(false);
    });
  });
});
