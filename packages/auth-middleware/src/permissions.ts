import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

/**
 * Check if user has access to a domain (any sub-domain).
 */
export function hasAccessToDomain(user: AuthenticatedUser, domainCode: string): boolean {
  return domainCode in (user.domains ?? {});
}

/**
 * Check if user has access to a specific sub-domain within a domain.
 * Wildcard ["*"] grants access to all active sub-domains.
 */
export function hasAccessToSubDomain(
  user: AuthenticatedUser,
  domainCode: string,
  subDomainCode: string,
): boolean {
  const subs = (user.domains ?? {})[domainCode];
  if (!subs) return false;
  return subs.includes('*') || subs.includes(subDomainCode);
}

/**
 * Get all domain codes the user has access to.
 */
export function getAccessibleDomainCodes(user: AuthenticatedUser): string[] {
  return Object.keys(user.domains ?? {});
}
