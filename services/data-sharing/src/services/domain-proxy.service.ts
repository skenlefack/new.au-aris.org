/**
 * ARIS 4.0 — Domain Proxy Service
 * Proxies data requests to domain microservices on behalf of data sharing agreements.
 */

const DOMAIN_SERVICE_MAP: Record<string, string> = {
  'animal-health': 'http://animal-health:3020',
  'livestock-prod': 'http://livestock-prod:3021',
  'fisheries': 'http://fisheries:3022',
  'wildlife': 'http://wildlife:3023',
  'apiculture': 'http://apiculture:3024',
  'trade-sps': 'http://trade-sps:3025',
  'governance': 'http://governance:3026',
  'climate-env': 'http://climate-env:3027',
};

/** Default list endpoint per domain — maps domain to its primary API path. */
const DOMAIN_LIST_ENDPOINTS: Record<string, string> = {
  'animal-health': '/api/v1/animal-health/outbreaks',
  'livestock-prod': '/api/v1/livestock-prod/census',
  'fisheries': '/api/v1/fisheries/captures',
  'wildlife': '/api/v1/wildlife/inventories',
  'apiculture': '/api/v1/apiculture/apiaries',
  'trade-sps': '/api/v1/trade-sps/flows',
  'governance': '/api/v1/governance/frameworks',
  'climate-env': '/api/v1/climate-env/assessments',
};

/** Entity-specific sub-endpoints within a domain. */
const ENTITY_ENDPOINTS: Record<string, Record<string, string>> = {
  'animal-health': {
    outbreaks: '/api/v1/animal-health/outbreaks',
    surveillance: '/api/v1/animal-health/surveillance',
    lab_results: '/api/v1/animal-health/lab-results',
    vaccinations: '/api/v1/animal-health/vaccinations',
  },
  'livestock-prod': {
    census: '/api/v1/livestock-prod/census',
    production: '/api/v1/livestock-prod/production',
    slaughter: '/api/v1/livestock-prod/slaughter',
  },
  fisheries: {
    captures: '/api/v1/fisheries/captures',
    vessels: '/api/v1/fisheries/vessels',
    aquaculture_farms: '/api/v1/fisheries/aquaculture/farms',
    aquaculture_production: '/api/v1/fisheries/aquaculture/production',
  },
  wildlife: {
    inventories: '/api/v1/wildlife/inventories',
    protected_areas: '/api/v1/wildlife/protected-areas',
    cites: '/api/v1/wildlife/cites',
  },
  apiculture: {
    apiaries: '/api/v1/apiculture/apiaries',
    production: '/api/v1/apiculture/production',
    colony_health: '/api/v1/apiculture/colony-health',
  },
  'trade-sps': {
    flows: '/api/v1/trade-sps/flows',
    certificates: '/api/v1/trade-sps/certificates',
    markets: '/api/v1/trade-sps/markets',
  },
  governance: {
    frameworks: '/api/v1/governance/frameworks',
    capacities: '/api/v1/governance/capacities',
  },
  'climate-env': {
    assessments: '/api/v1/climate-env/assessments',
    rangelands: '/api/v1/climate-env/rangelands',
  },
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 30_000;

export interface DomainQueryParams {
  page?: number;
  limit?: number;
  countries?: string[];
  admin1?: string[];
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

export interface DomainDataResult {
  data: Record<string, unknown>[];
  meta: Record<string, unknown>;
}

export class DomainProxyService {
  /**
   * Resolve the base URL for a given domain name.
   * Throws if the domain is not known.
   */
  getBaseUrl(domain: string): string {
    const url = DOMAIN_SERVICE_MAP[domain];
    if (!url) {
      throw new Error(`Unknown domain: ${domain}. Known domains: ${Object.keys(DOMAIN_SERVICE_MAP).join(', ')}`);
    }
    return url;
  }

  /**
   * Resolve the list endpoint for a domain + optional entity.
   */
  resolveEndpoint(domain: string, entity?: string): string {
    if (entity) {
      const entityMap = ENTITY_ENDPOINTS[domain];
      if (entityMap && entityMap[entity]) {
        return entityMap[entity];
      }
    }
    const defaultEndpoint = DOMAIN_LIST_ENDPOINTS[domain];
    if (!defaultEndpoint) {
      throw new Error(`No default endpoint for domain: ${domain}`);
    }
    return defaultEndpoint;
  }

  /**
   * Query a domain service for data, with retry logic.
   */
  async queryDomainData(
    domain: string,
    endpoint: string,
    queryParams: DomainQueryParams,
    authToken: string,
  ): Promise<DomainDataResult> {
    const baseUrl = this.getBaseUrl(domain);
    const url = new URL(endpoint, baseUrl);

    // Build query string from params
    if (queryParams.page) url.searchParams.set('page', String(queryParams.page));
    if (queryParams.limit) url.searchParams.set('limit', String(queryParams.limit));
    if (queryParams.countries?.length) {
      for (const c of queryParams.countries) {
        url.searchParams.append('country', c);
      }
    }
    if (queryParams.admin1?.length) {
      for (const a of queryParams.admin1) {
        url.searchParams.append('admin1', a);
      }
    }
    if (queryParams.dateFrom) url.searchParams.set('dateFrom', queryParams.dateFrom);
    if (queryParams.dateTo) url.searchParams.set('dateTo', queryParams.dateTo);

    // Add any extra filters
    for (const [key, value] of Object.entries(queryParams)) {
      if (['page', 'limit', 'countries', 'admin1', 'dateFrom', 'dateTo'].includes(key)) continue;
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.fetchWithRetry(url.toString(), authToken);
  }

  /**
   * Export data from a domain service in a specific format.
   * Falls back to querying the list endpoint if no dedicated export endpoint exists.
   */
  async exportDomainData(
    domain: string,
    endpoint: string,
    format: 'json' | 'csv',
    queryParams: DomainQueryParams,
    authToken: string,
  ): Promise<DomainDataResult> {
    // Try the list endpoint with a large limit (exports retrieve all matching records)
    const params: DomainQueryParams = {
      ...queryParams,
      limit: queryParams.limit ?? 10000,
      page: 1,
    };

    return this.queryDomainData(domain, endpoint, params, authToken);
  }

  /**
   * Fetch with retry logic and timeout.
   */
  private async fetchWithRetry(url: string, authToken: string): Promise<DomainDataResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Domain service returned ${response.status}: ${body}`);
        }

        const json = await response.json() as Record<string, unknown>;

        // Domain services return { data, meta } structure
        const data = (Array.isArray(json['data']) ? json['data'] : []) as Record<string, unknown>[];
        const meta = (typeof json['meta'] === 'object' && json['meta'] !== null ? json['meta'] : {}) as Record<string, unknown>;

        return { data, meta };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on client errors (4xx)
        if (lastError.message.includes('returned 4')) {
          break;
        }

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error('Domain proxy request failed');
  }
}
