// ═══════════════════════════════════════════════════════════════════
//  ARIS Interoperability Hub v3 — TypeScript Types & DTOs
//  Mirrors: packages/db-schemas/prisma/interop.prisma
// ═══════════════════════════════════════════════════════════════════

// ─── Enums (string unions matching Prisma enums) ──────────────────

export type HubDirection = 'INBOUND' | 'OUTBOUND';

export type HubTransportType =
  | 'REST_API'
  | 'SFTP'
  | 'KAFKA'
  | 'FILE_UPLOAD'
  | 'WEBHOOK'
  | 'DHIS2'
  | 'FHIR'
  | 'WAHIS'
  | 'SOAP';

export type HubAuthType =
  | 'NONE'
  | 'BASIC'
  | 'OAUTH2'
  | 'API_KEY'
  | 'BEARER_TOKEN'
  | 'CERTIFICATE'
  | 'HMAC';

export type HubConnectionStatus =
  | 'DRAFT'
  | 'TESTING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type HubPipelineMode = 'AUTOMATIC' | 'MANUAL';

export type HubPipelineStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ERROR'
  | 'ARCHIVED';

export type HubTransactionStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'MAPPING'
  | 'TRANSFORMING'
  | 'VALIDATING'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOADING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'RETRY'
  | 'CANCELLED';

export type HubStepType =
  | 'RECEIVE'
  | 'REFERENTIAL_MAP'
  | 'FIELD_TRANSFORM'
  | 'SCHEMA_VALIDATE'
  | 'QUALITY_GATE'
  | 'ENRICH'
  | 'FORMAT_BUILD'
  | 'ROUTE'
  | 'NOTIFY'
  | 'DELIVER';

export type HubExportFormat =
  | 'WOAH_JSON'
  | 'WOAH_XML'
  | 'EMPRES_JSON'
  | 'FAOSTAT_CSV'
  | 'FAOSTAT_JSON'
  | 'FISHSTATJ_CSV'
  | 'CITES_CSV'
  | 'DHIS2_JSON'
  | 'FHIR_JSON'
  | 'CSV_GENERIC'
  | 'JSON_GENERIC'
  | 'EXCEL';

export type HubReferentialType =
  | 'DISEASE'
  | 'SPECIES'
  | 'GEO_ADMIN'
  | 'GEO_COUNTRY'
  | 'UNIT'
  | 'LAB'
  | 'COMMODITY'
  | 'MARKET'
  | 'VACCINE'
  | 'BREED'
  | 'AGE_GROUP'
  | 'PRODUCTION_SYSTEM'
  | 'CUSTOM';

export type HubScheduleFrequency =
  | 'REALTIME'
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'BIANNUAL'
  | 'ANNUAL'
  | 'ON_DEMAND';

export type HubAgreementStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REJECTED'
  | 'REVOKED';

export type HubNotificationType =
  | 'INBOUND_RECEIVED'
  | 'INBOUND_AWAITING_REVIEW'
  | 'INBOUND_APPROVED'
  | 'INBOUND_REJECTED'
  | 'INBOUND_LOADED'
  | 'INBOUND_FAILED'
  | 'OUTBOUND_READY'
  | 'OUTBOUND_AWAITING_REVIEW'
  | 'OUTBOUND_SENT'
  | 'OUTBOUND_FAILED'
  | 'CONNECTION_HEALTH_DOWN'
  | 'CONNECTION_HEALTH_RESTORED'
  | 'SLA_BREACH'
  | 'PIPELINE_ERROR';

export type HubStepOnError = 'STOP' | 'SKIP' | 'RETRY' | 'CONTINUE';

export type HubStepLogStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type HubRecordStatus = 'ACCEPTED' | 'REJECTED' | 'WARNING';

export type HubHealthStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'TIMEOUT';

export type HubNotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type HubNotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

// ─── Entities ─────────────────────────────────────────────────────

