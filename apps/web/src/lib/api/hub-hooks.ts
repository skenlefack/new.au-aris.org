// React Query hooks for the ARIS Interoperability Hub (services/interop-hub, port 3032).
//
// Covers connections, pipelines, mappings, transactions, agreements, schedules,
// dashboard analytics, audit logs, and notifications.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ═══════════════════════════════════════════════════════
// ENUMS (string unions)
// ═══════════════════════════════════════════════════════

export type HubDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
export type HubTransportType = 'REST' | 'SOAP' | 'SFTP' | 'KAFKA' | 'EMAIL' | 'FILE' | 'CUSTOM';
export type HubAuthType = 'NONE' | 'BASIC' | 'BEARER' | 'API_KEY' | 'OAUTH2' | 'CERTIFICATE';
export type HubConnectionStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ERROR';
export type HubPipelineStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED';
export type HubStepType = 'EXTRACT' | 'TRANSFORM' | 'VALIDATE' | 'MAP' | 'LOAD' | 'NOTIFY' | 'CUSTOM';
export type HubTransactionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'AWAITING_APPROVAL';
export type HubRecordStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'SKIPPED' | 'DUPLICATE';
export type HubMappingStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type HubScheduleFrequency = 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CRON';
export type HubScheduleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR';
export type HubAgreementStatus = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
export type HubNotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type HubAuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'SUSPEND' | 'EXECUTE' | 'APPROVE' | 'REJECT' | 'RETRY' | 'CANCEL';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface HubConnection {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  externalSystem: string;
  direction: HubDirection;
  transportType: HubTransportType;
  authType: HubAuthType;
  baseUrl?: string;
  config: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  status: HubConnectionStatus;
  lastTestedAt?: string;
  lastTestResult?: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubPipelineStep {
  id: string;
  pipelineId: string;
  name: string;
  description?: string;
  stepType: HubStepType;
  stepOrder: number;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubPipeline {
  id: string;
  tenantId: string;
  connectionId: string;
  name: string;
  description?: string;
  direction: HubDirection;
  domain: string;
  entity: string;
  dataFormat: string;
  status: HubPipelineStatus;
  config: Record<string, unknown>;
  steps?: HubPipelineStep[];
  connection?: HubConnection;
  lastExecutedAt?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubTransactionRecord {
  id: string;
  transactionId: string;
  externalId?: string;
  internalId?: string;
  entityType: string;
  status: HubRecordStatus;
  sourceData?: Record<string, unknown>;
  mappedData?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
}

export interface HubTransactionStepLog {
  id: string;
  transactionId: string;
  stepId: string;
  stepName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  durationMs: number;
  startedAt: string;
  completedAt?: string;
}

export interface HubTransaction {
  id: string;
  tenantId: string;
  pipelineId: string;
  connectionId: string;
  direction: HubDirection;
  domain: string;
  entity: string;
  status: HubTransactionStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  pipeline?: HubPipeline;
  connection?: HubConnection;
  records?: HubTransactionRecord[];
  stepLogs?: HubTransactionStepLog[];
  startedAt?: string;
  completedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubReferentialMapping {
  id: string;
  connectionId: string;
  referentialType: string;
  externalCode: string;
  externalLabel?: string;
  internalCode: string;
  internalId?: string;
  internalLabel?: string;
  status: HubMappingStatus;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubFieldMapping {
  id: string;
  connectionId: string;
  pipelineId?: string;
  sourceField: string;
  targetField: string;
  transformExpression?: string;
  defaultValue?: string;
  isRequired: boolean;
  status: HubMappingStatus;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubSchedule {
  id: string;
  tenantId: string;
  pipelineId: string;
  name: string;
  description?: string;
  frequency: HubScheduleFrequency;
  cronExpression?: string;
  config: Record<string, unknown>;
  status: HubScheduleStatus;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  pipeline?: HubPipeline;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubAgreement {
  id: string;
  tenantId: string;
  partnerTenantId: string;
  name: string;
  description?: string;
  direction: HubDirection;
  domains: string[];
  entities: string[];
  dataClassification: string;
  status: HubAgreementStatus;
  terms?: Record<string, unknown>;
  validFrom?: string;
  validTo?: string;
  proposedBy: string;
  proposedAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubNotification {
  id: string;
  tenantId: string;
  userId?: string;
  title: string;
  message: string;
  severity: HubNotificationSeverity;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface HubAuditLog {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: HubAuditAction;
  actorId: string;
  actorRole: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// ── Dashboard types ──

export interface HubDashboardOverview {
  totalConnections: number;
  activeConnections: number;
  totalPipelines: number;
  activePipelines: number;
  totalTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalRecordsProcessed: number;
  activeAgreements: number;
  activeSchedules: number;
}

export interface HubDashboardVolume {
  period: string;
  inbound: number;
  outbound: number;
  total: number;
  failed: number;
}

export interface HubDashboardConnectionStats {
  connectionId: string;
  connectionName: string;
  externalSystem: string;
  status: HubConnectionStatus;
  transactionCount: number;
  successRate: number;
  lastActivity?: string;
  avgDurationMs: number;
}

export interface HubDashboardDomainStats {
  domain: string;
  entity: string;
  inbound: number;
  outbound: number;
  total: number;
  failedRate: number;
}

export interface HubDashboardHealth {
  connectionId: string;
  connectionName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheck?: string;
  responseTimeMs?: number;
  errorRate: number;
}

export interface HubDashboardRecentActivity {
  id: string;
  type: 'TRANSACTION' | 'CONNECTION' | 'PIPELINE' | 'AGREEMENT';
  action: string;
  entityName: string;
  status: string;
  actorId?: string;
  createdAt: string;
}

export interface HubDashboardError {
  transactionId: string;
  pipelineName: string;
  connectionName: string;
  errorMessage: string;
  recordsAffected: number;
  occurredAt: string;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

const BASE = '/interop-hub';

function buildParams(filters?: Record<string, unknown>): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ═══════════════════════════════════════════════════════
// CONNECTIONS
// ═══════════════════════════════════════════════════════

export interface HubConnectionFilters {
  page?: number;
  limit?: number;
  status?: HubConnectionStatus;
  direction?: HubDirection;
  transportType?: HubTransportType;
  externalSystem?: string;
  search?: string;
}

export function useHubConnections(filters?: HubConnectionFilters) {
  return useQuery({
    queryKey: ['hub-connections', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubConnection>>(
        `${BASE}/connections${buildParams(filters)}`,
      ),
  });
}

export function useHubConnection(id: string | undefined) {
  return useQuery({
    queryKey: ['hub-connections', id],
    queryFn: () =>
      apiClient.get<{ data: HubConnection }>(`${BASE}/connections/${id}`),
    enabled: !!id,
  });
}

export function useCreateHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HubConnection>) =>
      apiClient.post<{ data: HubConnection }>(`${BASE}/connections`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-connections'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useUpdateHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HubConnection>) =>
      apiClient.patch<{ data: HubConnection }>(`${BASE}/connections/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-connections'] });
      qc.invalidateQueries({ queryKey: ['hub-connections', vars.id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useDeleteHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<void>(`${BASE}/connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-connections'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useActivateHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubConnection }>(`${BASE}/connections/${id}/activate`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-connections'] });
      qc.invalidateQueries({ queryKey: ['hub-connections', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useSuspendHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubConnection }>(`${BASE}/connections/${id}/suspend`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-connections'] });
      qc.invalidateQueries({ queryKey: ['hub-connections', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useTestHubConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: { success: boolean; responseTimeMs: number; details?: Record<string, unknown> } }>(
        `${BASE}/connections/${id}/test`,
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-connections', id] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// PIPELINES
// ═══════════════════════════════════════════════════════

export interface HubPipelineFilters {
  page?: number;
  limit?: number;
  status?: HubPipelineStatus;
  direction?: HubDirection;
  connectionId?: string;
  domain?: string;
  entity?: string;
  search?: string;
}

export function useHubPipelines(filters?: HubPipelineFilters) {
  return useQuery({
    queryKey: ['hub-pipelines', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubPipeline>>(
        `${BASE}/pipelines${buildParams(filters)}`,
      ),
  });
}

export function useHubPipeline(id: string | undefined) {
  return useQuery({
    queryKey: ['hub-pipelines', id],
    queryFn: () =>
      apiClient.get<{ data: HubPipeline }>(`${BASE}/pipelines/${id}`),
    enabled: !!id,
  });
}

export function useCreateHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HubPipeline>) =>
      apiClient.post<{ data: HubPipeline }>(`${BASE}/pipelines`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useUpdateHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HubPipeline>) =>
      apiClient.patch<{ data: HubPipeline }>(`${BASE}/pipelines/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines'] });
      qc.invalidateQueries({ queryKey: ['hub-pipelines', vars.id] });
    },
  });
}

export function useDeleteHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<void>(`${BASE}/pipelines/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useActivateHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubPipeline }>(`${BASE}/pipelines/${id}/activate`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines'] });
      qc.invalidateQueries({ queryKey: ['hub-pipelines', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function usePauseHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubPipeline }>(`${BASE}/pipelines/${id}/pause`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines'] });
      qc.invalidateQueries({ queryKey: ['hub-pipelines', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useExecuteHubPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: Record<string, unknown> }) =>
      apiClient.post<{ data: HubTransaction }>(`${BASE}/pipelines/${id}/execute`, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-transactions'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useUpdateHubPipelineSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipelineId, steps }: { pipelineId: string; steps: Partial<HubPipelineStep>[] }) =>
      apiClient.put<{ data: HubPipelineStep[] }>(
        `${BASE}/pipelines/${pipelineId}/steps`,
        { steps },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-pipelines', vars.pipelineId] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// REFERENTIAL MAPPINGS
// ═══════════════════════════════════════════════════════

export interface HubRefMappingFilters {
  page?: number;
  limit?: number;
  referentialType?: string;
  status?: HubMappingStatus;
  search?: string;
}

export function useHubReferentialMappings(
  connectionId: string | undefined,
  filters?: HubRefMappingFilters,
) {
  return useQuery({
    queryKey: ['hub-ref-mappings', connectionId, filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubReferentialMapping>>(
        `${BASE}/connections/${connectionId}/referential-mappings${buildParams(filters)}`,
      ),
    enabled: !!connectionId,
  });
}

export function useCreateHubReferentialMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      ...data
    }: { connectionId: string } & Partial<HubReferentialMapping>) =>
      apiClient.post<{ data: HubReferentialMapping }>(
        `${BASE}/connections/${connectionId}/referential-mappings`,
        data,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-ref-mappings', vars.connectionId] });
    },
  });
}

export function useUpdateHubReferentialMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      id,
      ...data
    }: { connectionId: string; id: string } & Partial<HubReferentialMapping>) =>
      apiClient.patch<{ data: HubReferentialMapping }>(
        `${BASE}/connections/${connectionId}/referential-mappings/${id}`,
        data,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-ref-mappings', vars.connectionId] });
    },
  });
}

export function useDeleteHubReferentialMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, id }: { connectionId: string; id: string }) =>
      apiClient.delete<void>(
        `${BASE}/connections/${connectionId}/referential-mappings/${id}`,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-ref-mappings', vars.connectionId] });
    },
  });
}

export function useBulkCreateHubReferentialMappings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      mappings,
    }: {
      connectionId: string;
      mappings: Partial<HubReferentialMapping>[];
    }) =>
      apiClient.post<{ data: HubReferentialMapping[]; meta: { created: number; skipped: number } }>(
        `${BASE}/connections/${connectionId}/referential-mappings/bulk`,
        { mappings },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-ref-mappings', vars.connectionId] });
    },
  });
}

export function useImportHubReferentialMappings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      file,
      referentialType,
    }: {
      connectionId: string;
      file: File;
      referentialType: string;
    }) => {
      // File upload requires FormData; bypass apiClient and use fetch directly.
      const formData = new FormData();
      formData.append('file', file);
      formData.append('referentialType', referentialType);
      return apiClient.post<{ data: { imported: number; skipped: number; errors: number } }>(
        `${BASE}/connections/${connectionId}/referential-mappings/import`,
        formData,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-ref-mappings', vars.connectionId] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// FIELD MAPPINGS
// ═══════════════════════════════════════════════════════

export interface HubFieldMappingFilters {
  page?: number;
  limit?: number;
  pipelineId?: string;
  status?: HubMappingStatus;
  search?: string;
}

export function useHubFieldMappings(
  connectionId: string | undefined,
  filters?: HubFieldMappingFilters,
) {
  return useQuery({
    queryKey: ['hub-field-mappings', connectionId, filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubFieldMapping>>(
        `${BASE}/connections/${connectionId}/field-mappings${buildParams(filters)}`,
      ),
    enabled: !!connectionId,
  });
}

export function useCreateHubFieldMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      ...data
    }: { connectionId: string } & Partial<HubFieldMapping>) =>
      apiClient.post<{ data: HubFieldMapping }>(
        `${BASE}/connections/${connectionId}/field-mappings`,
        data,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-field-mappings', vars.connectionId] });
    },
  });
}

