/**
 * Maps each ARIS business domain to the ref-data types it uses.
 * Cross-domain types (shared by all) are listed under '*'.
 */
export const DATASET_DOMAIN_MAP: Record<string, string[]> = {
  '*': [
    'species-groups', 'species', 'age-groups', 'diseases',
    'commodities', 'infrastructures', 'animal-sexes',
    'animal-husbandries', 'genetic-diversities', 'data-sources',
  ],
  'animal-health': [
    'clinical-signs', 'control-measures', 'sample-types',
    'contamination-sources', 'vaccine-types', 'test-types', 'labs',
    'diagnosis-bases', 'body-parts', 'causal-agent-types',
    'outbreak-statuses', 'epidemiological-unit-types',
    'notification-reasons', 'source-of-infections',
  ],
  'livestock-prod': [
    'breeds', 'census-methodologies', 'production-systems', 'livestock-products',
  ],
  'fisheries': [
    'gear-types', 'vessel-types', 'aquaculture-farm-types',
    'landing-sites', 'fish-families',
  ],
  'wildlife': [
    'conservation-statuses', 'habitat-types', 'crime-types',
  ],
  'apiculture': [
    'hive-types', 'bee-diseases', 'floral-sources',
  ],
  'trade-sps': [
    'seizure-reasons', 'abattoirs', 'markets', 'checkpoints',
    'transport-modes',
  ],
  'governance': [
    'legal-framework-types', 'stakeholder-types',
  ],
  'climate-env': [],
  'knowledge-hub': [],
};

/**
 * Returns the set of ref-data types accessible by the given domain codes.
 * Always includes cross-domain ('*') types.
 * If domainCodes is empty, returns ALL types (SUPER_ADMIN behavior).
 */
export function getAllowedRefDataTypes(domainCodes: string[]): Set<string> {
  if (domainCodes.length === 0) {
    // No restriction — return all types
    const all = new Set<string>();
    for (const types of Object.values(DATASET_DOMAIN_MAP)) {
      types.forEach((t) => all.add(t));
    }
    return all;
  }

  const allowed = new Set<string>(DATASET_DOMAIN_MAP['*'] ?? []);
  for (const code of domainCodes) {
    const types = DATASET_DOMAIN_MAP[code];
    if (types) {
      types.forEach((t) => allowed.add(t));
    }
  }
  return allowed;
}