export interface HubConnection {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  system_type: HubTransportType;
  system_name: string | null;
  system_version: string | null;
  country_code: string | null;
  country_name: string | null;
  organization: string | null;
  base_url: string | null;
  auth_type: HubAuthType;
  credentials: Record<string, unknown>;
  headers: Record<string, string>;
  tls_config: Record<string, unknown> | null;
  direction: HubDirection;
  domains: string[];
  status: HubConnectionStatus;
  last_health_at: Date | null;
  last_health_ok: boolean;
  health_message: string | null;
  focal_technical: Record<string, unknown> | null;
  focal_data_owner: Record<string, unknown> | null;
  total_transactions: number;
  total_records: number;
  total_errors: number;
  last_transaction_at: Date | null;
  notes: string | null;
  config: Record<string, unknown>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  // Relations (optional — loaded via include)
  pipelines?: HubPipeline[];
  referential_mappings?: HubReferentialMapping[];
  field_mappings?: HubFieldMapping[];
  transactions?: HubTransaction[];
  schedules?: HubSchedule[];
  agreements?: HubAgreement[];
}

export interface HubPipeline {
  id: string;
  connection_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  direction: HubDirection;
  domain: string;
  sub_domain: string | null;
  entity_type: string | null;
  mode: HubPipelineMode;
  status: HubPipelineStatus;
  target_campaign_id: string | null;
  target_form_id: string | null;
  target_workflow_id: string | null;
  export_format: HubExportFormat | null;
  quality_gates_enabled: boolean;
  min_quality_score: number | null;
  reject_on_quality_fail: boolean;
  max_retries: number;
  retry_delay_ms: number;
  dlq_enabled: boolean;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run_at: Date | null;
  last_run_status: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  connection?: HubConnection;
  steps?: HubPipelineStep[];
  transactions?: HubTransaction[];
}

export interface HubPipelineStep {
  id: string;
  pipeline_id: string;
  step_order: number;
  step_type: HubStepType;
  name: string;
  description: string | null;
  is_enabled: boolean;
  config: StepConfig;
  on_error: HubStepOnError;
  timeout_ms: number;
  created_at: Date;
  updated_at: Date;
  pipeline?: HubPipeline;
}

export interface HubTransaction {
  id: string;
  pipeline_id: string;
  connection_id: string;
  tenant_id: string;
  direction: HubDirection;
  status: HubTransactionStatus;
  current_step: string | null;
  mode: HubPipelineMode;
  domain: string;
  entity_type: string | null;
  country_code: string | null;
  target_campaign_id: string | null;
  target_form_id: string | null;
  export_format: HubExportFormat | null;
  records_total: number;
  records_accepted: number;
  records_rejected: number;
  records_warning: number;
  source_payload: unknown;
  mapped_payload: unknown;
  target_payload: unknown;
  validation_report: unknown;
  rejection_details: unknown;
  source_file_url: string | null;
  source_file_name: string | null;
  source_file_size: number | null;
  output_file_url: string | null;
  output_file_name: string | null;
  output_file_size: number | null;
  delivery_url: string | null;
  delivery_method: string | null;
  delivery_status: number | null;
  delivery_response: string | null;
  error_message: string | null;
  error_details: unknown;
  retry_count: number;
  max_retries: number;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  initiated_by: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  created_at: Date;
  pipeline?: HubPipeline;
  connection?: HubConnection;
  records?: HubTransactionRecord[];
  steps_log?: HubTransactionStepLog[];
}

export interface HubTransactionRecord {
  id: string;
  transaction_id: string;
  record_index: number;
  status: HubRecordStatus;
  error_message: string | null;
  error_fields: Array<{ field: string; rule: string; message: string }> | null;
  source_data: unknown;
  mapped_data: unknown;
  target_data: unknown;
  submission_id: string | null;
  form_entry_id: string | null;
  quality_score: number | null;
  quality_report: unknown;
  created_at: Date;
  transaction?: HubTransaction;
}

export interface HubTransactionStepLog {
  id: string;
  transaction_id: string;
  step_type: HubStepType;
  step_name: string;
  step_order: number;
  status: HubStepLogStatus;
  input_summary: unknown;
  output_summary: unknown;
  error_message: string | null;
  duration_ms: number | null;
  started_at: Date;
  completed_at: Date | null;
  transaction?: HubTransaction;
}

