/**
 * ARIS 4.0 — Typed Event Interfaces
 *
 * Every inter-service Kafka event has a strongly-typed interface.
 * The BaseEvent envelope is shared; domain payloads are specific.
 */

import type { EVENTS } from './event-catalog';

// ────────────────────────────────────────────────
// Base Envelope
// ────────────────────────────────────────────────

export interface BaseEvent<TPayload = unknown> {
  /** Unique event identifier (UUID v4) */
  eventId: string;
  /** Topic name from EVENTS catalog */
  eventType: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Schema version number */
  version: number;
  /** Originating service name */
  source: string;
  /** Multi-tenant context */
  tenantId?: string;
  /** User who triggered the event */
  userId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Typed payload */
  payload: TPayload;
}

// ────────────────────────────────────────────────
// Quality — Validation Requested (replaces REST collecte → data-quality)
// ────────────────────────────────────────────────

export interface QualityValidationRequestedPayload {
  recordId: string;
  entityType: string;
  domain: string;
  record: Record<string, unknown>;
  /** Optional fields for quality gates */
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

export interface QualityValidationRequestedEvent
  extends BaseEvent<QualityValidationRequestedPayload> {
  eventType: typeof EVENTS.QUALITY.VALIDATION_REQUESTED;
}

// ────────────────────────────────────────────────
// Quality — Record Validated (already existed as Kafka event)
// ────────────────────────────────────────────────

export interface QualityRecordValidatedPayload {
  reportId: string;
  recordId: string;
  entityType: string;
  domain: string;
  overallStatus: 'PASSED' | 'WARNING' | 'FAILED';
  totalDurationMs?: number;
  violations?: Array<{
    gate: string;
    field: string;
    message: string;
    severity: string;
  }>;
}

export interface QualityRecordValidatedEvent
  extends BaseEvent<QualityRecordValidatedPayload> {
  eventType: typeof EVENTS.QUALITY.RECORD_VALIDATED;
}

// ────────────────────────────────────────────────
// Quality — Record Rejected
// ────────────────────────────────────────────────

export interface QualityRecordRejectedPayload {
  reportId: string;
  recordId: string;
  entityType: string;
  domain: string;
  overallStatus: 'FAILED';
  violations?: Array<{
    gate: string;
    field: string;
    message: string;
    severity: string;
  }>;
}

export interface QualityRecordRejectedEvent
  extends BaseEvent<QualityRecordRejectedPayload> {
  eventType: typeof EVENTS.QUALITY.RECORD_REJECTED;
}

// ────────────────────────────────────────────────
// Collecte — Form Submitted
// ────────────────────────────────────────────────

export interface FormSubmittedPayload {
  submissionId: string;
  campaignId: string;
  templateId: string;
  submittedBy: string;
  submittedAt: string | Date;
  deviceId?: string | null;
  domain?: string;
  data: Record<string, unknown>;
}

export interface FormSubmittedEvent extends BaseEvent<FormSubmittedPayload> {
  eventType: typeof EVENTS.COLLECTE.FORM_SUBMITTED;
}

// ────────────────────────────────────────────────
// Collecte — Submission Quality Completed (data-quality → collecte callback)
// ────────────────────────────────────────────────

export interface SubmissionQualityCompletedPayload {
  submissionId: string;
  reportId: string;
  overallStatus: 'PASSED' | 'WARNING' | 'FAILED';
  domain: string;
}

export interface SubmissionQualityCompletedEvent
  extends BaseEvent<SubmissionQualityCompletedPayload> {
  eventType: typeof EVENTS.COLLECTE.SUBMISSION_QUALITY_COMPLETED;
}

// ────────────────────────────────────────────────
// Collecte — Submission Workflow Created (workflow → collecte callback)
// ────────────────────────────────────────────────

export interface SubmissionWorkflowCreatedPayload {
  submissionId: string;
  workflowInstanceId: string;
  domain: string;
}

export interface SubmissionWorkflowCreatedEvent
  extends BaseEvent<SubmissionWorkflowCreatedPayload> {
  eventType: typeof EVENTS.COLLECTE.SUBMISSION_WORKFLOW_CREATED;
}

// ────────────────────────────────────────────────
// Workflow — Instance Requested (replaces REST collecte → workflow)
// ────────────────────────────────────────────────

export interface WorkflowInstanceRequestedPayload {
  entityType: string;
  entityId: string;
  domain: string;
  qualityReportId?: string;
  dataContractId?: string;
}

export interface WorkflowInstanceRequestedEvent
  extends BaseEvent<WorkflowInstanceRequestedPayload> {
  eventType: typeof EVENTS.WORKFLOW.INSTANCE_REQUESTED;
}

// ────────────────────────────────────────────────
// Workflow — Instance Created
// ────────────────────────────────────────────────

export interface WorkflowInstanceCreatedPayload {
  instanceId: string;
  entityType: string;
  entityId: string;
  domain: string;
  currentLevel: string;
  status: string;
}

export interface WorkflowInstanceCreatedEvent
  extends BaseEvent<WorkflowInstanceCreatedPayload> {
  eventType: typeof EVENTS.WORKFLOW.INSTANCE_CREATED;
}

// ────────────────────────────────────────────────
// Workflow — WAHIS Ready / Analytics Ready
// ────────────────────────────────────────────────

export interface WorkflowFlagReadyPayload {
  instanceId: string;
  entityType: string;
  entityId: string;
  domain: string;
  flag: 'wahisReady' | 'analyticsReady';
}

export interface WorkflowWahisReadyEvent
  extends BaseEvent<WorkflowFlagReadyPayload> {
  eventType: typeof EVENTS.WORKFLOW.WAHIS_READY;
}

export interface WorkflowAnalyticsReadyEvent
  extends BaseEvent<WorkflowFlagReadyPayload> {
  eventType: typeof EVENTS.WORKFLOW.ANALYTICS_READY;
}

// ────────────────────────────────────────────────
// Health — Entity Flags Updated (replaces REST workflow → animal-health)
// ────────────────────────────────────────────────

export interface HealthEntityFlagsUpdatedPayload {
  entityType: string;
  entityId: string;
  wahisReady?: boolean;
  analyticsReady?: boolean;
}

export interface HealthEntityFlagsUpdatedEvent
  extends BaseEvent<HealthEntityFlagsUpdatedPayload> {
  eventType: typeof EVENTS.HEALTH.ENTITY_FLAGS_UPDATED;
}

// ────────────────────────────────────────────────
// Credential — User Events
// ────────────────────────────────────────────────

export interface UserCreatedPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  firstName: string;
  lastName: string;
}

export interface UserCreatedEvent extends BaseEvent<UserCreatedPayload> {
  eventType: typeof EVENTS.CREDENTIAL.USER_CREATED;
}

// ────────────────────────────────────────────────
// Tenant Events
// ────────────────────────────────────────────────

export interface TenantCreatedPayload {
  tenantId: string;
  name: string;
  level: string;
  parentId?: string;
  countryCode?: string;
}

export interface TenantCreatedEvent extends BaseEvent<TenantCreatedPayload> {
  eventType: typeof EVENTS.TENANT.CREATED;
}

// ────────────────────────────────────────────────
// Union of all typed events
// ────────────────────────────────────────────────

export type ArisEvent =
  | QualityValidationRequestedEvent
  | QualityRecordValidatedEvent
  | QualityRecordRejectedEvent
  | FormSubmittedEvent
  | SubmissionQualityCompletedEvent
  | SubmissionWorkflowCreatedEvent
  | WorkflowInstanceRequestedEvent
  | WorkflowInstanceCreatedEvent
  | WorkflowWahisReadyEvent
  | WorkflowAnalyticsReadyEvent
  | HealthEntityFlagsUpdatedEvent
  | UserCreatedEvent
  | TenantCreatedEvent;
