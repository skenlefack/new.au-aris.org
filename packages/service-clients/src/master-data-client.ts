import { BaseServiceClient, ServiceClientConfig, ServiceResponse } from './base-client';

// ── DTOs ──

export interface DiseaseResponse {
  id: string;
  code: string;
  name: string;
  woahListed: boolean;
  category: string;
}

export interface DiseaseApiResponse {
  data: DiseaseResponse;
}

export interface SpeciesResponse {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface SpeciesApiResponse {
  data: SpeciesResponse;
}

// ── Client ──

const DEFAULT_MASTER_DATA_URL = 'http://localhost:3003';

export class MasterDataClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['MASTER_DATA_SERVICE_URL'] ?? config?.baseUrl ?? DEFAULT_MASTER_DATA_URL,
      serviceName: 'master-data',
      ...config,
    });
  }

  /**
   * Get a disease by ID (for WOAH-listed lookup).
   * GET /api/v1/master-data/diseases/:id
   */
  async getDisease(
    id: string,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<DiseaseApiResponse>> {
    return this.request<DiseaseApiResponse>({
      method: 'GET',
      path: `/api/v1/master-data/diseases/${id}`,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }

  /**
   * Get a species by ID.
   * GET /api/v1/master-data/species/:id
   */
  async getSpecies(
    id: string,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<SpeciesApiResponse>> {
    return this.request<SpeciesApiResponse>({
      method: 'GET',
      path: `/api/v1/master-data/species/${id}`,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }
}