export interface HubReferentialMapping {
  id: string;
  connection_id: string;
  referential_type: HubReferentialType;
  direction: HubDirection;
  source_code: string;
  source_label: string | null;
  target_code: string;
  target_label: string | null;
  target_id: string | null;
  is_verified: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  connection?: HubConnection;
}

export interface HubFieldMapping {
  id: string;
  connection_id: string;
  entity_type: string;
  direction: HubDirection;
  source_field: string;
  target_field: string;
  transformation: string | null;
  default_value: string | null;
  is_required: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  connection?: HubConnection;
}

export interface HubSchedule {
  id: string;
  connection_id: string;
  pipeline_id: string | null;
  tenant_id: string;
  frequency: HubScheduleFrequency;
  cron_expression: string | null;
  timezone: string;
  window_start: string | null;
  window_end: string | null;
  period_type: string | null;
  period_start: Date | null;
  period_end: Date | null;
  is_active: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  last_run_ok: boolean | null;
  created_at: Date;
  updated_at: Date;
  connection?: HubConnection;
}

export interface HubAgreement {
  id: string;
  connection_id: string;
  reference: string;
  tenant_id: string;
  owner_tenant_id: string;
  owner_name: string;
  partner_tenant_id: string | null;
  partner_name: string;
  title: string;
  description: string | null;
  purpose: string | null;
  legal_basis: string | null;
  domains: string[];
  direction: HubDirection;
  data_scope: Record<string, unknown> | null;
  data_classification: string | null;
  frequency: HubScheduleFrequency | null;
  timeliness_sla_hours: number | null;
  quality_min_score: number | null;
  status: HubAgreementStatus;
  proposed_at: Date | null;
  reviewed_at: Date | null;
  accepted_at: Date | null;
  rejected_at: Date | null;
  revoked_at: Date | null;
  valid_from: Date | null;
  valid_until: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  connection?: HubConnection;
}

export interface HubNotification {
  id: string;
  tenant_id: string;
  transaction_id: string | null;
  connection_id: string | null;
  type: HubNotificationType;
  title: string;
  message: string;
  severity: HubNotificationSeverity;
  metadata: Record<string, unknown>;
  channels: HubNotificationChannel[];
  sent_at: Date | null;
  read_at: Date | null;
  read_by: string | null;
  created_at: Date;
}

export interface HubHealthCheck {
  id: string;
  connection_id: string;
  status: HubHealthStatus;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: Date;
}

export interface HubAuditLog {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}

// ─── Step Config Types (per step_type) ────────────────────────────

export interface ReceiveStepConfig {
  /** Expected content type: "application/json", "text/csv", "application/xml" */
  content_type?: string;
  /** Field path in payload that contains the array of records */
  records_path?: string;
  /** Maximum batch size */
  max_batch_size?: number;
}

export interface ReferentialMapStepConfig {
  /** Referential types to map in this step */
  referential_types?: HubReferentialType[];
  /** If true, unmapped codes cause an error; if false, pass through as-is */
  strict?: boolean;
}

export interface FieldTransformStepConfig {
  /** Entity type for field mapping lookup */
  entity_type?: string;
  /** Inline JSONata expression (overrides DB field mappings) */
  inline_expression?: string;
}

export interface SchemaValidateStepConfig {
  /** JSON Schema object or URL to validate against */
  json_schema?: Record<string, unknown>;
  /** Form template ID to fetch schema from */
  form_template_id?: string;
  /** If true, validation errors reject the record; if false, add warnings */
  strict?: boolean;
}

export interface QualityGateStepConfig {
  /** Quality rules to run (IDs or names). Empty = run all 8 standard rules */
  rules?: string[];
  /** Minimum quality score (0-1) to accept */
  min_score?: number;
  /** Data quality service URL (override) */
  quality_service_url?: string;
}

