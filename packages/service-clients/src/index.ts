// Base
export {
  BaseServiceClient,
  ServiceClientConfig,
  RequestOptions,
  ServiceResponse,
  ServiceClientError,
  CircuitBreakerOpenError,
} from './base-client';

// Domain Clients
export { DataQualityClient, ValidateRecordRequest, QualityReportResponse, QualityApiResponse, QualityOverallStatus } from './data-quality-client';
export { WorkflowClient, CreateWorkflowInstanceRequest, WorkflowInstanceResponse, WorkflowApiResponse } from './workflow-client';
export { AnimalHealthClient, PatchHealthEventRequest, HealthEventResponse, HealthEventApiResponse } from './animal-health-client';
export { MasterDataClient, DiseaseResponse, DiseaseApiResponse, SpeciesResponse, SpeciesApiResponse } from './master-data-client';

// NestJS Module
export { ServiceClientsModule, ServiceClientsModuleOptions } from './service-clients.module';
