import { BaseServiceClient, ServiceClientConfig, ServiceResponse } from './base-client';

// ── DTOs ──

export interface CreateWorkflowInstanceRequest {
  entityType: string;
  entityId: string;
  domain: string;
  dataContractId?: string;
  qualityReportId?: string;
}

export interface WorkflowInstanceResponse {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  domain: string;
  currentLevel: string;
  status: string;
  wahisReady: boolean;
  analyticsReady: boolean;
  createdAt: string;
}

export interface WorkflowApiResponse {
  data: WorkflowInstanceResponse;
}

// ── Client ──

const DEFAULT_WORKFLOW_URL = 'http://localhost:3012';

export class WorkflowClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['WORKFLOW_SERVICE_URL'] ?? config?.baseUrl ?? DEFAULT_WORKFLOW_URL,
      serviceName: 'workflow',
      ...config,
    });
  }

  /**
   * Create a new workflow instance.
   * POST /api/v1/workflow/instances
   */
  async createInstance(
    request: CreateWorkflowInstanceRequest,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<WorkflowApiResponse>> {
    return this.request<WorkflowApiResponse>({
      method: 'POST',
      path: '/api/v1/workflow/instances',
      body: request,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }

  /**
   * Get a workflow instance by ID.
   * GET /api/v1/workflow/instances/:id
   */
  async getInstance(
    id: string,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<WorkflowApiResponse>> {
    return this.request<WorkflowApiResponse>({
      method: 'GET',
      path: `/api/v1/workflow/instances/${id}`,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }
}
