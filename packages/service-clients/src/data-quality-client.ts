import { BaseServiceClient, ServiceClientConfig, ServiceResponse } from './base-client';

// ── DTOs ──

export interface ValidateRecordRequest {
  recordId: string;
  entityType: string;
  domain: string;
  record: Record<string, unknown>;
  dataContractId?: string;
  requiredFields?: string[];
  temporalPairs?: [string, string][];
  geoFields?: string[];
  unitFields?: string[];
  auditFields?: string[];
  codeFields?: Record<string, string>;
  confidenceLevelField?: string;
  confidenceEvidenceFields?: string[];
  dedupFields?: string[];
}

export type QualityOverallStatus = 'PASSED' | 'FAILED' | 'WARNING';

export interface QualityReportResponse {
  id: string;
  recordId: string;
  entityType: string;
  domain: string;
  tenantId: string;
  overallStatus: QualityOverallStatus;
  totalDurationMs: number;
  checkedAt: string;
  gateResults?: Array<{
    gate: string;
    status: string;
    durationMs: number;
  }>;
  violations?: Array<{
    gate: string;
    field: string;
    message: string;
    severity: string;
  }>;
}

export interface QualityApiResponse {
  data: QualityReportResponse;
}

// ── Client ──

const DEFAULT_DATA_QUALITY_URL = 'http://localhost:3004';

export class DataQualityClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['DATA_QUALITY_SERVICE_URL'] ?? config?.baseUrl ?? DEFAULT_DATA_QUALITY_URL,
      serviceName: 'data-quality',
      ...config,
    });
  }

  /**
   * Validate a record against quality gates.
   * POST /api/v1/data-quality/validate
   */
  async validate(
    request: ValidateRecordRequest,
    tenantId: string,
    authToken?: string,
  ): Promise<ServiceResponse<QualityApiResponse>> {
    return this.request<QualityApiResponse>({
      method: 'POST',
      path: '/api/v1/data-quality/validate',
      body: request,
      headers: this.buildHeaders(tenantId, authToken),
    });
  }
}