export function useUpdateHubFieldMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      id,
      ...data
    }: { connectionId: string; id: string } & Partial<HubFieldMapping>) =>
      apiClient.patch<{ data: HubFieldMapping }>(
        `${BASE}/connections/${connectionId}/field-mappings/${id}`,
        data,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-field-mappings', vars.connectionId] });
    },
  });
}

export function useDeleteHubFieldMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, id }: { connectionId: string; id: string }) =>
      apiClient.delete<void>(
        `${BASE}/connections/${connectionId}/field-mappings/${id}`,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-field-mappings', vars.connectionId] });
    },
  });
}

export function useBulkCreateHubFieldMappings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      mappings,
    }: {
      connectionId: string;
      mappings: Partial<HubFieldMapping>[];
    }) =>
      apiClient.post<{ data: HubFieldMapping[]; meta: { created: number; skipped: number } }>(
        `${BASE}/connections/${connectionId}/field-mappings/bulk`,
        { mappings },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-field-mappings', vars.connectionId] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════

export interface HubTransactionFilters {
  page?: number;
  limit?: number;
  status?: HubTransactionStatus;
  direction?: HubDirection;
  connectionId?: string;
  pipelineId?: string;
  domain?: string;
  entity?: string;
  from?: string;
  to?: string;
  search?: string;
}

export function useHubTransactions(filters?: HubTransactionFilters) {
  return useQuery({
    queryKey: ['hub-transactions', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubTransaction>>(
        `${BASE}/transactions${buildParams(filters)}`,
      ),
  });
}

export function useHubTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['hub-transactions', id],
    queryFn: () =>
      apiClient.get<{ data: HubTransaction }>(`${BASE}/transactions/${id}`),
    enabled: !!id,
  });
}

