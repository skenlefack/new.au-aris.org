import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  collecteClient,
  animalHealthClient,
  livestockClient,
  fisheriesClient,
  wildlifeClient,
  apicultureClient,
  tradeSpsClient,
  governanceClient,
  climateEnvClient,
  analyticsClient,
  knowledgeHubClient,
  ApiClientError,
} from './client';
import { useAuthStore, type UserRole } from '../stores/auth-store';
import { useTenantStore } from '../stores/tenant-store';

/**
 * Returns the currently selected tenantId.
 * Include this in query keys so cache invalidates on tenant switch.
 */
export function useTenantId(): string | null {
  return useTenantStore((s) => s.selectedTenantId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps a queryFn so that 404 errors (service not running) silently return
 * fallback data instead of throwing, which prevents console error spam
 * when optional microservices are offline.
 */
function withFallback<T>(queryFn: () => Promise<T>, fallback: T): () => Promise<T> {
  return async () => {
    try {
      return await queryFn();
    } catch (err) {
      // Service offline or unavailable — silently return fallback data.
      // 500 = Next.js proxy can't reach upstream; 502/503 = gateway errors; 404 = route not found
      if (err instanceof ApiClientError && [404, 500, 502, 503].includes(err.statusCode)) {
        return fallback;
      }
      // Network errors (service not running at all → fetch throws TypeError)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        return fallback;
      }
      throw err;
    }
  };
}

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
      tenantLevel?: string;
      locale?: string;
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
    labTurnaround: number;
    tradeVolume: number;
    livestockPopulation: number;
    activeCampaigns: number;
    outbreaksTrend: number;
    vaccinationTrend: number;
    validationsTrend: number;
    qualityTrend: number;
    labTurnaroundTrend: number;
    tradeVolumeTrend: number;
    livestockTrend: number;
    campaignsTrend: number;
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
      apiClient.post<LoginResponse>('/credential/auth/login', data),
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
          tenantLevel: user.tenantLevel,
          locale: user.locale,
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
      apiClient.post<{ data: { id: string } }>('/credential/auth/register', data),
  });
}

export function useUpdateLocale() {
  return useMutation({
    mutationFn: async (locale: string) =>
      apiClient.put<{ data: { locale: string } }>('/credential/users/me/locale', { locale }),
  });
}

// ─── Dashboard Hooks ──────────────────────────────────────────────────────────

const DASHBOARD_KPIS_FALLBACK: DashboardKpis = {
  data: {
    activeOutbreaks: 42,
    vaccinationCoverage: 87.3,
    pendingValidations: 156,
    dataQualityScore: 94.1,
    labTurnaround: 3.2,
    tradeVolume: 2_340_000,
    livestockPopulation: 385_000_000,
    activeCampaigns: 18,
    outbreaksTrend: 12,
    vaccinationTrend: 5.2,
    validationsTrend: -8,
    qualityTrend: 0,
    labTurnaroundTrend: -12,
    tradeVolumeTrend: 8.4,
    livestockTrend: 2.1,
    campaignsTrend: 15,
  },
};

export function useDashboardKpis() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['dashboard', 'kpis', tenantId],
    queryFn: withFallback(
      () => analyticsClient.get<DashboardKpis>('/analytics/dashboard/kpis'),
      DASHBOARD_KPIS_FALLBACK,
    ),
    placeholderData: DASHBOARD_KPIS_FALLBACK,
  });
}

export function useUnreadNotifications() {
  const tenantId = useTenantId();
  const fallback = { data: { count: 0 } };
  return useQuery({
    queryKey: ['notifications', 'unread-count', tenantId],
    queryFn: withFallback(
      () => apiClient.get<{ data: { count: number } }>('/messages/unread-count'),
      fallback,
    ),
    placeholderData: fallback,
    refetchInterval: 5 * 60_000,
  });
}

export function useTenantTree() {
  const fallback: { data: TenantNode[] } = { data: [] };
  return useQuery({
    queryKey: ['tenants', 'tree'],
    queryFn: withFallback(
      () => apiClient.get<{ data: TenantNode[] }>('/tenants'),
      fallback,
    ),
    placeholderData: fallback,
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
  const tenantId = useTenantId();
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.severity) searchParams.severity = params.severity;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;
  if (params?.sort) searchParams.sort = params.sort;
  if (params?.order) searchParams.order = params.order;

  const fallback: PaginatedResponse<HealthEvent> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['health-events', tenantId, params],
    queryFn: withFallback(
      () =>
        animalHealthClient.get<PaginatedResponse<HealthEvent>>(
          '/animal-health/events',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useHealthEvent(id: string) {
  return useQuery({
    queryKey: ['health-events', id],
    queryFn: () =>
      animalHealthClient.get<{ data: HealthEventDetail }>(
        `/animal-health/events/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateHealthEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHealthEventRequest) =>
      animalHealthClient.post<{ data: HealthEvent }>('/animal-health/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-events'] });
    },
  });
}

export function useOutbreakMarkers() {
  const tenantId = useTenantId();
  const fallback = { data: [] as Array<{
    id: string;
    lat: number;
    lng: number;
    disease: string;
    country: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    cases: number;
    status: string;
  }> };
  return useQuery({
    queryKey: ['health-events', 'markers', tenantId],
    queryFn: withFallback(
      () => animalHealthClient.get<typeof fallback>('/animal-health/events/markers'),
      fallback,
    ),
    placeholderData: fallback,
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

  const fallback: PaginatedResponse<VaccinationCampaign> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['vaccination', 'campaigns', params],
    queryFn: withFallback(
      () =>
        animalHealthClient.get<PaginatedResponse<VaccinationCampaign>>(
          '/animal-health/vaccinations',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
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

  const fallback: { data: VaccinationCoveragePoint[] } = { data: [] };
  return useQuery({
    queryKey: ['vaccination', 'coverage', params],
    queryFn: withFallback(
      () =>
        animalHealthClient.get<{ data: VaccinationCoveragePoint[] }>(
          '/animal-health/vaccinations',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
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

  const fallback: PaginatedResponse<WorkflowItem> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['workflow', 'items', params],
    queryFn: withFallback(
      () =>
        apiClient.get<PaginatedResponse<WorkflowItem>>(
          '/workflow/validations',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
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

// ─── Collecte Types ──────────────────────────────────────────────────────────

export interface CollecteCampaign {
  id: string;
  name: string;
  description: string;
  domain: string;
  templateId: string;
  templateIds?: string[];
  templateName?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  targetZones: string[];
  targetCountries?: string[];
  assignedAgents: string[] | number;
  targetSubmissions: number | null;
  totalSubmissions?: number;
  validatedSubmissions?: number;
  rejectedSubmissions?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollecteCampaignDetail extends CollecteCampaign {
  submissions: CollecteSubmission[];
  agents: CollecteAgent[];
}

export interface CollecteSubmission {
  id: string;
  campaignId: string;
  campaignName: string;
  formData: Record<string, unknown>;
  status: 'draft' | 'submitted' | 'validated' | 'rejected' | 'corrected';
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  zone: string;
  qualityScore: number;
  qualityResult: 'pass' | 'fail' | 'warning' | 'pending';
  workflowLevel: number;
  workflowStatus: string;
  createdAt: string;
}

export interface CollecteSubmissionDetail extends CollecteSubmission {
  qualityGates: QualityGateStatus[];
  corrections: CorrectionEntry[];
  timeline: TimelineEntry[];
}

export interface CollecteAgent {
  id: string;
  name: string;
  email: string;
  zone: string;
  submissions: number;
  lastActive: string;
}

export interface CorrectionEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}

export interface CreateCampaignRequest {
  name: string;
  domain: string;
  templateId: string;
  startDate: string;           // ISO date-time, e.g. '2026-04-01T00:00:00Z'
  endDate: string;             // ISO date-time
  targetZones: string[];       // UUID array (admin-division IDs)
  assignedAgents: string[];    // UUID array
  description?: string;
  targetSubmissions?: number;
  conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
  dataContractId?: string;
  // ── Extended fields (ignored by backend if unsupported, kept for future) ──
  templateIds?: string[];
  targetCountries?: string[];
  frequency?: string;
  sendReminders?: boolean;
  reminderDaysBefore?: number;
}

// ─── Collecte Hooks ──────────────────────────────────────────────────────────

export function useCampaigns(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  domain?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.search) searchParams.search = params.search;
  if (params?.domain) searchParams.domain = params.domain;

  return useQuery({
    queryKey: ['collecte', 'campaigns', params],
    queryFn: () =>
      collecteClient.get<PaginatedResponse<CollecteCampaign>>(
        '/collecte/campaigns',
        searchParams,
      ),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['collecte', 'campaigns', id],
    queryFn: () =>
      collecteClient.get<{ data: CollecteCampaignDetail }>(
        `/collecte/campaigns/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) =>
      collecteClient.post<{ data: CollecteCampaign }>('/collecte/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collecte', 'campaigns'] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      name: string;
      description: string;
      status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      startDate: string;
      endDate: string;
      targetSubmissions: number;
      templateIds: string[];
      targetCountries: string[];
      targetZones: string[];
      assignedAgents: string[];
    }>) =>
      collecteClient.patch<{ data: CollecteCampaign }>(`/collecte/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collecte', 'campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      collecteClient.delete<{ data: { id: string } }>(`/collecte/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collecte', 'campaigns'] });
    },
  });
}

export function useSubmitCampaignForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { campaignId: string; data: Record<string, unknown> }) =>
      collecteClient.post<{ data: unknown }>('/collecte/submissions', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collecte'] });
    },
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ['collecte', 'submissions', id],
    queryFn: () =>
      collecteClient.get<{ data: CollecteSubmissionDetail }>(
        `/collecte/submissions/${id}`,
      ),
    enabled: !!id,
  });
}