export interface EnrichStepConfig {
  /** Enrichment sources: "species", "diseases", "geo", "units" */
  sources?: string[];
  /** Master data service URL (override) */
  master_data_url?: string;
}

export interface FormatBuildStepConfig {
  /** Target format for this step */
  format?: HubExportFormat;
  /** Template name or ID for the format builder */
  template?: string;
  /** Additional format-specific options */
  options?: Record<string, unknown>;
}

export interface RouteStepConfig {
  /** Campaign ID to create submissions in (INBOUND) */
  campaign_id?: string;
  /** Form template ID (INBOUND) */
  form_id?: string;
  /** Collecte service URL (override) */
  collecte_url?: string;
}

export interface NotifyStepConfig {
  /** Notification channels */
  channels?: HubNotificationChannel[];
  /** Notification title template (supports {{variables}}) */
  title_template?: string;
  /** Notification message template */
  message_template?: string;
}

export interface DeliverStepConfig {
  /** Delivery URL (overrides connection base_url) */
  url?: string;
  /** HTTP method: POST, PUT, PATCH */
  method?: string;
  /** Additional headers for delivery */
  headers?: Record<string, string>;
  /** Max delivery retries */
  max_retries?: number;
  /** Retry delay in ms */
  retry_delay_ms?: number;
}

/** Union of all step config types */
export type StepConfig =
  | ReceiveStepConfig
  | ReferentialMapStepConfig
  | FieldTransformStepConfig
  | SchemaValidateStepConfig
  | QualityGateStepConfig
  | EnrichStepConfig
  | FormatBuildStepConfig
  | RouteStepConfig
  | NotifyStepConfig
  | DeliverStepConfig
  | Record<string, unknown>;

// ─── DTOs — Create/Update ─────────────────────────────────────────

export interface CreateConnectionDto {
  tenant_id: string;
  name: string;
  description?: string;
  system_type: HubTransportType;
  system_name?: string;
  system_version?: string;
  country_code?: string;
  country_name?: string;
  organization?: string;
  base_url?: string;
  auth_type?: HubAuthType;
  credentials?: Record<string, unknown>;
  headers?: Record<string, string>;
  tls_config?: Record<string, unknown>;
  direction: HubDirection;
  domains: string[];
  focal_technical?: Record<string, unknown>;
  focal_data_owner?: Record<string, unknown>;
  notes?: string;
  config?: Record<string, unknown>;
  created_by: string;
}

export interface UpdateConnectionDto {
  name?: string;
  description?: string;
  system_type?: HubTransportType;
  system_name?: string;
  system_version?: string;
  country_code?: string;
  country_name?: string;
  organization?: string;
  base_url?: string;
  auth_type?: HubAuthType;
  credentials?: Record<string, unknown>;
  headers?: Record<string, string>;
  tls_config?: Record<string, unknown>;
  domains?: string[];
  focal_technical?: Record<string, unknown>;
  focal_data_owner?: Record<string, unknown>;
  notes?: string;
  config?: Record<string, unknown>;
}

export interface CreatePipelineDto {
  connection_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  direction: HubDirection;
  domain: string;
  sub_domain?: string;
  entity_type?: string;
  mode?: HubPipelineMode;
  target_campaign_id?: string;
  target_form_id?: string;
  target_workflow_id?: string;
  export_format?: HubExportFormat;
  quality_gates_enabled?: boolean;
  min_quality_score?: number;
  reject_on_quality_fail?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  dlq_enabled?: boolean;
  created_by: string;
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string;
  mode?: HubPipelineMode;
  target_campaign_id?: string;
  target_form_id?: string;
  target_workflow_id?: string;
  export_format?: HubExportFormat;
  quality_gates_enabled?: boolean;
  min_quality_score?: number;
  reject_on_quality_fail?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  dlq_enabled?: boolean;
}

export interface CreatePipelineStepDto {
  pipeline_id: string;
  step_order: number;
  step_type: HubStepType;
  name: string;
  description?: string;
  is_enabled?: boolean;
  config?: StepConfig;
  on_error?: HubStepOnError;
  timeout_ms?: number;
}

