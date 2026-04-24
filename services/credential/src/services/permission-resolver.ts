import type { PrismaClient } from '@prisma/client';

/**
 * Resolves user permissions to sub-domains.
 *
 * A user has a `permissions` JSON on the User model (or via UserDomain + metadata):
 * {
 *   "livestock-prod": ["DAIRY", "RED_MEAT"],   // explicit codes
 *   "trade-sps": ["*"],                         // wildcard = all active sub-domains
 *   "governance": ["LABORATORIES"]
 * }
 *
 * Rules:
 * 1. "*" = all active sub-domains of that domain (present and future)
 * 2. Explicit list = only those codes AND that are active
 * 3. Inactive sub-domains are NEVER returned
 * 4. Missing domain = no access
 * 5. SUPER_ADMIN / CONTINENTAL_ADMIN = access to everything
 */

export interface SubDomainAccess {
  id: string;
  code: string;
  domainCode: string;
  valueChainCode: string | null;
  labelFr: string;
  labelEn: string;
  typeEnum: string;
  active: boolean;
}

export interface ValueChainAccess {
  code: string;
  labelFr: string;
  labelEn: string;
  accessibleVia: string[]; // e.g. ["livestock-prod.DAIRY", "trade-sps.DAIRY_TRADE"]
}

export interface UserAccess {
  userId: string;
  role: string;
  domains: Record<string, string[]>; // domainCode → subDomain codes or ["*"]
  subDomainsDetails: SubDomainAccess[];
  valueChainCodes: ValueChainAccess[];
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'];

export class PermissionResolver {
  constructor(private readonly prisma: PrismaClient) {}

  private db() { return this.prisma as any; }

  /**
   * Get the permissions map for a user.
   * For admins: returns all domains with "*".
   * For others: reads from user.permissions JSON field (if it exists),
   * otherwise falls back to user's assigned domains with "*" each.
   */
  private async getUserPermissionsMap(userId: string): Promise<{ role: string; perms: Record<string, string[]> }> {
    const user = await this.db().user.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true, userDomains: { include: { domain: true } } },
    });
    if (!user) throw new Error(`User ${userId} not found`);

    // Admins get full access
    if (ADMIN_ROLES.includes(user.role)) {
      const allDomains = await this.db().domain.findMany({
        where: { isActive: true },
        select: { code: true },
      });
      const perms: Record<string, string[]> = {};
      for (const d of allDomains) {
        perms[d.code] = ['*'];
      }
      return { role: user.role, perms };
    }

    // If user has a permissions JSON field, use it
    if (user.permissions && typeof user.permissions === 'object') {
      return { role: user.role, perms: user.permissions as Record<string, string[]> };
    }

    // Fallback: user's assigned domains via UserDomain, with wildcard
    const perms: Record<string, string[]> = {};
    for (const ud of (user.userDomains ?? [])) {
      if (ud.domain && ud.isActive) {
        perms[ud.domain.code] = ['*'];
      }
    }
    return { role: user.role, perms };
  }

  /**
   * Resolve the full access structure for a user.
   */
  async resolveUserAccess(userId: string): Promise<UserAccess> {
    const { role, perms } = await this.getUserPermissionsMap(userId);

    const domainCodes = Object.keys(perms);
    if (domainCodes.length === 0) {
      return { userId, role, domains: {}, subDomainsDetails: [], valueChainCodes: [] };
    }

    // Load all domains the user has access to
    const domains = await this.db().domain.findMany({
      where: { code: { in: domainCodes }, isActive: true },
      select: { id: true, code: true },
    });

    const domainIdToCode: Record<string, string> = {};
    for (const d of domains) domainIdToCode[d.id] = d.code;

    // Load all active sub-domains for these domains
    const allSubDomains = await this.db().subDomain.findMany({
      where: {
        domainId: { in: domains.map((d: any) => d.id) },
        active: true,
      },
      include: { domain: { select: { code: true } } },
      orderBy: { displayOrder: 'asc' },
    });

    // Filter by permissions
    const accessibleSubDomains: SubDomainAccess[] = [];
    const resolvedDomains: Record<string, string[]> = {};

    for (const sd of allSubDomains) {
      const domainCode = sd.domain.code;
      const userPermsForDomain = perms[domainCode];
      if (!userPermsForDomain) continue;

      const hasAccess = userPermsForDomain.includes('*') || userPermsForDomain.includes(sd.code);
      if (!hasAccess) continue;

      accessibleSubDomains.push({
        id: sd.id,
        code: sd.code,
        domainCode,
        valueChainCode: sd.valueChainCode,
        labelFr: sd.labelFr,
        labelEn: sd.labelEn,
        typeEnum: sd.typeEnum,
        active: sd.active,
      });

      if (!resolvedDomains[domainCode]) resolvedDomains[domainCode] = [];
      resolvedDomains[domainCode].push(sd.code);
    }

    // Preserve wildcard notation in domains map
    for (const [dc, codes] of Object.entries(perms)) {
      if (codes.includes('*') && domains.some((d: any) => d.code === dc)) {
        resolvedDomains[dc] = ['*'];
      }
    }

    // Build value chain codes accessible
    const vccMap = new Map<string, { labelFr: string; labelEn: string; accessibleVia: string[] }>();
    for (const sd of accessibleSubDomains) {
      if (!sd.valueChainCode) continue;
      if (!vccMap.has(sd.valueChainCode)) {
        // Fetch label from DB
        const vcc = await this.db().valueChainCode.findUnique({ where: { code: sd.valueChainCode } });
        vccMap.set(sd.valueChainCode, {
          labelFr: vcc?.labelFr ?? sd.valueChainCode,
          labelEn: vcc?.labelEn ?? sd.valueChainCode,
          accessibleVia: [],
        });
      }
      vccMap.get(sd.valueChainCode)!.accessibleVia.push(`${sd.domainCode}.${sd.code}`);
    }

    const valueChainCodes: ValueChainAccess[] = [];
    for (const [code, info] of vccMap) {
      valueChainCodes.push({ code, ...info });
    }

    return { userId, role, domains: resolvedDomains, subDomainsDetails: accessibleSubDomains, valueChainCodes };
  }

  /**
   * Simple check: can user access a specific sub-domain?
   */
  async canAccessSubDomain(userId: string, domainCode: string, subDomainCode: string): Promise<boolean> {
    const { perms } = await this.getUserPermissionsMap(userId);
    const codes = perms[domainCode];
    if (!codes) return false;
    if (codes.includes('*')) {
      // Check sub-domain is active
      const domain = await this.db().domain.findUnique({ where: { code: domainCode } });
      if (!domain) return false;
      const sd = await this.db().subDomain.findUnique({
        where: { domainId_code: { domainId: domain.id, code: subDomainCode } },
      });
      return sd?.active === true;
    }
    return codes.includes(subDomainCode);
  }

  /**
   * Transverse check: can user access any sub-domain with this value chain code?
   */
  async canAccessValueChain(userId: string, valueChainCode: string): Promise<boolean> {
    const access = await this.resolveUserAccess(userId);
    return access.valueChainCodes.some((vc) => vc.code === valueChainCode);
  }
}
