import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuthStore, type UserRole } from '../stores/auth-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      tenantId: string;
    };
  };
}

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

interface DashboardKpis {
  data: {
    activeOutbreaks: number;
    vaccinationCoverage: number;
    pendingValidations: number;
    dataQualityScore: number;
    outbreaksTrend: number;
    vaccinationTrend: number;
    validationsTrend: number;
    qualityTrend: number;
  };
}

export interface HealthEvent {
  id: string;
  disease: string;
  diseaseCode: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  status: 'suspected' | 'confirmed' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cases: number;
  deaths: number;
  speciesAffected: string[];
  reportedAt: string;
  confirmedAt?: string;
  resolvedAt?: string;
  reportedBy: string;
  validationLevel: number;
  workflowStatus: string;
  dataQualityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface HealthEventDetail extends HealthEvent {
  description: string;
  measures: string[];
  labResults: LabResult[];
  timeline: TimelineEntry[];
  vaccinationResponse?: {
    campaignId: string;
    dosesAdministered: number;
    targetPopulation: number;
    coverage: number;
  };
}

export interface LabResult {
  id: string;
  sampleId: string;
  testType: string;
  result: 'positive' | 'negative' | 'inconclusive' | 'pending';
  pathogen: string;
  laboratory: string;
  collectedAt: string;
  resultAt?: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  detail: string;
  timestamp: string;
}

export interface CreateHealthEventRequest {
  disease: string;
  diseaseCode: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cases: number;
  deaths: number;
  speciesAffected: string[];
  description: string;
  measures: string[];
}

export interface VaccinationCampaign {
  id: string;
  name: string;
  disease: string;
  country: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed' | 'suspended';
  targetPopulation: number;
  dosesAdministered: number;
  coverage: number;
  species: string;
  createdAt: string;
}

export interface VaccinationCoveragePoint {
  month: string;
  coverage: number;
  target: number;
}

export interface WorkflowItem {
  id: string;
  entityType: 'health_event' | 'vaccination' | 'lab_result' | 'census';
  entityId: string;
  title: string;
  country: string;
  submittedBy: string;
  submittedAt: string;
  currentLevel: 1 | 2 | 3 | 4;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface WorkflowDetail extends WorkflowItem {
  description: string;
  entityData: Record<string, unknown>;
  history: WorkflowHistoryEntry[];
  qualityGates: QualityGateStatus[];
}

export interface WorkflowHistoryEntry {
  id: string;
  level: number;
  action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'escalated';
  actor: string;
  actorRole: string;
  comment: string;
  timestamp: string;
}

export interface QualityGateStatus {
  gate: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  message?: string;
}

interface TenantNode {
  id: string;
  name: string;
  code: string;
  level: 'CONTINENTAL' | 'REC' | 'MEMBER_STATE';
  children?: TenantNode[];
}

// ─── Auth Hooks ───────────────────────────────────────────────────────────────

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (data: LoginRequest) =>
      apiClient.post<LoginResponse>('/credential/login', data),
    onSuccess: (res) => {
      const { user, accessToken, refreshToken } = res.data;
      setAuth(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as UserRole,
          tenantId: user.tenantId,
        },
        accessToken,
        refreshToken,
      );
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: RegisterRequest) =>
      apiClient.post<{ data: { id: string } }>('/credential/register', data),
  });
}

// ─── Dashboard Hooks ──────────────────────────────────────────────────────────

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiClient.get<DashboardKpis>('/analytics/dashboard/kpis'),
    placeholderData: {
      data: {
        activeOutbreaks: 42,
        vaccinationCoverage: 87.3,
        pendingValidations: 156,
        dataQualityScore: 94.1,
        outbreaksTrend: 12,
        vaccinationTrend: 5.2,
        validationsTrend: -8,
        qualityTrend: 0,
      },
    },
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      apiClient.get<{ data: { count: number } }>('/messages/unread-count'),
    placeholderData: { data: { count: 3 } },
    refetchInterval: 60_000,
  });
}

export function useTenantTree() {
  return useQuery({
    queryKey: ['tenants', 'tree'],
    queryFn: () =>
      apiClient.get<{ data: TenantNode[] }>('/tenants'),
    staleTime: 5 * 60_000,
  });
}

// ─── Animal Health Hooks ──────────────────────────────────────────────────────

export function useHealthEvents(params?: {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  country?: string;
  search?: string;
  sort?: string;
  order?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.severity) searchParams.severity = params.severity;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;
  if (params?.sort) searchParams.sort = params.sort;
  if (params?.order) searchParams.order = params.order;

  return useQuery({
    queryKey: ['health-events', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HealthEvent>>(
        '/animal-health/events',
        searchParams,
      ),
  });
}

export function useHealthEvent(id: string) {
  return useQuery({
    queryKey: ['health-events', id],
    queryFn: () =>
      apiClient.get<{ data: HealthEventDetail }>(
        `/animal-health/events/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateHealthEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHealthEventRequest) =>
      apiClient.post<{ data: HealthEvent }>('/animal-health/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-events'] });
    },
  });
}

export function useOutbreakMarkers() {
  return useQuery({
    queryKey: ['health-events', 'markers'],
    queryFn: () =>
      apiClient.get<{
        data: Array<{
          id: string;
          lat: number;
          lng: number;
          disease: string;
          country: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          cases: number;
          status: string;
        }>;
      }>('/animal-health/events/markers'),
  });
}

// ─── Vaccination Hooks ────────────────────────────────────────────────────────

export function useVaccinationCampaigns(params?: {
  page?: number;
  limit?: number;
  status?: string;
  country?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.country) searchParams.country = params.country;

  return useQuery({
    queryKey: ['vaccination', 'campaigns', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<VaccinationCampaign>>(
        '/animal-health/vaccination/campaigns',
        searchParams,
      ),
  });
}

export function useVaccinationCoverage(params?: {
  country?: string;
  disease?: string;
  period?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.country) searchParams.country = params.country;
  if (params?.disease) searchParams.disease = params.disease;
  if (params?.period) searchParams.period = params.period;

  return useQuery({
    queryKey: ['vaccination', 'coverage', params],
    queryFn: () =>
      apiClient.get<{ data: VaccinationCoveragePoint[] }>(
        '/animal-health/vaccination/coverage',
        searchParams,
      ),
  });
}

// ─── Workflow Hooks ───────────────────────────────────────────────────────────

export function useWorkflowItems(params?: {
  page?: number;
  limit?: number;
  level?: number;
  status?: string;
  entityType?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.level) searchParams.level = String(params.level);
  if (params?.status) searchParams.status = params.status;
  if (params?.entityType) searchParams.entityType = params.entityType;

  return useQuery({
    queryKey: ['workflow', 'items', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WorkflowItem>>(
        '/workflow/validations',
        searchParams,
      ),
  });
}

export function useWorkflowDetail(id: string) {
  return useQuery({
    queryKey: ['workflow', 'items', id],
    queryFn: () =>
      apiClient.get<{ data: WorkflowDetail }>(`/workflow/validations/${id}`),
    enabled: !!id,
  });
}

export function useWorkflowAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: string;
      action: 'approve' | 'reject' | 'return';
      comment: string;
    }) =>
      apiClient.post<{ data: WorkflowItem }>(
        `/workflow/validations/${data.id}/${data.action}`,
        { comment: data.comment },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}