export function useApproveHubTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      apiClient.post<{ data: HubTransaction }>(
        `${BASE}/transactions/${id}/approve`,
        { comment },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-transactions'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useRejectHubTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<{ data: HubTransaction }>(
        `${BASE}/transactions/${id}/reject`,
        { reason },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-transactions'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useRetryHubTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubTransaction }>(`${BASE}/transactions/${id}/retry`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-transactions'] });
      qc.invalidateQueries({ queryKey: ['hub-transactions', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useCancelHubTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubTransaction }>(`${BASE}/transactions/${id}/cancel`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-transactions'] });
      qc.invalidateQueries({ queryKey: ['hub-transactions', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useHubInbox(filters?: { page?: number; limit?: number; status?: HubTransactionStatus }) {
  return useQuery({
    queryKey: ['hub-transactions', 'inbox', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubTransaction>>(
        `${BASE}/inbox${buildParams(filters)}`,
      ),
    refetchInterval: 30_000,
  });
}

export function useHubOutbox(filters?: { page?: number; limit?: number; status?: HubTransactionStatus }) {
  return useQuery({
    queryKey: ['hub-transactions', 'outbox', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubTransaction>>(
        `${BASE}/outbox${buildParams(filters)}`,
      ),
    refetchInterval: 30_000,
  });
}

// ═══════════════════════════════════════════════════════
// AGREEMENTS
// ═══════════════════════════════════════════════════════

export interface HubAgreementFilters {
  page?: number;
  limit?: number;
  status?: HubAgreementStatus;
  partnerTenantId?: string;
  direction?: HubDirection;
  domain?: string;
  search?: string;
}

export function useHubAgreements(filters?: HubAgreementFilters) {
  return useQuery({
    queryKey: ['hub-agreements', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubAgreement>>(
        `${BASE}/agreements${buildParams(filters)}`,
      ),
  });
}

export function useHubAgreement(id: string | undefined) {
  return useQuery({
    queryKey: ['hub-agreements', id],
    queryFn: () =>
      apiClient.get<{ data: HubAgreement }>(`${BASE}/agreements/${id}`),
    enabled: !!id,
  });
}

export function useCreateHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HubAgreement>) =>
      apiClient.post<{ data: HubAgreement }>(`${BASE}/agreements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useUpdateHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HubAgreement>) =>
      apiClient.patch<{ data: HubAgreement }>(`${BASE}/agreements/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-agreements', vars.id] });
    },
  });
}

export function useProposeHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubAgreement }>(`${BASE}/agreements/${id}/propose`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-agreements', id] });
    },
  });
}

export function useAcceptHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubAgreement }>(`${BASE}/agreements/${id}/accept`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-agreements', id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useRejectHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post<{ data: HubAgreement }>(
        `${BASE}/agreements/${id}/reject`,
        { reason },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-agreements', vars.id] });
    },
  });
}

