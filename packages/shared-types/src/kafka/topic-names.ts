// ── System Topics ──
export const TOPIC_SYS_TENANT_CREATED = 'sys.tenant.created.v1' as const;
export const TOPIC_SYS_TENANT_UPDATED = 'sys.tenant.updated.v1' as const;
export const TOPIC_SYS_CREDENTIAL_USER_CREATED = 'sys.credential.user.created.v1' as const;
export const TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED = 'sys.credential.user.authenticated.v1' as const;
export const TOPIC_SYS_MESSAGE_NOTIFICATION_SENT = 'sys.message.notification.sent.v1' as const;
export const TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED = 'sys.message.notification.failed.v1' as const;
export const TOPIC_SYS_DRIVE_FILE_UPLOADED = 'sys.drive.file.uploaded.v1' as const;

// ── Master Data Topics ──
export const TOPIC_SYS_MASTER_GEO_UPDATED = 'sys.master.geo.updated.v1' as const;
export const TOPIC_SYS_MASTER_SPECIES_UPDATED = 'sys.master.species.updated.v1' as const;
export const TOPIC_SYS_MASTER_DISEASE_UPDATED = 'sys.master.disease.updated.v1' as const;
export const TOPIC_SYS_MASTER_DENOMINATOR_UPDATED = 'sys.master.denominator.updated.v1' as const;

// ── Quality Topics ──
export const TOPIC_AU_QUALITY_RECORD_VALIDATED = 'au.quality.record.validated.v1' as const;
export const TOPIC_AU_QUALITY_RECORD_REJECTED = 'au.quality.record.rejected.v1' as const;
export const TOPIC_AU_QUALITY_CORRECTION_OVERDUE = 'au.quality.correction.overdue.v1' as const;

// ── Collecte Topics ──
export const TOPIC_MS_COLLECTE_CAMPAIGN_CREATED = 'ms.collecte.campaign.created.v1' as const;
export const TOPIC_MS_COLLECTE_FORM_SUBMITTED = 'ms.collecte.form.submitted.v1' as const;
export const TOPIC_MS_COLLECTE_FORM_SYNCED = 'ms.collecte.form.synced.v1' as const;

// ── FormBuilder Topics ──
export const TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED = 'ms.formbuilder.template.created.v1' as const;
export const TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED = 'ms.formbuilder.template.published.v1' as const;

// ── Workflow Topics ──
export const TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED = 'au.workflow.validation.submitted.v1' as const;
export const TOPIC_AU_WORKFLOW_VALIDATION_APPROVED = 'au.workflow.validation.approved.v1' as const;
export const TOPIC_AU_WORKFLOW_VALIDATION_REJECTED = 'au.workflow.validation.rejected.v1' as const;
export const TOPIC_AU_WORKFLOW_VALIDATION_ESCALATED = 'au.workflow.validation.escalated.v1' as const;
export const TOPIC_AU_WORKFLOW_WAHIS_READY = 'au.workflow.wahis.ready.v1' as const;
export const TOPIC_AU_WORKFLOW_ANALYTICS_READY = 'au.workflow.analytics.ready.v1' as const;

// ── Health Domain Topics ──
export const TOPIC_MS_HEALTH_EVENT_CREATED = 'ms.health.event.created.v1' as const;
export const TOPIC_MS_HEALTH_EVENT_UPDATED = 'ms.health.event.updated.v1' as const;
export const TOPIC_MS_HEALTH_EVENT_CONFIRMED = 'ms.health.event.confirmed.v1' as const;
export const TOPIC_MS_HEALTH_LAB_RESULT_CREATED = 'ms.health.lab.result.created.v1' as const;
export const TOPIC_MS_HEALTH_VACCINATION_COMPLETED = 'ms.health.vaccination.completed.v1' as const;
export const TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED = 'ms.health.surveillance.reported.v1' as const;
export const TOPIC_REC_HEALTH_OUTBREAK_ALERT = 'rec.health.outbreak.alert.v1' as const;

// ── Interop Topics ──
export const TOPIC_AU_INTEROP_WAHIS_EXPORTED = 'au.interop.wahis.exported.v1' as const;
export const TOPIC_AU_INTEROP_EMPRES_FED = 'au.interop.empres.fed.v1' as const;
export const TOPIC_AU_INTEROP_FAOSTAT_SYNCED = 'au.interop.faostat.synced.v1' as const;

// ── DLQ Topics ──
export const TOPIC_DLQ_ALL = 'dlq.all.v1' as const;
export const TOPIC_DLQ_HEALTH = 'dlq.health.v1' as const;
export const TOPIC_DLQ_COLLECTE = 'dlq.collecte.v1' as const;

/** All registered topic names for validation */
export const ALL_TOPICS = [
  TOPIC_SYS_TENANT_CREATED,
  TOPIC_SYS_TENANT_UPDATED,
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
  TOPIC_SYS_CREDENTIAL_USER_AUTHENTICATED,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED,
  TOPIC_SYS_DRIVE_FILE_UPLOADED,
  TOPIC_SYS_MASTER_GEO_UPDATED,
  TOPIC_SYS_MASTER_SPECIES_UPDATED,
  TOPIC_SYS_MASTER_DISEASE_UPDATED,
  TOPIC_SYS_MASTER_DENOMINATOR_UPDATED,
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
  TOPIC_MS_COLLECTE_CAMPAIGN_CREATED,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_MS_COLLECTE_FORM_SYNCED,
  TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED,
  TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_WORKFLOW_VALIDATION_ESCALATED,
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_UPDATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
  TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
  TOPIC_AU_INTEROP_WAHIS_EXPORTED,
  TOPIC_AU_INTEROP_EMPRES_FED,
  TOPIC_AU_INTEROP_FAOSTAT_SYNCED,
  TOPIC_DLQ_ALL,
  TOPIC_DLQ_HEALTH,
  TOPIC_DLQ_COLLECTE,
] as const;

export type TopicName = (typeof ALL_TOPICS)[number];
