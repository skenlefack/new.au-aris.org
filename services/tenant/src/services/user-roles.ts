/**
 * Rules for a user's primary role (the `role` column on the user).
 *
 * A user gets roles from two places: roles ticked directly on the user, and
 * roles linked to the user's functions. The primary role is the most
 * privileged of them that maps to a system role.
 */

/** System roles, most privileged first. */
export const PRIMARY_ROLE_PRIORITY = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'PAID_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
  'DATA_STEWARD',
  'WAHIS_FOCAL_POINT',
  'CONTINENTAL_LABORATORY',
  'REGIONAL_LABORATORY',
  'NATIONAL_LABORATORY',
  'KNOWLEDGE_MANAGER',
  'ANALYST',
  'DECISION_MAKER',
  'FIELD_AGENT',
] as const;

export type PrimaryRole = (typeof PRIMARY_ROLE_PRIORITY)[number];

/** Governance roles that stand for a system role. */
export const ROLE_ALIASES: Record<string, PrimaryRole> = {
  DATA_STEWARD_NATIONAL: 'DATA_STEWARD',
  DATA_STEWARD_REGIONAL: 'DATA_STEWARD',
  DATA_STEWARD_CONTINENTAL: 'DATA_STEWARD',
  DATA_COLLECTOR_NATIONAL: 'FIELD_AGENT',
  DATA_COLLECTOR_REGIONAL: 'FIELD_AGENT',
  DATA_COLLECTOR_CONTINENTAL: 'FIELD_AGENT',
};

/** The system role a role code stands for, or null if it has none. */
export function toPrimaryRole(code: string): PrimaryRole | null {
  if ((PRIMARY_ROLE_PRIORITY as readonly string[]).includes(code)) return code as PrimaryRole;
  return ROLE_ALIASES[code] ?? null;
}

/** Lower is more privileged. Unknown codes rank last. */
export function roleRank(code: string | null | undefined): number {
  const primary = code ? toPrimaryRole(code) : null;
  return primary ? PRIMARY_ROLE_PRIORITY.indexOf(primary) : PRIMARY_ROLE_PRIORITY.length;
}

/** Most privileged system role among the codes, or null if none maps to one. */
export function resolvePrimaryRole(codes: Iterable<string>): PrimaryRole | null {
  let best: PrimaryRole | null = null;
  for (const code of codes) {
    const primary = toPrimaryRole(code);
    if (primary && (best === null || roleRank(primary) < roleRank(best))) best = primary;
  }
  return best;
}
