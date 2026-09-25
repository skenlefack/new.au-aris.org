import type { UserRole } from '@aris/shared-types';

/**
 * A nodeCode identifies either a domain ("animal-health")
 * or a subdomain ("animal-health.PPR").
 */
export type NodeCode = string;

/**
 * A levelCode is a UPPER_SNAKE_CASE identifier for an access level
 * within a specific node (e.g., "FIELD_LEVEL", "MANAGEMENT_LEVEL").
 */
export type LevelCode = string;

/**
 * The user's access context: which levels they hold on which nodes.
 * Stored in Redis as `accessContext:{userId}`.
 */
export interface UserAccessContext {
  /** Incremented on every change; can be used for cache staleness detection */
  version: number;
  /** Map of nodeCode → array of levelCodes the user holds */
  scopes: Record<NodeCode, LevelCode[]>;
}

/**
 * The campaign's scope requirements: which levels are required on which nodes.
 * An empty array for a node means the campaign is "open" on that node.
 */
export type CampaignScopes = Record<NodeCode, LevelCode[]>;

/**
 * Options controlling visibility bypass rules.
 */
export interface VisibilityOptions {
  /** User's role (for admin bypass check) */
  userRole: UserRole;
  /** Whether the user is explicitly assigned to the campaign */
  isAssignedAgent: boolean;
  /** Whether the access-levels feature flag is enabled */
  featureEnabled: boolean;
}

/**
 * Full input for the visibility function.
 */
export interface VisibilityInput {
  /** The nodes the user is assigned to (from JWT domains, independent of levels) */
  userNodeCodes: NodeCode[];
  /** The user's access levels per node (from Redis accessContext) */
  userScopes: Record<NodeCode, LevelCode[]>;
  /** The campaign's required levels per node */
  campaignScopes: CampaignScopes;
  /** Bypass options */
  options: VisibilityOptions;
}

/** Admin roles that bypass access-level filtering */
export const ADMIN_BYPASS_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN' as UserRole,
  'CONTINENTAL_ADMIN' as UserRole,
] as const;