// ─── Quality Types ───────────────────────────────────────────────────────────

export interface QualityDashboardData {
  overallPassRate: number;
  passRateTrend: number;
  totalReports: number;
  pendingCorrections: number;
  avgCorrectionTime: number;
  correctionTimeTrend: number;
  byDomain: QualityDomainStat[];
  byGate: QualityGateStat[];
  recentFailures: QualityReport[];
}

export interface QualityDomainStat {
  domain: string;
  passRate: number;
  totalRecords: number;
  failedRecords: number;
}

export interface QualityGateStat {
  gate: string;
  passRate: number;
  failCount: number;
  warningCount: number;
}

export interface QualityReport {
  id: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  domain: string;
  country: string;
  overallResult: 'pass' | 'fail' | 'warning';
  gateResults: QualityGateStatus[];
  violations: QualityViolation[];
  submittedBy: string;
  reviewedBy?: string;
  status: 'pending' | 'corrected' | 'overridden' | 'accepted';
  createdAt: string;
  updatedAt: string;
}

export interface QualityViolation {
  id: string;
  gate: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface QualityRule {
  id: string;
  name: string;
  description: string;
  gate: string;
  domain: string;
  expression: string;
  severity: 'error' | 'warning';
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQualityRuleRequest {
  name: string;
  description: string;
  gate: string;
  domain: string;
  expression: string;
  severity: 'error' | 'warning';
}

// ─── Quality Hooks ───────────────────────────────────────────────────────────

export function useQualityDashboard() {
  return useQuery({
    queryKey: ['quality', 'dashboard'],
    queryFn: () =>
      apiClient.get<{ data: QualityDashboardData }>('/data-quality/dashboard'),
  });
}

export function useQualityReports(params?: {
  page?: number;
  limit?: number;
  status?: string;
  domain?: string;
  result?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.result) searchParams.result = params.result;
  if (params?.search) searchParams.search = params.search;

  return useQuery({
    queryKey: ['quality', 'reports', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<QualityReport>>(
        '/data-quality/reports',
        searchParams,
      ),
  });
}

export function useQualityReport(id: string) {
  return useQuery({
    queryKey: ['quality', 'reports', id],
    queryFn: () =>
      apiClient.get<{ data: QualityReport }>(`/data-quality/reports/${id}`),
    enabled: !!id,
  });
}

export function useQualityRules(params?: {
  page?: number;
  limit?: number;
  gate?: string;
  domain?: string;
  active?: boolean;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.gate) searchParams.gate = params.gate;
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.active !== undefined) searchParams.active = String(params.active);

  return useQuery({
    queryKey: ['quality', 'rules', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<QualityRule>>(
        '/data-quality/rules',
        searchParams,
      ),
  });
}

export function useCreateQualityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQualityRuleRequest) =>
      apiClient.post<{ data: QualityRule }>('/data-quality/rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });
}

export function useUpdateQualityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string } & Partial<CreateQualityRuleRequest> & { active?: boolean }) =>
      apiClient.patch<{ data: QualityRule }>(
        `/data-quality/rules/${data.id}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });
}

export function useDeleteQualityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ data: { message: string } }>(
        `/data-quality/rules/${id}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });
}

// ─── Master Data Types ───────────────────────────────────────────────────────

export interface MasterDataCountry {
  id: string;
  name: string;
  code: string;
  iso3: string;
  region: string;
  subRegion: string;
  population?: number;
  area?: number;
  updatedAt: string;
}

export interface MasterDataSpecies {
  id: string;
  name: string;
  scientificName: string;
  category: string;
  woahCode: string;
  faoCode?: string;
  updatedAt: string;
}

export interface MasterDataDisease {
  id: string;
  name: string;
  woahCode: string;
  category: string;
  notifiable: boolean;
  zoonotic: boolean;
  speciesAffected: string[];
  updatedAt: string;
}

export interface MasterDataDenominator {
  id: string;
  country: string;
  countryCode: string;
  species: string;
  year: number;
  faostatValue: number;
  nationalCensusValue?: number;
  variance?: number;
  source: 'FAOSTAT' | 'NATIONAL_CENSUS' | 'ESTIMATE';
  notes?: string;
  updatedAt: string;
}

export interface MasterDataUnit {
  id: string;
  name: string;
  symbol: string;
  category: string;
  siEquivalent?: string;
  updatedAt: string;
}

// ─── Master Data Hooks ───────────────────────────────────────────────────────