export function useRevokeHubAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<{ data: HubAgreement }>(
        `${BASE}/agreements/${id}/revoke`,
        { reason },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hub-agreements'] });
      qc.invalidateQueries({ queryKey: ['hub-agreements', vars.id] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// SCHEDULES
// ═══════════════════════════════════════════════════════

export interface HubScheduleFilters {
  page?: number;
  limit?: number;
  status?: HubScheduleStatus;
  pipelineId?: string;
  frequency?: HubScheduleFrequency;
  search?: string;
}

export function useHubSchedules(filters?: HubScheduleFilters) {
  return useQuery({
    queryKey: ['hub-schedules', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubSchedule>>(
        `${BASE}/schedules${buildParams(filters)}`,
      ),
  });
}

export function useCreateHubSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HubSchedule>) =>
      apiClient.post<{ data: HubSchedule }>(`${BASE}/schedules`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-schedules'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useUpdateHubSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HubSchedule>) =>
      apiClient.patch<{ data: HubSchedule }>(`${BASE}/schedules/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-schedules'] });
    },
  });
}

export function useDeleteHubSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<void>(`${BASE}/schedules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-schedules'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function useActivateHubSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubSchedule }>(`${BASE}/schedules/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-schedules'] });
      qc.invalidateQueries({ queryKey: ['hub-dashboard'] });
    },
  });
}