export interface UpdatePipelineStepDto {
  name?: string;
  description?: string;
  is_enabled?: boolean;
  config?: StepConfig;
  on_error?: HubStepOnError;
  timeout_ms?: number;
}

export interface CreateReferentialMappingDto {
  connection_id: string;
  referential_type: HubReferentialType;
  direction?: HubDirection;
  source_code: string;
  source_label?: string;
  target_code: string;
  target_label?: string;
  target_id?: string;
  is_verified?: boolean;
  notes?: string;
}

export interface UpdateReferentialMappingDto {
  source_code?: string;
  source_label?: string;
  target_code?: string;
  target_label?: string;
  target_id?: string;
  is_verified?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface CreateFieldMappingDto {
  connection_id: string;
  entity_type: string;
  direction: HubDirection;
  source_field: string;
  target_field: string;
  transformation?: string;
  default_value?: string;
  is_required?: boolean;
  notes?: string;
}

export interface UpdateFieldMappingDto {
  source_field?: string;
  target_field?: string;
  transformation?: string;
  default_value?: string;
  is_required?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface CreateScheduleDto {
  connection_id: string;
  pipeline_id?: string;
  tenant_id: string;
  frequency: HubScheduleFrequency;
  cron_expression?: string;
  timezone?: string;
  window_start?: string;
  window_end?: string;
  period_type?: string;
  period_start?: Date;
  period_end?: Date;
}

export interface UpdateScheduleDto {
  frequency?: HubScheduleFrequency;
  cron_expression?: string;
  timezone?: string;
  window_start?: string;
  window_end?: string;
  period_type?: string;
  period_start?: Date;
  period_end?: Date;
  is_active?: boolean;
}

export interface CreateAgreementDto {
  connection_id: string;
  tenant_id: string;
  owner_tenant_id: string;
  owner_name: string;
  partner_tenant_id?: string;
  partner_name: string;
  title: string;
  description?: string;
  purpose?: string;
  legal_basis?: string;
  domains: string[];
  direction: HubDirection;
  data_scope?: Record<string, unknown>;
  data_classification?: string;
  frequency?: HubScheduleFrequency;
  timeliness_sla_hours?: number;
  quality_min_score?: number;
  valid_from?: Date;
  valid_until?: Date;
  created_by: string;
}

export interface UpdateAgreementDto {
  title?: string;
  description?: string;
  purpose?: string;
  legal_basis?: string;
  domains?: string[];
  data_scope?: Record<string, unknown>;
  data_classification?: string;
  frequency?: HubScheduleFrequency;
  timeliness_sla_hours?: number;
  quality_min_score?: number;
  valid_from?: Date;
  valid_until?: Date;
}

export interface CreateNotificationDto {
  tenant_id: string;
  transaction_id?: string;
  connection_id?: string;
  type: HubNotificationType;
  title: string;
  message: string;
  severity?: HubNotificationSeverity;
  metadata?: Record<string, unknown>;
  channels: HubNotificationChannel[];
}

// ─── Query/Filter Types ───────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface TransactionFilters extends PaginationParams {
  direction?: HubDirection;
  status?: HubTransactionStatus;
  domain?: string;
  connection_id?: string;
  date_from?: Date;
  date_to?: Date;
}

export interface AuditFilters extends PaginationParams {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  actor_id?: string;
  date_from?: Date;
  date_to?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Pipeline Execution Types ─────────────────────────────────────

export interface PipelineExecutionInput {
  records: Record<string, unknown>[];
  source_file_url?: string;
  source_file_name?: string;
  source_file_size?: number;
  metadata?: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  records: Record<string, unknown>[];
  errors?: Array<{ record_index: number; field?: string; rule?: string; message: string }>;
  warnings?: Array<{ record_index: number; field?: string; message: string }>;
  metadata?: Record<string, unknown>;
}

// ─── Logger Interface ─────────────────────────────────────────────

export interface HubLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string | Error, ...args: unknown[]): void;
}