export function useCountries(params?: {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.search) searchParams.search = params.search;
  if (params?.region) searchParams.region = params.region;

  return useQuery({
    queryKey: ['master-data', 'countries', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MasterDataCountry>>(
        '/master-data/countries',
        searchParams,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useSpecies(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.search) searchParams.search = params.search;
  if (params?.category) searchParams.category = params.category;

  return useQuery({
    queryKey: ['master-data', 'species', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MasterDataSpecies>>(
        '/master-data/species',
        searchParams,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useDiseases(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  notifiable?: boolean;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.search) searchParams.search = params.search;
  if (params?.category) searchParams.category = params.category;
  if (params?.notifiable !== undefined)
    searchParams.notifiable = String(params.notifiable);

  return useQuery({
    queryKey: ['master-data', 'diseases', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MasterDataDisease>>(
        '/master-data/diseases',
        searchParams,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useDenominators(params?: {
  page?: number;
  limit?: number;
  country?: string;
  species?: string;
  year?: number;
  source?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.species) searchParams.species = params.species;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.source) searchParams.source = params.source;

  return useQuery({
    queryKey: ['master-data', 'denominators', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MasterDataDenominator>>(
        '/master-data/denominators',
        searchParams,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useUnits(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.search) searchParams.search = params.search;
  if (params?.category) searchParams.category = params.category;

  return useQuery({
    queryKey: ['master-data', 'units', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MasterDataUnit>>(
        '/master-data/units',
        searchParams,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateMasterDataItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: 'countries' | 'species' | 'diseases' | 'denominators' | 'units';
      id: string;
      payload: Record<string, unknown>;
    }) =>
      apiClient.patch<{ data: unknown }>(
        `/master-data/${data.type}/${data.id}`,
        data.payload,
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['master-data', variables.type],
      });
    },
  });
}

// ─── Form Templates Hook (for campaign creation) ────────────────────────────

export interface FormTemplate {
  id: string;
  name: string;
  domain: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
}

export function useFormTemplates() {
  return useQuery({
    queryKey: ['form-builder', 'templates'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<FormTemplate>>(
        '/form-builder/templates',
        { status: 'published' },
      ),
    staleTime: 5 * 60_000,
  });
}

// ─── Interop Types ──────────────────────────────────────────────────────────

export interface InteropConnector {
  id: string;
  name: string;
  code: 'WAHIS' | 'EMPRES' | 'FAOSTAT' | 'FISHSTATJ' | 'CITES';
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastSync: string | null;
  nextScheduledSync: string | null;
  totalExports: number;
  totalImports: number;
  errorCount: number;
}

export interface WahisExport {
  id: string;
  country: string;
  countryCode: string;
  reportType: 'immediate' | 'followup' | 'sixmonthly' | 'annual';
  period: string;
  status: 'draft' | 'pending' | 'exported' | 'accepted' | 'rejected';
  recordCount: number;
  format: 'JSON' | 'XML';
  exportedAt: string | null;
  exportedBy: string | null;
  wahisRef: string | null;
  createdAt: string;
}

export interface WahisExportDetail extends WahisExport {
  records: Array<{
    id: string;
    disease: string;
    species: string;
    cases: number;
    deaths: number;
    region: string;
  }>;
  formatPreview: string;
  downloadUrl: string | null;
}

export interface EmpresFeed {
  id: string;
  signalId: string;
  title: string;
  source: string;
  confidence: 'rumor' | 'unverified' | 'verified' | 'confirmed';
  country: string;
  disease: string;
  receivedAt: string;
  processedAt: string | null;
  status: 'received' | 'processed' | 'matched' | 'discarded';
}

export interface FaostatSync {
  id: string;
  dataset: string;
  direction: 'import' | 'export';
  status: 'pending' | 'running' | 'completed' | 'failed';
  recordCount: number;
  discrepancies: number;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

// ─── Interop Hooks ──────────────────────────────────────────────────────────

export function useInteropConnectors() {
  return useQuery({
    queryKey: ['interop', 'connectors'],
    queryFn: () =>
      apiClient.get<{ data: InteropConnector[] }>('/interop-hub/connectors'),
    refetchInterval: 5 * 60_000,
  });
}

export function useWahisExports(params?: {
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
    queryKey: ['interop', 'wahis', 'exports', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WahisExport>>(
        '/interop-hub/wahis/exports',
        searchParams,
      ),
  });
}

export function useWahisExport(id: string) {
  return useQuery({
    queryKey: ['interop', 'wahis', 'exports', id],
    queryFn: () =>
      apiClient.get<{ data: WahisExportDetail }>(
        `/interop-hub/wahis/exports/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateWahisExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      country: string;
      reportType: string;
      periodStart: string;
      periodEnd: string;
      format: string;
    }) =>
      apiClient.post<{ data: WahisExport }>(
        '/interop-hub/wahis/exports',
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interop', 'wahis'] });
    },
  });
}

export function useEmpresFeed(params?: {
  page?: number;
  limit?: number;
  status?: string;
  confidence?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.confidence) searchParams.confidence = params.confidence;

  return useQuery({
    queryKey: ['interop', 'empres', 'feed', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<EmpresFeed>>(
        '/interop-hub/empres/feed',
        searchParams,
      ),
  });
}

export function useFaostatSyncs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  direction?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.direction) searchParams.direction = params.direction;

  return useQuery({
    queryKey: ['interop', 'faostat', 'syncs', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<FaostatSync>>(
        '/interop-hub/faostat/syncs',
        searchParams,
      ),
  });
}

export function useTriggerFaostatSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { dataset: string }) =>
      apiClient.post<{ data: FaostatSync }>(
        '/interop-hub/faostat/sync',
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interop', 'faostat'] });
    },
  });
}

// ─── Export History Types & Hooks ────────────────────────────────────────────

export interface ExportHistoryRecord {
  id: string;
  tenantId: string;
  connectorType: 'WAHIS' | 'EMPRES' | 'FAOSTAT';
  countryCode: string;
  periodStart: string;
  periodEnd: string;
  format: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  recordCount: number | null;
  packageUrl: string | null;
  packageSize: number | null;
  errorMessage: string | null;
  exportedBy: string;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useExportHistory(params?: {
  page?: number;
  limit?: number;
  connector?: string;
  status?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.connector) searchParams.connector = params.connector;
  if (params?.status) searchParams.status = params.status;

  return useQuery({
    queryKey: ['interop', 'exports', 'history', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<ExportHistoryRecord>>(
        '/interop-hub/exports/history',
        searchParams,
      ),
  });
}

export function useRetryExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: ExportHistoryRecord }>(
        `/interop-hub/exports/${id}/retry`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interop', 'exports'] });
    },
  });
}

// ─── Notification Types & Hooks ─────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  email: Record<string, boolean>;
  sms: Record<string, boolean>;
  push: Record<string, boolean>;
}

export function useNotifications(params?: { page?: number; limit?: number }) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);

  const fallback: PaginatedResponse<Notification> = { data: [], meta: { total: 0, page: 1, limit: 20 } };
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: withFallback(
      () => apiClient.get<PaginatedResponse<Notification>>(
        '/messages/notifications',
        searchParams,
      ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<{ data: Notification }>(
        `/messages/notifications/${id}/read`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post<{ data: { count: number } }>(
        '/messages/notifications/mark-all-read',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['settings', 'notification-preferences'],
    queryFn: () =>
      apiClient.get<{ data: Array<{ eventType: string; email: boolean; sms: boolean; push: boolean }> }>(
        '/messages/preferences',
      ),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      // API expects one POST per event type: { eventType, email, sms, push }
      const eventKeys = new Set([
        ...Object.keys(prefs.email),
        ...Object.keys(prefs.sms),
        ...Object.keys(prefs.push),
      ]);
      await Promise.all(
        Array.from(eventKeys).map((eventType) =>
          apiClient.post('/messages/preferences', {
            eventType,
            email: !!prefs.email[eventType],
            sms: !!prefs.sms[eventType],
            push: !!prefs.push[eventType],
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['settings', 'notification-preferences'],
      });
    },
  });
}

// ─── Settings Hooks ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  code: string;
  level: string;
  domain: string;
  config: Record<string, unknown>;
  isActive: boolean;
}

export interface DataContract {
  id: string;
  name: string;
  description: string;
  provider: string;
  consumer: string;
  frequency: string;
  timelinessSla: number;
  qualitySla: { minPassRate: number };
  status: 'active' | 'draft' | 'suspended';
  complianceRate: number;
  lastDelivery: string | null;
  createdAt: string;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: () =>
      apiClient.get<{ data: UserProfile }>('/credential/users/me'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }) =>
      apiClient.patch<{ data: UserProfile }>('/credential/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post<{ data: { message: string } }>(
        '/credential/users/me/change-password',
        data,
      ),
  });
}

export function useTenantConfig() {
  return useQuery({
    queryKey: ['settings', 'tenant'],
    queryFn: () =>
      apiClient.get<{ data: TenantConfig }>('/tenants/current'),
  });
}

export function useUpdateTenantConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; domain?: string; config?: Record<string, unknown> }) =>
      apiClient.patch<{ data: TenantConfig }>('/tenants/current', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'tenant'] });
    },
  });
}

export function useDataContracts(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;

  return useQuery({
    queryKey: ['settings', 'data-contracts', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<DataContract>>(
        '/data-contract/contracts',
        searchParams,
      ),
  });
}

// ─── Livestock Types ────────────────────────────────────────────────────────

export interface LivestockCensus {
  id: string;
  country: string;
  countryCode: string;
  region: string;
  species: string;
  year: number;
  population: number;
  femaleBreeding: number;
  maleBreeding: number;
  young: number;
  source: string;
  status: 'draft' | 'validated' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface ProductionRecord {
  id: string;
  country: string;
  countryCode: string;
  species: string;
  productType: 'milk' | 'meat' | 'eggs' | 'wool' | 'hides' | 'honey';
  quantity: number;
  unit: string;
  year: number;
  quarter?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionChartPoint {
  productType: string;
  value: number;
  unit: string;
}

export interface TranshumanceCorridor {
  id: string;
  name: string;
  originCountry: string;
  destinationCountry: string;
  species: string;
  estimatedAnimals: number;
  seasonStart: string;
  seasonEnd: string;
  status: 'active' | 'inactive' | 'disrupted';
  crossBorder: boolean;
  route: Array<[number, number]>;
  createdAt: string;
  updatedAt: string;
}

export interface LivestockKpis {
  data: {
    totalPopulation: number;
    populationTrend: number;
    countriesReporting: number;
    speciesTracked: number;
    productionVolume: number;
    productionTrend: number;
    activeCorridors: number;
    corridorsTrend: number;
  };
}

// ─── Livestock Hooks ────────────────────────────────────────────────────────

const LIVESTOCK_KPIS_FALLBACK: LivestockKpis = {
  data: {
    totalPopulation: 456_200_000, populationTrend: 3.2,
    countriesReporting: 42, speciesTracked: 18,
    productionVolume: 12_500_000, productionTrend: 5.1,
    activeCorridors: 37, corridorsTrend: -2,
  },
};

export function useLivestockKpis() {
  return useQuery({
    queryKey: ['livestock', 'kpis'],
    queryFn: withFallback(
      () => analyticsClient.get<LivestockKpis>('/analytics/livestock/population'),
      LIVESTOCK_KPIS_FALLBACK,
    ),
    placeholderData: LIVESTOCK_KPIS_FALLBACK,
  });
}

export function useLivestockCensus(params?: {
  page?: number;
  limit?: number;
  country?: string;
  species?: string;
  year?: number;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.species) searchParams.species = params.species;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<LivestockCensus> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['livestock', 'census', params],
    queryFn: withFallback(
      () =>
        livestockClient.get<PaginatedResponse<LivestockCensus>>(
          '/livestock/census',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useLivestockProduction(params?: {
  page?: number;
  limit?: number;
  country?: string;
  species?: string;
  productType?: string;
  year?: number;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.species) searchParams.species = params.species;
  if (params?.productType) searchParams.productType = params.productType;
  if (params?.year) searchParams.year = String(params.year);

  const fallback: PaginatedResponse<ProductionRecord> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['livestock', 'production', params],
    queryFn: withFallback(
      () =>
        livestockClient.get<PaginatedResponse<ProductionRecord>>(
          '/livestock/production',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useProductionByType(params?: { country?: string; year?: number }) {
  const searchParams: Record<string, string> = {};
  if (params?.country) searchParams.country = params.country;
  if (params?.year) searchParams.year = String(params.year);

  const fallback: { data: ProductionChartPoint[] } = { data: [] };
  return useQuery({
    queryKey: ['livestock', 'production-by-type', params],
    queryFn: withFallback(
      () =>
        livestockClient.get<{ data: ProductionChartPoint[] }>(
          '/livestock/production',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useLivestockTranshumance(params?: {
  page?: number;
  limit?: number;
  status?: string;
  crossBorder?: boolean;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.crossBorder !== undefined) searchParams.crossBorder = String(params.crossBorder);
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<TranshumanceCorridor> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['livestock', 'transhumance', params],
    queryFn: withFallback(
      () =>
        livestockClient.get<PaginatedResponse<TranshumanceCorridor>>(
          '/livestock/transhumance',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Fisheries Types ────────────────────────────────────────────────────────

export interface CaptureRecord {
  id: string;
  country: string;
  countryCode: string;
  species: string;
  faoArea: string;
  catchMethod: string;
  quantity: number;
  unit: string;
  year: number;
  quarter?: number;
  landingSite: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vessel {
  id: string;
  name: string;
  registrationNumber: string;
  flag: string;
  flagCode: string;
  vesselType: string;
  lengthMeters: number;
  tonnage: number;
  licenseStatus: 'valid' | 'expired' | 'suspended' | 'pending';
  homePort: string;
  createdAt: string;
  updatedAt: string;
}

export interface AquacultureFarm {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  species: string;
  farmType: 'pond' | 'cage' | 'raceway' | 'recirculating' | 'other';
  productionTonnes: number;
  areaHectares: number;
  status: 'active' | 'inactive' | 'under_construction';
  createdAt: string;
  updatedAt: string;
}

export interface CaptureTrend {
  year: number;
  marine: number;
  inland: number;
  aquaculture: number;
}

export interface FisheriesKpis {
  data: {
    totalCaptures: number;
    capturesTrend: number;
    registeredVessels: number;
    activeFarms: number;
    aquacultureProduction: number;
    aquacultureTrend: number;
    licensesExpiringSoon: number;
    countriesReporting: number;
  };
}

// ─── Fisheries Hooks ────────────────────────────────────────────────────────

const FISHERIES_KPIS_FALLBACK: FisheriesKpis = {
  data: {
    totalCaptures: 12_450_000, capturesTrend: 3.2,
    registeredVessels: 8_740, activeFarms: 1_260,
    aquacultureProduction: 2_870_000, aquacultureTrend: 7.8,
    licensesExpiringSoon: 312, countriesReporting: 38,
  },
};

export function useFisheriesKpis() {
  return useQuery({
    queryKey: ['fisheries', 'kpis'],
    queryFn: withFallback(
      () => analyticsClient.get<FisheriesKpis>('/analytics/fisheries/catches'),
      FISHERIES_KPIS_FALLBACK,
    ),
    placeholderData: FISHERIES_KPIS_FALLBACK,
  });
}

export function useFisheriesCaptures(params?: {
  page?: number;
  limit?: number;
  country?: string;
  species?: string;
  catchMethod?: string;
  year?: number;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.species) searchParams.species = params.species;
  if (params?.catchMethod) searchParams.catchMethod = params.catchMethod;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<CaptureRecord> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['fisheries', 'captures', params],
    queryFn: withFallback(
      () =>
        fisheriesClient.get<PaginatedResponse<CaptureRecord>>(
          '/fisheries/captures',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useCaptureTrends(params?: { country?: string }) {
  const searchParams: Record<string, string> = {};
  if (params?.country) searchParams.country = params.country;

  const fallback: { data: CaptureTrend[] } = { data: [] };
  return useQuery({
    queryKey: ['fisheries', 'capture-trends', params],
    queryFn: withFallback(
      () =>
        fisheriesClient.get<{ data: CaptureTrend[] }>(
          '/fisheries/captures',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useFisheriesVessels(params?: {
  page?: number;
  limit?: number;
  flag?: string;
  vesselType?: string;
  licenseStatus?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.flag) searchParams.flag = params.flag;
  if (params?.vesselType) searchParams.vesselType = params.vesselType;
  if (params?.licenseStatus) searchParams.licenseStatus = params.licenseStatus;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<Vessel> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['fisheries', 'vessels', params],
    queryFn: withFallback(
      () =>
        fisheriesClient.get<PaginatedResponse<Vessel>>(
          '/fisheries/vessels',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useFisheriesAquaculture(params?: {
  page?: number;
  limit?: number;
  country?: string;
  species?: string;
  farmType?: string;
  status?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.species) searchParams.species = params.species;
  if (params?.farmType) searchParams.farmType = params.farmType;
  if (params?.status) searchParams.status = params.status;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<AquacultureFarm> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['fisheries', 'aquaculture', params],
    queryFn: withFallback(
      () =>
        fisheriesClient.get<PaginatedResponse<AquacultureFarm>>(
          '/fisheries/aquaculture-farms',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Trade & SPS Types ──────────────────────────────────────────────────────

export interface TradeFlow {
  id: string;
  exportCountry: string;
  exportCountryCode: string;
  importCountry: string;
  importCountryCode: string;
  commodity: string;
  hsCode: string;
  flowDirection: 'EXPORT' | 'IMPORT' | 'TRANSIT';
  quantity: number;
  unit: string;
  valueFob: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  spsStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpsCertificate {
  id: string;
  certificateNumber: string;
  exporterCountry: string;
  importerCountry: string;
  commodity: string;
  quantity: number;
  unit: string;
  inspectionResult: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'PENDING';
  status: 'DRAFT' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
  inspectionDate: string;
  certifiedBy: string;
  certifiedAt: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketPrice {
  id: string;
  market: string;
  country: string;
  countryCode: string;
  commodity: string;
  species: string;
  priceType: 'WHOLESALE' | 'RETAIL' | 'FARM_GATE' | 'EXPORT';
  price: number;
  currency: string;
  unit: string;
  date: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeBalancePoint {
  period: string;
  exports: number;
  imports: number;
  balance: number;
}

export interface TradeKpis {
  data: {
    totalExports: number;
    exportsTrend: number;
    totalImports: number;
    importsTrend: number;
    spsComplianceRate: number;
    complianceTrend: number;
    activeCertificates: number;
    marketsTracked: number;
  };
}

// ─── Trade & SPS Hooks ──────────────────────────────────────────────────────

const TRADE_KPIS_FALLBACK: TradeKpis = {
  data: {
    totalExports: 4_820_000_000, exportsTrend: 8.3,
    totalImports: 5_130_000_000, importsTrend: 4.1,
    spsComplianceRate: 91.6, complianceTrend: 2.4,
    activeCertificates: 1_247, marketsTracked: 342,
  },
};

export function useTradeKpis() {
  return useQuery({
    queryKey: ['trade', 'kpis'],
    queryFn: withFallback(
      () => analyticsClient.get<TradeKpis>('/analytics/trade/balance'),
      TRADE_KPIS_FALLBACK,
    ),
    placeholderData: TRADE_KPIS_FALLBACK,
  });
}

export function useTradeFlows(params?: {
  page?: number;
  limit?: number;
  commodity?: string;
  flowDirection?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.commodity) searchParams.commodity = params.commodity;
  if (params?.flowDirection) searchParams.flowDirection = params.flowDirection;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<TradeFlow> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['trade', 'flows', params],
    queryFn: withFallback(
      () =>
        tradeSpsClient.get<PaginatedResponse<TradeFlow>>(
          '/trade/flows',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useTradeBalance(params?: { year?: number }) {
  const searchParams: Record<string, string> = {};
  if (params?.year) searchParams.year = String(params.year);

  const fallback: { data: TradeBalancePoint[] } = { data: [] };
  return useQuery({
    queryKey: ['trade', 'balance', params],
    queryFn: withFallback(
      () =>
        analyticsClient.get<{ data: TradeBalancePoint[] }>(
          '/analytics/trade/balance',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useSpsCertificates(params?: {
  page?: number;
  limit?: number;
  status?: string;
  inspectionResult?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.inspectionResult) searchParams.inspectionResult = params.inspectionResult;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<SpsCertificate> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['trade', 'sps', params],
    queryFn: withFallback(
      () =>
        tradeSpsClient.get<PaginatedResponse<SpsCertificate>>(
          '/trade/sps-certificates',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useMarketPrices(params?: {
  page?: number;
  limit?: number;
  commodity?: string;
  priceType?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.commodity) searchParams.commodity = params.commodity;
  if (params?.priceType) searchParams.priceType = params.priceType;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<MarketPrice> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['trade', 'market-prices', params],
    queryFn: withFallback(
      () =>
        tradeSpsClient.get<PaginatedResponse<MarketPrice>>(
          '/trade/market-prices',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Knowledge Hub Types ────────────────────────────────────────────────────

export interface Publication {
  id: string;
  title: string;
  description: string;
  domain: string;
  type: 'brief' | 'report' | 'guideline' | 'dataset' | 'infographic';
  authors: string[];
  publishedAt: string;
  language: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  downloads: number;
  createdAt: string;
}

export interface ElearningCourse {
  id: string;
  title: string;
  description: string;
  domain: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
  lessonsCount: number;
  enrolledCount: number;
  completionRate: number;
  thumbnailUrl?: string;
  instructor: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
}

export interface ElearningCourseDetail extends ElearningCourse {
  lessons: ElearningLesson[];
  userProgress?: {
    completedLessons: number;
    lastAccessedAt: string;
    percentComplete: number;
  };
}

export interface ElearningLesson {
  id: string;
  title: string;
  order: number;
  durationMinutes: number;
  type: 'video' | 'text' | 'quiz' | 'exercise';
  completed?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  domain: string;
  order: number;
  updatedAt: string;
}

export interface KnowledgeKpis {
  data: {
    totalPublications: number;
    publicationsTrend: number;
    activeCourses: number;
    totalEnrolled: number;
    avgCompletionRate: number;
    completionTrend: number;
    totalDownloads: number;
    downloadsTrend: number;
  };
}

// ─── Knowledge Hub Hooks ────────────────────────────────────────────────────

const KNOWLEDGE_KPIS_FALLBACK: KnowledgeKpis = {
  data: {
    totalPublications: 1_240, publicationsTrend: 15.3,
    activeCourses: 48, totalEnrolled: 3_450,
    avgCompletionRate: 72.4, completionTrend: 4.2,
    totalDownloads: 28_900, downloadsTrend: 22.1,
  },
};

export function useKnowledgeKpis() {
  return useQuery({
    queryKey: ['knowledge', 'kpis'],
    queryFn: withFallback(
      () => knowledgeHubClient.get<KnowledgeKpis>('/knowledge/publications'),
      KNOWLEDGE_KPIS_FALLBACK,
    ),
    placeholderData: KNOWLEDGE_KPIS_FALLBACK,
  });
}

export function usePublications(params?: {
  page?: number;
  limit?: number;
  domain?: string;
  type?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.type) searchParams.type = params.type;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<Publication> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['knowledge', 'publications', params],
    queryFn: withFallback(
      () =>
        knowledgeHubClient.get<PaginatedResponse<Publication>>(
          '/knowledge/publications',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useElearningCourses(params?: {
  page?: number;
  limit?: number;
  domain?: string;
  level?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.level) searchParams.level = params.level;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ElearningCourse> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['knowledge', 'elearning', params],
    queryFn: withFallback(
      () =>
        knowledgeHubClient.get<PaginatedResponse<ElearningCourse>>(
          '/knowledge/elearning',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useElearningCourse(id: string) {
  return useQuery({
    queryKey: ['knowledge', 'elearning', id],
    queryFn: () =>
      knowledgeHubClient.get<{ data: ElearningCourseDetail }>(
        `/knowledge/elearning/${id}`,
      ),
    enabled: !!id,
  });
}

export function useFaqItems(params?: { domain?: string }) {
  const searchParams: Record<string, string> = {};
  if (params?.domain) searchParams.domain = params.domain;

  const fallback: { data: FaqItem[] } = { data: [] };
  return useQuery({
    queryKey: ['knowledge', 'faq', params],
    queryFn: withFallback(
      () =>
        knowledgeHubClient.get<{ data: FaqItem[] }>(
          '/knowledge/faq',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
    staleTime: 5 * 60_000,
  });
}

// ─── Audit Log Types & Hooks ──────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';
  actor: {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
  };
  timestamp: string;
  reason?: string;
  dataClassification: 'PUBLIC' | 'PARTNER' | 'RESTRICTED' | 'CONFIDENTIAL';
}

export function useAuditLog(params?: {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  search?: string;
}) {
  const selectedTenantId = useTenantId();
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.action) searchParams.action = params.action;
  if (params?.entityType) searchParams.entityType = params.entityType;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<AuditEntry> = {
    data: [],
    meta: { total: 0, page: 1, limit: 20 },
  };

  return useQuery({
    queryKey: ['audit', 'log', selectedTenantId, params],
    queryFn: withFallback(
      () =>
        apiClient.get<PaginatedResponse<AuditEntry>>(
          '/credential/audit',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Dashboard Expanded KPIs Hook (time-range aware) ─────────────────────────

export type TimeRange = '7d' | '30d' | '90d' | '1y';

export function useDashboardKpisRange(range: TimeRange) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['dashboard', 'kpis', tenantId, range],
    queryFn: withFallback(
      () => analyticsClient.get<DashboardKpis>('/analytics/dashboard/kpis', { range }),
      DASHBOARD_KPIS_FALLBACK,
    ),
    placeholderData: DASHBOARD_KPIS_FALLBACK,
  });
}

// ─── Outbreak Alerts ─────────────────────────────────────────────────────────

export interface OutbreakAlert {
  id: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  country: string;
  disease: string;
  createdAt: string;
  dismissed?: boolean;
}

const OUTBREAK_ALERTS_FALLBACK: { data: OutbreakAlert[] } = { data: [] };

export function useOutbreakAlerts() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['dashboard', 'alerts', tenantId],
    queryFn: withFallback(
      () => animalHealthClient.get<{ data: OutbreakAlert[] }>('/animal-health/events'),
      OUTBREAK_ALERTS_FALLBACK,
    ),
    placeholderData: OUTBREAK_ALERTS_FALLBACK,
    refetchInterval: 3 * 60_000,
  });
}

// ─── Realtime Activity Events (WebSocket) ────────────────────────────────────

export interface RealtimeEvent {
  id: string;
  type: 'outbreak' | 'validation' | 'export' | 'campaign' | 'quality' | 'submission';
  action: string;
  detail: string;
  actor: string;
  country?: string;
  timestamp: string;
}

const REALTIME_EVENTS_FALLBACK: { data: RealtimeEvent[] } = { data: [] };

export function useRealtimeEvents(maxEvents = 20) {
  const queryClient = useQueryClient();

  // Seed with empty data; WebSocket pushes update the cache
  const query = useQuery({
    queryKey: ['realtime', 'events'],
    queryFn: withFallback(
      () => analyticsClient.get<{ data: RealtimeEvent[] }>('/analytics/realtime/events'),
      REALTIME_EVENTS_FALLBACK,
    ),
    placeholderData: REALTIME_EVENTS_FALLBACK,
    staleTime: 30_000,
  });

  // Push new event from WebSocket
  function pushEvent(event: RealtimeEvent) {
    queryClient.setQueryData<{ data: RealtimeEvent[] }>(
      ['realtime', 'events'],
      (old) => {
        const events = old?.data ?? [];
        return { data: [event, ...events].slice(0, maxEvents) };
      },
    );
  }

  return { ...query, pushEvent };
}

// ─── Country Outbreak Density (for choropleth) ──────────────────────────────

export interface CountryOutbreakDensity {
  countryCode: string;
  country: string;
  outbreaks: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function useCountryOutbreakDensity(range?: TimeRange) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['dashboard', 'outbreak-density', tenantId, range],
    queryFn: () =>
      analyticsClient.get<{ data: CountryOutbreakDensity[] }>(
        '/analytics/dashboard/outbreak-density',
        range ? { range } : {},
      ),
    placeholderData: {
      data: [
        { countryCode: 'KE', country: 'Kenya', outbreaks: 12, severity: 'high' as const },
        { countryCode: 'ET', country: 'Ethiopia', outbreaks: 18, severity: 'critical' as const },
        { countryCode: 'NG', country: 'Nigeria', outbreaks: 8, severity: 'high' as const },
        { countryCode: 'TZ', country: 'Tanzania', outbreaks: 5, severity: 'medium' as const },
        { countryCode: 'ZA', country: 'South Africa', outbreaks: 3, severity: 'medium' as const },
        { countryCode: 'GH', country: 'Ghana', outbreaks: 6, severity: 'medium' as const },
        { countryCode: 'UG', country: 'Uganda', outbreaks: 7, severity: 'high' as const },
        { countryCode: 'EG', country: 'Egypt', outbreaks: 9, severity: 'high' as const },
        { countryCode: 'SN', country: 'Senegal', outbreaks: 2, severity: 'low' as const },
        { countryCode: 'CD', country: 'DR Congo', outbreaks: 4, severity: 'medium' as const },
        { countryCode: 'RW', country: 'Rwanda', outbreaks: 1, severity: 'low' as const },
        { countryCode: 'CM', country: 'Cameroon', outbreaks: 3, severity: 'medium' as const },
      ],
    },
  });
}

// ─── Analytics Types & Hooks ─────────────────────────────────────────────────

export interface TrendDataPoint {
  date: string;
  outbreaks: number;
  vaccinations: number;
  labResults: number;
  tradeFlows: number;
}

export function useAnalyticsTrends(params?: {
  range?: TimeRange;
  domain?: string;
  country?: string;
}) {
  const tenantId = useTenantId();
  const searchParams: Record<string, string> = {};
  if (params?.range) searchParams.range = params.range;
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.country) searchParams.country = params.country;

  return useQuery({
    queryKey: ['analytics', 'trends', tenantId, params],
    queryFn: () =>
      analyticsClient.get<{ data: TrendDataPoint[] }>(
        '/analytics/health/trends',
        searchParams,
      ),
    placeholderData: {
      data: Array.from({ length: 12 }, (_, i) => ({
        date: `2026-${String(i + 1).padStart(2, '0')}`,
        outbreaks: Math.floor(20 + Math.random() * 30),
        vaccinations: Math.floor(500 + Math.random() * 400),
        labResults: Math.floor(100 + Math.random() * 200),
        tradeFlows: Math.floor(50 + Math.random() * 100),
      })),
    },
  });
}

export interface CountryComparisonRow {
  country: string;
  countryCode: string;
  outbreaks: number;
  vaccinationCoverage: number;
  labCapacity: number;
  qualityScore: number;
  tradeVolume: number;
  dataCompleteness: number;
}

export function useCountryComparison(params?: {
  countries?: string[];
  metric?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.countries?.length) searchParams.countries = params.countries.join(',');
  if (params?.metric) searchParams.metric = params.metric;

  return useQuery({
    queryKey: ['analytics', 'comparison', params],
    queryFn: () =>
      analyticsClient.get<{ data: CountryComparisonRow[] }>(
        '/analytics/cross-domain/correlations',
        searchParams,
      ),
    placeholderData: {
      data: [
        { country: 'Kenya', countryCode: 'KE', outbreaks: 12, vaccinationCoverage: 89, labCapacity: 85, qualityScore: 92, tradeVolume: 450_000, dataCompleteness: 95 },
        { country: 'Ethiopia', countryCode: 'ET', outbreaks: 18, vaccinationCoverage: 76, labCapacity: 72, qualityScore: 84, tradeVolume: 380_000, dataCompleteness: 88 },
        { country: 'Nigeria', countryCode: 'NG', outbreaks: 8, vaccinationCoverage: 82, labCapacity: 78, qualityScore: 90, tradeVolume: 620_000, dataCompleteness: 91 },
        { country: 'Tanzania', countryCode: 'TZ', outbreaks: 5, vaccinationCoverage: 91, labCapacity: 80, qualityScore: 93, tradeVolume: 290_000, dataCompleteness: 94 },
        { country: 'South Africa', countryCode: 'ZA', outbreaks: 3, vaccinationCoverage: 95, labCapacity: 96, qualityScore: 97, tradeVolume: 890_000, dataCompleteness: 98 },
        { country: 'Ghana', countryCode: 'GH', outbreaks: 6, vaccinationCoverage: 84, labCapacity: 74, qualityScore: 88, tradeVolume: 210_000, dataCompleteness: 90 },
        { country: 'Uganda', countryCode: 'UG', outbreaks: 7, vaccinationCoverage: 87, labCapacity: 76, qualityScore: 89, tradeVolume: 180_000, dataCompleteness: 92 },
        { country: 'Egypt', countryCode: 'EG', outbreaks: 9, vaccinationCoverage: 93, labCapacity: 91, qualityScore: 95, tradeVolume: 780_000, dataCompleteness: 96 },
      ],
    },
  });
}

export interface QualityDrilldownRow {
  domain: string;
  gate: string;
  totalRecords: number;
  passed: number;
  failed: number;
  warnings: number;
  passRate: number;
  trend: number;
}

export function useQualityDrilldown(params?: {
  domain?: string;
  gate?: string;
  tenant?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.gate) searchParams.gate = params.gate;
  if (params?.tenant) searchParams.tenant = params.tenant;

  return useQuery({
    queryKey: ['analytics', 'quality', params],
    queryFn: () =>
      analyticsClient.get<{ data: QualityDrilldownRow[] }>(
        '/analytics/quality/dashboard',
        searchParams,
      ),
    placeholderData: {
      data: [
        { domain: 'Animal Health', gate: 'Completeness', totalRecords: 1240, passed: 1178, failed: 42, warnings: 20, passRate: 95.0, trend: 2.1 },
        { domain: 'Animal Health', gate: 'Temporal Consistency', totalRecords: 1240, passed: 1200, failed: 28, warnings: 12, passRate: 96.8, trend: 1.5 },
        { domain: 'Animal Health', gate: 'Geographic Consistency', totalRecords: 1240, passed: 1210, failed: 18, warnings: 12, passRate: 97.6, trend: 0.8 },
        { domain: 'Livestock', gate: 'Completeness', totalRecords: 890, passed: 823, failed: 45, warnings: 22, passRate: 92.5, trend: -1.2 },
        { domain: 'Livestock', gate: 'Codes & Vocabularies', totalRecords: 890, passed: 856, failed: 22, warnings: 12, passRate: 96.2, trend: 3.0 },
        { domain: 'Fisheries', gate: 'Completeness', totalRecords: 540, passed: 486, failed: 38, warnings: 16, passRate: 90.0, trend: 4.5 },
        { domain: 'Fisheries', gate: 'Deduplication', totalRecords: 540, passed: 524, failed: 10, warnings: 6, passRate: 97.0, trend: 1.2 },
        { domain: 'Trade', gate: 'Completeness', totalRecords: 720, passed: 691, failed: 18, warnings: 11, passRate: 96.0, trend: 0.5 },
        { domain: 'Trade', gate: 'Units', totalRecords: 720, passed: 706, failed: 8, warnings: 6, passRate: 98.1, trend: 0.3 },
      ],
    },
  });
}

export interface ExportConfig {
  metrics: string[];
  countries: string[];
  periodStart: string;
  periodEnd: string;
  format: 'csv' | 'pdf' | 'xlsx';
}

export function useExportBuilder() {
  return useMutation({
    mutationFn: async (config: ExportConfig) =>
      analyticsClient.post<{ data: { downloadUrl: string; fileName: string } }>(
        '/analytics/export/csv',
        config,
      ),
  });
}

export function useExportableMetrics() {
  return useQuery({
    queryKey: ['analytics', 'export', 'metrics'],
    queryFn: () =>
      analyticsClient.get<{ data: { id: string; label: string; domain: string }[] }>(
        '/analytics/export/csv',
      ),
    placeholderData: {
      data: [
        { id: 'outbreaks', label: 'Active Outbreaks', domain: 'Animal Health' },
        { id: 'vaccination-coverage', label: 'Vaccination Coverage', domain: 'Animal Health' },
        { id: 'lab-results', label: 'Lab Results', domain: 'Animal Health' },
        { id: 'livestock-census', label: 'Livestock Census', domain: 'Livestock' },
        { id: 'production-records', label: 'Production Records', domain: 'Livestock' },
        { id: 'capture-records', label: 'Capture Records', domain: 'Fisheries' },
        { id: 'trade-flows', label: 'Trade Flows', domain: 'Trade' },
        { id: 'sps-certificates', label: 'SPS Certificates', domain: 'Trade' },
        { id: 'market-prices', label: 'Market Prices', domain: 'Trade' },
        { id: 'quality-scores', label: 'Quality Scores', domain: 'Data Quality' },
      ],
    },
    staleTime: 10 * 60_000,
  });
}

// ─── Reports Types & Hooks ───────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'wahis_6monthly' | 'wahis_annual' | 'continental_brief' | 'custom';
  domains: string[];
  outputFormat: 'pdf' | 'xlsx' | 'docx';
  lastGeneratedAt?: string;
  createdBy: string;
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ['reports', 'templates'],
    queryFn: () =>
      apiClient.get<{ data: ReportTemplate[] }>('/reports/templates'),
    placeholderData: {
      data: [
        { id: 'tpl-wahis-6m', name: 'WAHIS 6-Monthly Report', description: 'Semi-annual disease situation report for WOAH (WAHIS submission format)', type: 'wahis_6monthly' as const, domains: ['Animal Health'], outputFormat: 'pdf' as const, lastGeneratedAt: '2026-01-15T10:00:00Z', createdBy: 'System' },
        { id: 'tpl-wahis-ann', name: 'WAHIS Annual Report', description: 'Annual animal health situation report covering all notifiable diseases', type: 'wahis_annual' as const, domains: ['Animal Health'], outputFormat: 'pdf' as const, lastGeneratedAt: '2026-01-30T14:00:00Z', createdBy: 'System' },
        { id: 'tpl-continental', name: 'Continental Brief', description: 'AU-IBAR quarterly continental animal resources brief with KPIs and trends', type: 'continental_brief' as const, domains: ['Animal Health', 'Livestock', 'Fisheries', 'Trade'], outputFormat: 'pdf' as const, lastGeneratedAt: '2026-02-01T09:00:00Z', createdBy: 'System' },
        { id: 'tpl-custom', name: 'Custom Report', description: 'Build a custom report by selecting domains, metrics, countries, and period', type: 'custom' as const, domains: ['Animal Health', 'Livestock', 'Fisheries', 'Trade', 'Data Quality'], outputFormat: 'pdf' as const, createdBy: 'System' },
      ],
    },
  });
}

export interface GenerateReportRequest {
  templateId: string;
  country?: string;
  countries?: string[];
  periodStart: string;
  periodEnd: string;
  format?: 'pdf' | 'xlsx' | 'docx';
  customMetrics?: string[];
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  country?: string;
  periodStart: string;
  periodEnd: string;
  format: string;
  downloadUrl?: string;
  fileSize?: number;
  generatedBy: string;
  createdAt: string;
  completedAt?: string;
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: GenerateReportRequest) =>
      apiClient.post<{ data: GeneratedReport }>('/reports/generate', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'history'] });
    },
  });
}

export function useReportHistory(params?: {
  page?: number;
  limit?: number;
  status?: string;
  templateId?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.templateId) searchParams.templateId = params.templateId;

  return useQuery({
    queryKey: ['reports', 'history', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<GeneratedReport>>(
        '/reports/history',
        searchParams,
      ),
    placeholderData: {
      data: [
        { id: 'rpt-001', templateId: 'tpl-wahis-6m', templateName: 'WAHIS 6-Monthly Report', status: 'completed' as const, country: 'Kenya', periodStart: '2025-07-01', periodEnd: '2025-12-31', format: 'pdf', downloadUrl: '/api/v1/reports/download/rpt-001', fileSize: 2_450_000, generatedBy: 'Dr. Ochieng', createdAt: '2026-01-15T10:00:00Z', completedAt: '2026-01-15T10:05:00Z' },
        { id: 'rpt-002', templateId: 'tpl-continental', templateName: 'Continental Brief', status: 'completed' as const, periodStart: '2025-10-01', periodEnd: '2025-12-31', format: 'pdf', downloadUrl: '/api/v1/reports/download/rpt-002', fileSize: 5_200_000, generatedBy: 'AU-IBAR Admin', createdAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T09:12:00Z' },
        { id: 'rpt-003', templateId: 'tpl-wahis-ann', templateName: 'WAHIS Annual Report', status: 'generating' as const, country: 'Ethiopia', periodStart: '2025-01-01', periodEnd: '2025-12-31', format: 'pdf', generatedBy: 'Dr. Kebede', createdAt: '2026-02-20T07:30:00Z' },
        { id: 'rpt-004', templateId: 'tpl-custom', templateName: 'Custom Report', status: 'completed' as const, country: 'Nigeria', periodStart: '2025-01-01', periodEnd: '2025-06-30', format: 'xlsx', downloadUrl: '/api/v1/reports/download/rpt-004', fileSize: 1_800_000, generatedBy: 'Mr. Adeyemi', createdAt: '2026-02-18T14:20:00Z', completedAt: '2026-02-18T14:25:00Z' },
      ],
      meta: { total: 4, page: 1, limit: 20 },
    },
  });
}

// ─── Analytics Dashboard Summary ─────────────────────────────────────────────

export interface AnalyticsSummary {
  data: {
    totalRecords: number;
    recordsTrend: number;
    countriesReporting: number;
    countriesTrend: number;
    avgQualityScore: number;
    qualityTrend: number;
    pendingExports: number;
    domainBreakdown: { domain: string; records: number; quality: number }[];
  };
}

export function useAnalyticsSummary(range?: TimeRange) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['analytics', 'summary', tenantId, range],
    queryFn: () =>
      analyticsClient.get<AnalyticsSummary>(
        '/analytics/health/kpis',
        range ? { range } : {},
      ),
    placeholderData: {
      data: {
        totalRecords: 48_250,
        recordsTrend: 14.2,
        countriesReporting: 47,
        countriesTrend: 4,
        avgQualityScore: 93.5,
        qualityTrend: 1.8,
        pendingExports: 5,
        domainBreakdown: [
          { domain: 'Animal Health', records: 15_400, quality: 94.1 },
          { domain: 'Livestock', records: 12_800, quality: 92.5 },
          { domain: 'Fisheries', records: 8_200, quality: 90.0 },
          { domain: 'Trade & SPS', records: 6_900, quality: 96.0 },
          { domain: 'Knowledge', records: 4_950, quality: 97.2 },
        ],
      },
    },
  });
}

// ─── Wildlife Types ─────────────────────────────────────────────────────────

export interface WildlifeInventory {
  id: string;
  species: string;
  commonName: string;
  taxonomicClass: string;
  iucnStatus: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
  country: string;
  countryCode: string;
  protectedArea: string;
  estimatedPopulation: number;
  surveyYear: number;
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectedArea {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  designation: 'National Park' | 'Game Reserve' | 'Marine Reserve' | 'Community Conservancy' | 'Biosphere Reserve' | 'WDPA Listed';
  areaKm2: number;
  speciesCount: number;
  established: number;
  managementAuthority: string;
  status: 'active' | 'proposed' | 'degraded';
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface CitesPermit {
  id: string;
  permitNumber: string;
  species: string;
  appendix: 'I' | 'II' | 'III';
  purpose: 'Commercial' | 'Scientific' | 'Education' | 'Zoo' | 'Breeding' | 'Personal';
  exportCountry: string;
  importCountry: string;
  quantity: number;
  unit: string;
  status: 'issued' | 'expired' | 'revoked' | 'pending';
  issuedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WildlifeKpis {
  data: {
    protectedAreas: number;
    protectedAreasTrend: number;
    speciesInventoried: number;
    speciesTrend: number;
    citesPermits: number;
    permitsTrend: number;
    wildlifeCrimes: number;
    crimesTrend: number;
  };
}

// ─── Wildlife Hooks ─────────────────────────────────────────────────────────

const WILDLIFE_KPIS_FALLBACK: WildlifeKpis = {
  data: {
    protectedAreas: 1_240, protectedAreasTrend: 2.1,
    speciesInventoried: 8_450, speciesTrend: 5.3,
    citesPermits: 3_120, permitsTrend: -1.8,
    wildlifeCrimes: 187, crimesTrend: -12.4,
  },
};

export function useWildlifeKpis() {
  return useQuery({
    queryKey: ['wildlife', 'kpis'],
    queryFn: withFallback(
      () => analyticsClient.get<WildlifeKpis>('/analytics/wildlife/kpis'),
      WILDLIFE_KPIS_FALLBACK,
    ),
    placeholderData: WILDLIFE_KPIS_FALLBACK,
  });
}

export function useWildlifeInventory(params?: {
  page?: number;
  limit?: number;
  taxonomicClass?: string;
  iucnStatus?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.taxonomicClass) searchParams.taxonomicClass = params.taxonomicClass;
  if (params?.iucnStatus) searchParams.iucnStatus = params.iucnStatus;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<WildlifeInventory> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['wildlife', 'inventory', params],
    queryFn: withFallback(
      () =>
        wildlifeClient.get<PaginatedResponse<WildlifeInventory>>(
          '/wildlife/inventories',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useProtectedAreas(params?: {
  page?: number;
  limit?: number;
  designation?: string;
  country?: string;
  status?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.designation) searchParams.designation = params.designation;
  if (params?.country) searchParams.country = params.country;
  if (params?.status) searchParams.status = params.status;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ProtectedArea> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['wildlife', 'protected-areas', params],
    queryFn: withFallback(
      () =>
        wildlifeClient.get<PaginatedResponse<ProtectedArea>>(
          '/wildlife/protected-areas',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useCitesPermits(params?: {
  page?: number;
  limit?: number;
  appendix?: string;
  status?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.appendix) searchParams.appendix = params.appendix;
  if (params?.status) searchParams.status = params.status;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<CitesPermit> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['wildlife', 'cites', params],
    queryFn: withFallback(
      () =>
        wildlifeClient.get<PaginatedResponse<CitesPermit>>(
          '/wildlife/cites-permits',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Apiculture Types ───────────────────────────────────────────────────────

export interface Apiary {
  id: string;
  name: string;
  owner: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  totalColonies: number;
  hiveType: 'Langstroth' | 'Top-bar' | 'Traditional' | 'Flow' | 'Other';
  status: 'active' | 'inactive' | 'abandoned';
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColonyHealth {
  id: string;
  apiaryName: string;
  country: string;
  countryCode: string;
  inspectionDate: string;
  coloniesInspected: number;
  healthyColonies: number;
  infectedColonies: number;
  pest: string;
  pestPrevalence: number;
  queenStatus: 'present' | 'absent' | 'unknown';
  colonyStrength: 'strong' | 'moderate' | 'weak';
  mortality: number;
  treatment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApicultureProduction {
  id: string;
  apiaryName: string;
  country: string;
  countryCode: string;
  year: number;
  quarter?: number;
  honeyKg: number;
  waxKg: number;
  propolisKg: number;
  pollenKg: number;
  royalJellyKg: number;
  harvestMethod: string;
  qualityGrade: 'A' | 'B' | 'C' | 'ungraded';
  createdAt: string;
  updatedAt: string;
}

export interface ApicultureKpis {
  data: {
    registeredApiaries: number;
    apiariesTrend: number;
    activeColonies: number;
    coloniesTrend: number;
    honeyProduction: number;
    productionTrend: number;
    colonyLossRate: number;
    lossRateTrend: number;
  };
}

// ─── Apiculture Hooks ───────────────────────────────────────────────────────

const APICULTURE_KPIS_FALLBACK: ApicultureKpis = {
  data: {
    registeredApiaries: 24_500, apiariesTrend: 4.7,
    activeColonies: 312_000, coloniesTrend: 2.3,
    honeyProduction: 185_000, productionTrend: 6.1,
    colonyLossRate: 14.2, lossRateTrend: -3.5,
  },
};

export function useApicultureKpis() {
  return useQuery({
    queryKey: ['apiculture', 'kpis'],
    queryFn: withFallback(
      () => analyticsClient.get<ApicultureKpis>('/analytics/apiculture/kpis'),
      APICULTURE_KPIS_FALLBACK,
    ),
    placeholderData: APICULTURE_KPIS_FALLBACK,
  });
}

export function useApiaries(params?: {
  page?: number;
  limit?: number;
  hiveType?: string;
  status?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.hiveType) searchParams.hiveType = params.hiveType;
  if (params?.status) searchParams.status = params.status;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<Apiary> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['apiculture', 'apiaries', params],
    queryFn: withFallback(
      () =>
        apicultureClient.get<PaginatedResponse<Apiary>>(
          '/apiculture/apiaries',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useColonyHealth(params?: {
  page?: number;
  limit?: number;
  pest?: string;
  colonyStrength?: string;
  country?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.pest) searchParams.pest = params.pest;
  if (params?.colonyStrength) searchParams.colonyStrength = params.colonyStrength;
  if (params?.country) searchParams.country = params.country;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ColonyHealth> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['apiculture', 'colony-health', params],
    queryFn: withFallback(
      () =>
        apicultureClient.get<PaginatedResponse<ColonyHealth>>(
          '/apiculture/colony-health',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useApicultureProduction(params?: {
  page?: number;
  limit?: number;
  country?: string;
  year?: number;
  qualityGrade?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.qualityGrade) searchParams.qualityGrade = params.qualityGrade;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ApicultureProduction> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['apiculture', 'production', params],
    queryFn: withFallback(
      () =>
        apicultureClient.get<PaginatedResponse<ApicultureProduction>>(
          '/apiculture/production',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Governance Types ───────────────────────────────────────────────────────

export interface GovernanceKpis {
  legalFrameworks: number;
  pvsEvaluations: number;
  stakeholders: number;
  capacityPrograms: number;
}

export interface LegalFramework {
  id: string;
  title: string;
  type: 'LAW' | 'REGULATION' | 'POLICY' | 'STANDARD' | 'GUIDELINE';
  domain: string;
  adoptionDate: string;
  status: 'DRAFT' | 'ADOPTED' | 'IN_FORCE' | 'REPEALED';
  country: string;
  countryCode: string;
  dataClassification: string;
  createdAt: string;
  updatedAt: string;
}

export interface PvsEvaluation {
  id: string;
  country: string;
  countryCode: string;
  evaluationYear: number;
  evaluationType: string;
  overallScore: number;
  legislation: number;
  laboratories: number;
  riskAnalysis: number;
  quarantine: number;
  surveillance: number;
  diseaseControl: number;
  foodSafety: number;
  vetEducation: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceStakeholder {
  id: string;
  name: string;
  type: string;
  country: string;
  countryCode: string;
  sector: string;
  contactEmail: string;
  partnershipStatus: 'active' | 'inactive' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceCapacity {
  id: string;
  organizationName: string;
  country: string;
  countryCode: string;
  year: number;
  staffCount: number;
  budgetUsd: number;
  pvsSelfAssessmentScore: number;
  oieStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Governance Hooks ───────────────────────────────────────────────────────

export function useGovernanceKpis() {
  const fallback: GovernanceKpis = { legalFrameworks: 0, pvsEvaluations: 0, stakeholders: 0, capacityPrograms: 0 };
  return useQuery({
    queryKey: ['governance', 'kpis'],
    queryFn: withFallback(
      () => governanceClient.get<GovernanceKpis>('/governance/kpis'),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useLegalFrameworks(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  domain?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.type) searchParams.type = params.type;
  if (params?.status) searchParams.status = params.status;
  if (params?.domain) searchParams.domain = params.domain;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<LegalFramework> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['governance', 'legal-frameworks', params],
    queryFn: withFallback(
      () =>
        governanceClient.get<PaginatedResponse<LegalFramework>>(
          '/governance/legal-frameworks',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function usePvsEvaluations(params?: {
  page?: number;
  limit?: number;
  country?: string;
  year?: number;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.country) searchParams.country = params.country;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<PvsEvaluation> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['governance', 'pvs-evaluations', params],
    queryFn: withFallback(
      () =>
        governanceClient.get<PaginatedResponse<PvsEvaluation>>(
          '/governance/pvs-evaluations',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useGovernanceStakeholders(params?: {
  page?: number;
  limit?: number;
  type?: string;
  partnershipStatus?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.type) searchParams.type = params.type;
  if (params?.partnershipStatus) searchParams.partnershipStatus = params.partnershipStatus;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<GovernanceStakeholder> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['governance', 'stakeholders', params],
    queryFn: withFallback(
      () =>
        governanceClient.get<PaginatedResponse<GovernanceStakeholder>>(
          '/governance/stakeholders',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useGovernanceCapacity(params?: {
  page?: number;
  limit?: number;
  year?: number;
  organizationName?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.year) searchParams.year = String(params.year);
  if (params?.organizationName) searchParams.organizationName = params.organizationName;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<GovernanceCapacity> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['governance', 'capacity', params],
    queryFn: withFallback(
      () =>
        governanceClient.get<PaginatedResponse<GovernanceCapacity>>(
          '/governance/capacities',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

// ─── Climate-Env Types ──────────────────────────────────────────────────────

export interface ClimateEnvKpis {
  monitoringStations: number;
  waterStressIndex: number;
  rangelandDegradation: number;
  climateHotspots: number;
}

export interface ClimateData {
  id: string;
  country: string;
  countryCode: string;
  region: string;
  date: string;
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaterStress {
  id: string;
  country: string;
  countryCode: string;
  region: string;
  period: string;
  index: number;
  waterAvailability: string;
  irrigatedAreaPct: number;
  source: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface Rangeland {
  id: string;
  country: string;
  countryCode: string;
  region: string;
  year: number;
  vegetationIndex: number;
  degradationLevel: 'none' | 'low' | 'moderate' | 'severe';
  areaHa: number;
  carryingCapacity: number;
  biomassKgHa: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClimateHotspot {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskType: string;
  affectedPopulation: number;
  livestockAtRisk: number;
  lastAssessed: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Climate-Env Hooks ──────────────────────────────────────────────────────

export function useClimateEnvKpis() {
  const fallback: ClimateEnvKpis = { monitoringStations: 0, waterStressIndex: 0, rangelandDegradation: 0, climateHotspots: 0 };
  return useQuery({
    queryKey: ['climate-env', 'kpis'],
    queryFn: withFallback(
      () => climateEnvClient.get<ClimateEnvKpis>('/climate/kpis'),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useClimateData(params?: {
  page?: number;
  limit?: number;
  source?: string;
  periodStart?: string;
  periodEnd?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.source) searchParams.source = params.source;
  if (params?.periodStart) searchParams.periodStart = params.periodStart;
  if (params?.periodEnd) searchParams.periodEnd = params.periodEnd;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ClimateData> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['climate-env', 'data', params],
    queryFn: withFallback(
      () =>
        climateEnvClient.get<PaginatedResponse<ClimateData>>(
          '/climate/data',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useWaterStress(params?: {
  page?: number;
  limit?: number;
  severity?: string;
  period?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.severity) searchParams.severity = params.severity;
  if (params?.period) searchParams.period = params.period;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<WaterStress> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['climate-env', 'water-stress', params],
    queryFn: withFallback(
      () =>
        climateEnvClient.get<PaginatedResponse<WaterStress>>(
          '/climate/water-stress',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useRangelands(params?: {
  page?: number;
  limit?: number;
  degradationLevel?: string;
  year?: number;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.degradationLevel) searchParams.degradationLevel = params.degradationLevel;
  if (params?.year) searchParams.year = String(params.year);
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<Rangeland> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['climate-env', 'rangelands', params],
    queryFn: withFallback(
      () =>
        climateEnvClient.get<PaginatedResponse<Rangeland>>(
          '/climate/rangelands',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}

export function useClimateHotspots(params?: {
  page?: number;
  limit?: number;
  riskLevel?: string;
  riskType?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.riskLevel) searchParams.riskLevel = params.riskLevel;
  if (params?.riskType) searchParams.riskType = params.riskType;
  if (params?.search) searchParams.search = params.search;

  const fallback: PaginatedResponse<ClimateHotspot> = { data: [], meta: { total: 0, page: 1, limit: 10 } };
  return useQuery({
    queryKey: ['climate-env', 'hotspots', params],
    queryFn: withFallback(
      () =>
        climateEnvClient.get<PaginatedResponse<ClimateHotspot>>(
          '/climate/hotspots',
          searchParams,
        ),
      fallback,
    ),
    placeholderData: fallback,
  });
}