export function usePauseHubSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: HubSchedule }>(`${BASE}/schedules/${id}/pause`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-schedules'] });
    },
  });
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

export function useHubDashboardOverview() {
  return useQuery({
    queryKey: ['hub-dashboard', 'overview'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardOverview }>(`${BASE}/dashboard/overview`),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useHubDashboardVolume(period?: 'day' | 'week' | 'month' | 'quarter' | 'year') {
  return useQuery({
    queryKey: ['hub-dashboard', 'volume', period],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardVolume[] }>(
        `${BASE}/dashboard/volume${period ? `?period=${period}` : ''}`,
      ),
    staleTime: 120_000,
  });
}

export function useHubDashboardStatus() {
  return useQuery({
    queryKey: ['hub-dashboard', 'status'],
    queryFn: () =>
      apiClient.get<{
        data: { status: HubTransactionStatus; count: number }[];
      }>(`${BASE}/dashboard/status`),
    staleTime: 60_000,
  });
}

export function useHubDashboardConnectionStats() {
  return useQuery({
    queryKey: ['hub-dashboard', 'connection-stats'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardConnectionStats[] }>(
        `${BASE}/dashboard/connection-stats`,
      ),
    staleTime: 120_000,
  });
}

export function useHubDashboardDomainStats() {
  return useQuery({
    queryKey: ['hub-dashboard', 'domain-stats'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardDomainStats[] }>(
        `${BASE}/dashboard/domain-stats`,
      ),
    staleTime: 120_000,
  });
}

export function useHubDashboardHealth() {
  return useQuery({
    queryKey: ['hub-dashboard', 'health'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardHealth[] }>(`${BASE}/dashboard/health`),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useHubDashboardRecent() {
  return useQuery({
    queryKey: ['hub-dashboard', 'recent'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardRecentActivity[] }>(
        `${BASE}/dashboard/recent`,
      ),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useHubDashboardErrors() {
  return useQuery({
    queryKey: ['hub-dashboard', 'errors'],
    queryFn: () =>
      apiClient.get<{ data: HubDashboardError[] }>(`${BASE}/dashboard/errors`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ═══════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════

export interface HubAuditFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: HubAuditAction;
  actorId?: string;
  from?: string;
  to?: string;
}

export function useHubAuditLogs(filters?: HubAuditFilters) {
  return useQuery({
    queryKey: ['hub-audit', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubAuditLog>>(
        `${BASE}/audit${buildParams(filters)}`,
      ),
  });
}

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════

export interface HubNotificationFilters {
  page?: number;
  limit?: number;
  severity?: HubNotificationSeverity;
  isRead?: boolean;
  entityType?: string;
}

export function useHubNotifications(filters?: HubNotificationFilters) {
  return useQuery({
    queryKey: ['hub-notifications', filters],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HubNotification>>(
        `${BASE}/notifications${buildParams(filters)}`,
      ),
    refetchInterval: 30_000,
  });
}

export function useHubUnreadCount() {
  return useQuery({
    queryKey: ['hub-notifications', 'unread-count'],
    queryFn: () =>
      apiClient.get<{ data: { count: number } }>(
        `${BASE}/notifications/unread-count`,
      ),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useMarkHubNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<{ data: HubNotification }>(
        `${BASE}/notifications/${id}/read`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-notifications'] });
    },
  });
}
