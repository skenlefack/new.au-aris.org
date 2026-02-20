import { BaseServiceClient, ServiceClientConfig, ServiceResponse } from './base-client';

// ── DTOs ──

export interface PatchHealthEventRequest {
  wahisReady?: boolean;
  analyticsReady?: boolean;
}

export interface HealthEventResponse {
  id: string;
  tenantId: string;
  diseaseId: string;
  eventType: string;
  wahisReady: boolean;
  createdAt: string;
}

export interface HealthEventApiResponse {
  data: HealthEventResponse;
}

// ── Client ──

const DEFAULT_ANIMAL_HEALTH_URL = 'http://localhost:3020';

export class AnimalHealthClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['ANIMAL_HEALTH_SERVICE_URL'] ?? config?.baseUrl ?? DEFAULT_ANIMAL_HEALTH_URL,
      serviceName: 'animal-health',
      ...config,
    });
  }

  /**
   * Patch a health event (e.g. set wahisReady, analyticsReady flags).
   * PATCH /api/v1/animal-health/health-events/:id
   */
  async patchHealthEvent(
    id: string,
    body: PatchHealthEventRequest,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<HealthEventApiResponse>> {
    return this.request<HealthEventApiResponse>({
      method: 'PATCH',
      path: `/api/v1/animal-health/health-events/${id}`,
      body,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }

  /**
   * Patch any domain entity by type and ID (generic callback for workflow).
   * PATCH /api/v1/animal-health/{entityType}/{id}
   */
  async patchEntity(
    entityType: string,
    id: string,
    body: Record<string, unknown>,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<unknown>> {
    // Convert entityType to kebab-case URL segment
    const segment = entityType.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return this.request({
      method: 'PATCH',
      path: `/api/v1/animal-health/${segment}/${id}`,
      body,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }
}
