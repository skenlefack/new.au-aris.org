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

// ─── Collecte Types ──────────────────────────────────────────────────────────

export interface CollecteCampaign {
  id: string;
  name: string;
  description: string;
  templateId: string;
  templateName: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  zones: string[];
  assignedAgents: number;
  totalSubmissions: number;
  targetSubmissions: number;
  validatedSubmissions: number;
  rejectedSubmissions: number;
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
  description: string;
  templateId: string;
  startDate: string;
  endDate: string;
  zones: string[];
  agentIds: string[];
}

// ─── Collecte Hooks ──────────────────────────────────────────────────────────

export function useCampaigns(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.limit) searchParams.limit = String(params.limit);
  if (params?.status) searchParams.status = params.status;
  if (params?.search) searchParams.search = params.search;

  return useQuery({
    queryKey: ['collecte', 'campaigns', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<CollecteCampaign>>(
        '/collecte/campaigns',
        searchParams,
      ),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['collecte', 'campaigns', id],
    queryFn: () =>
      apiClient.get<{ data: CollecteCampaignDetail }>(
        `/collecte/campaigns/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) =>
      apiClient.post<{ data: CollecteCampaign }>('/collecte/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collecte', 'campaigns'] });
    },
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ['collecte', 'submissions', id],
    queryFn: () =>
      apiClient.get<{ data: CollecteSubmissionDetail }>(
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
    refetchInterval: 30_000,
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

  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Notification>>(
        '/messages/notifications',
        searchParams,
      ),
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
      apiClient.get<{ data: NotificationPreferences }>(
        '/messages/preferences',
      ),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: NotificationPreferences) =>
      apiClient.put<{ data: NotificationPreferences }>(
        '/messages/preferences',
        prefs,
      ),
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
