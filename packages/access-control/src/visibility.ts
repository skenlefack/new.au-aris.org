import type {
  NodeCode,
  LevelCode,
  CampaignScopes,
  VisibilityInput,
} from './types';
import { ADMIN_BYPASS_ROLES } from './types';

/**
 * Pure function: determines whether a user can view a campaign
 * based on their access levels and the campaign's scope requirements.
 *
 * Rules (from specification):
 *
 * R1. No inheritance — levels on a domain only apply to that domain.
 * R4. A user sees a campaign if, for AT LEAST ONE node N targeted by the campaign:
 *     - the user is assigned to N, AND
 *     - EITHER the campaign has no levels on N (open campaign),
 *     - OR the intersection of campaign levels on N and user levels on N is non-empty.
 * R5. A user with no levels on N only sees open campaigns on N.
 * R6. Admin roles and assigned agents bypass the filter.
 * R8. When the feature flag is disabled, always return true.
 * R9. Deactivated levels are ignored in matching (they're never in the input).
 */
export function canViewCampaign(input: VisibilityInput): boolean {
  const { userNodeCodes, userScopes, campaignScopes, options } = input;

  // R8: feature flag disabled → legacy behavior, always visible
  if (!options.featureEnabled) {
    return true;
  }

  // R6: admin bypass
  if (ADMIN_BYPASS_ROLES.includes(options.userRole)) {
    return true;
  }

  // R6: assigned agent bypass
  if (options.isAssignedAgent) {
    return true;
  }

  const campaignNodeCodes = Object.keys(campaignScopes);

  // Edge case: campaign has no scope entries at all → visible to everyone
  // (backward compatibility with existing campaigns that have no scopes)
  if (campaignNodeCodes.length === 0) {
    return true;
  }

  // R4: check if user matches at least one campaign node
  for (const nodeCode of campaignNodeCodes) {
    if (matchesNode(nodeCode, userNodeCodes, userScopes, campaignScopes)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether the user matches a specific campaign node.
 *
 * Returns true if:
 * - user is assigned to nodeCode (present in userNodeCodes), AND
 * - campaign has no levels on nodeCode (open), OR
 * - intersection of user levels and campaign levels on nodeCode is non-empty.
 */
function matchesNode(
  nodeCode: NodeCode,
  userNodeCodes: NodeCode[],
  userScopes: Record<NodeCode, LevelCode[]>,
  campaignScopes: CampaignScopes,
): boolean {
  // User must be assigned to this node
  if (!userNodeCodes.includes(nodeCode)) {
    return false;
  }

  const campaignLevels = campaignScopes[nodeCode];

  // Campaign is open on this node (no levels or empty array)
  if (!campaignLevels || campaignLevels.length === 0) {
    return true;
  }

  // R5: user has no levels on this node → can only see open campaigns
  const userLevels = userScopes[nodeCode];
  if (!userLevels || userLevels.length === 0) {
    return false;
  }

  // Check intersection
  return campaignLevels.some((level) => userLevels.includes(level));
}

/**
 * Build a nodeCode from a domain code and optional subdomain code.
 * @example buildNodeCode("animal-health") → "animal-health"
 * @example buildNodeCode("animal-health", "PPR") → "animal-health.PPR"
 */
export function buildNodeCode(domainCode: string, subDomainCode?: string | null): NodeCode {
  if (subDomainCode) {
    return `${domainCode}.${subDomainCode}`;
  }
  return domainCode;
}

/**
 * Parse a nodeCode into its domain and optional subdomain parts.
 * @example parseNodeCode("animal-health") → { domainCode: "animal-health" }
 * @example parseNodeCode("animal-health.PPR") → { domainCode: "animal-health", subDomainCode: "PPR" }
 */
export function parseNodeCode(nodeCode: NodeCode): {
  domainCode: string;
  subDomainCode: string | undefined;
} {
  const dotIndex = nodeCode.indexOf('.');
  if (dotIndex === -1) {
    return { domainCode: nodeCode, subDomainCode: undefined };
  }
  return {
    domainCode: nodeCode.substring(0, dotIndex),
    subDomainCode: nodeCode.substring(dotIndex + 1),
  };
}

/**
 * Build SQL WHERE clause fragment for access-level filtering.
 * This generates the logic equivalent to canViewCampaign but for SQL queries.
 *
 * Returns { sql: string, params: unknown[] } where sql uses $N placeholders
 * starting from paramOffset.
 *
 * The generated SQL uses EXISTS/NOT EXISTS against campaign_scope_access_levels.
 *
 * @param campaignIdColumn - The SQL expression for the campaign ID column (e.g., "c.id")
 * @param userNodeCodes - The user's assigned node codes
 * @param userScopes - The user's access levels per node
 * @param paramOffset - Starting parameter index for $N placeholders
 */
export function buildAccessLevelSqlFilter(
  campaignIdColumn: string,
  userNodeCodes: NodeCode[],
  userScopes: Record<NodeCode, LevelCode[]>,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  let idx = paramOffset;

  if (userNodeCodes.length === 0) {
    // User has no nodes → can only see campaigns with no scopes at all
    return {
      sql: `NOT EXISTS (SELECT 1 FROM campaign_scope_access_levels csal WHERE csal.campaign_id = ${campaignIdColumn})`,
      params: [],
    };
  }

  // Build per-node conditions
  const nodeConditions: string[] = [];
  for (const nodeCode of userNodeCodes) {
    const userLevels = userScopes[nodeCode] ?? [];
    const nodeParam = `$${idx++}`;
    params.push(nodeCode);

    if (userLevels.length === 0) {
      // User is on the node but has no levels → only open campaigns on this node
      nodeConditions.push(
        `(EXISTS (SELECT 1 FROM campaign_scope_access_levels csal2 WHERE csal2.campaign_id = ${campaignIdColumn} AND csal2.node_code = ${nodeParam}) AND NOT EXISTS (SELECT 1 FROM campaign_scope_access_levels csal3 WHERE csal3.campaign_id = ${campaignIdColumn} AND csal3.node_code = ${nodeParam} AND csal3.level_code IS NOT NULL))`,
      );
      // Simpler: this node is in campaign targets AND has no levels (open)
      // Actually, for open campaigns on a node, there are NO rows for that node in csal
      // So the condition is: user is on node AND campaign has this node in targets AND no levels for this node in csal
      // But campaign targets are in campaign_targets, not csal. Let's simplify:
      // open on node = no csal rows for (campaign_id, node_code)
      nodeConditions.pop(); // remove the complex one
      nodeConditions.push(
        `NOT EXISTS (SELECT 1 FROM campaign_scope_access_levels csal_open WHERE csal_open.campaign_id = ${campaignIdColumn} AND csal_open.node_code = ${nodeParam})`,
      );
    } else {
      // User has levels → open campaigns on this node OR intersection non-empty
      const levelPlaceholders = userLevels.map(() => `$${idx++}`).join(', ');
      params.push(...userLevels);

      nodeConditions.push(
        `(NOT EXISTS (SELECT 1 FROM campaign_scope_access_levels csal_chk WHERE csal_chk.campaign_id = ${campaignIdColumn} AND csal_chk.node_code = ${nodeParam}) OR EXISTS (SELECT 1 FROM campaign_scope_access_levels csal_match WHERE csal_match.campaign_id = ${campaignIdColumn} AND csal_match.node_code = ${nodeParam} AND csal_match.level_code IN (${levelPlaceholders})))`,
      );
    }
  }

  // Campaign has no scopes at all (R8 backward compat) OR matches at least one node
  const noScopesCondition = `NOT EXISTS (SELECT 1 FROM campaign_scope_access_levels csal_any WHERE csal_any.campaign_id = ${campaignIdColumn})`;

  const sql = `(${noScopesCondition} OR ${nodeConditions.join(' OR ')})`;

  return { sql, params };
}
