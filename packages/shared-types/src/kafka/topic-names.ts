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
export const TOPIC_AU_QUALITY_VALIDATION_REQUESTED = 'au.quality.validation.requested.v1' as const;

// ── Collecte Topics ──
export const TOPIC_MS_COLLECTE_CAMPAIGN_CREATED = 'ms.collecte.campaign.created.v1' as const;
export const TOPIC_MS_COLLECTE_FORM_SUBMITTED = 'ms.collecte.form.submitted.v1' as const;
export const TOPIC_MS_COLLECTE_FORM_SYNCED = 'ms.collecte.form.synced.v1' as const;
export const TOPIC_MS_COLLECTE_SUBMISSION_QUALITY_COMPLETED = 'ms.collecte.submission.quality-completed.v1' as const;
export const TOPIC_MS_COLLECTE_SUBMISSION_WORKFLOW_CREATED = 'ms.collecte.submission.workflow-created.v1' as const;

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
export const TOPIC_AU_WORKFLOW_INSTANCE_REQUESTED = 'au.workflow.instance.requested.v1' as const;
export const TOPIC_AU_WORKFLOW_INSTANCE_CREATED = 'au.workflow.instance.created.v1' as const;

// ── Health Domain Topics ──
export const TOPIC_MS_HEALTH_EVENT_CREATED = 'ms.health.event.created.v1' as const;
export const TOPIC_MS_HEALTH_EVENT_UPDATED = 'ms.health.event.updated.v1' as const;
export const TOPIC_MS_HEALTH_EVENT_CONFIRMED = 'ms.health.event.confirmed.v1' as const;
export const TOPIC_MS_HEALTH_LAB_RESULT_CREATED = 'ms.health.lab.result.created.v1' as const;
export const TOPIC_MS_HEALTH_VACCINATION_COMPLETED = 'ms.health.vaccination.completed.v1' as const;
export const TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED = 'ms.health.surveillance.reported.v1' as const;
export const TOPIC_REC_HEALTH_OUTBREAK_ALERT = 'rec.health.outbreak.alert.v1' as const;
export const TOPIC_MS_HEALTH_ENTITY_FLAGS_UPDATED = 'ms.health.entity.flags-updated.v1' as const;

// ── Interop Topics ──
export const TOPIC_AU_INTEROP_WAHIS_EXPORTED = 'au.interop.wahis.exported.v1' as const;
export const TOPIC_AU_INTEROP_EMPRES_FED = 'au.interop.empres.fed.v1' as const;
export const TOPIC_AU_INTEROP_FAOSTAT_SYNCED = 'au.interop.faostat.synced.v1' as const;

// ── Knowledge Hub Topics ──
export const TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED = 'au.knowledge.publication.created.v1' as const;
export const TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED = 'au.knowledge.publication.updated.v1' as const;
export const TOPIC_AU_KNOWLEDGE_PUBLICATION_DELETED = 'au.knowledge.publication.deleted.v1' as const;
export const TOPIC_AU_KNOWLEDGE_ELEARNING_CREATED = 'au.knowledge.elearning.created.v1' as const;
export const TOPIC_AU_KNOWLEDGE_ELEARNING_UPDATED = 'au.knowledge.elearning.updated.v1' as const;
export const TOPIC_AU_KNOWLEDGE_FAQ_CREATED = 'au.knowledge.faq.created.v1' as const;
export const TOPIC_AU_KNOWLEDGE_FAQ_UPDATED = 'au.knowledge.faq.updated.v1' as const;

// ── Formation Topics ──
export const TOPIC_SYS_FORMATION_SESSION_CREATED = 'sys.formation.session.created.v1' as const;
export const TOPIC_SYS_FORMATION_SESSION_UPDATED = 'sys.formation.session.updated.v1' as const;
export const TOPIC_SYS_FORMATION_PARTICIPANT_ENROLLED = 'sys.formation.participant.enrolled.v1' as const;
export const TOPIC_SYS_FORMATION_CERTIFICATION_ISSUED = 'sys.formation.certification.issued.v1' as const;

// ── Support Topics ──
export const TOPIC_SYS_SUPPORT_TICKET_CREATED = 'sys.support.ticket.created.v1' as const;
export const TOPIC_SYS_SUPPORT_TICKET_UPDATED = 'sys.support.ticket.updated.v1' as const;
export const TOPIC_SYS_SUPPORT_TICKET_CLOSED = 'sys.support.ticket.closed.v1' as const;
export const TOPIC_SYS_SUPPORT_TICKET_ASSIGNED = 'sys.support.ticket.assigned.v1' as const;
export const TOPIC_SYS_SUPPORT_TICKET_ESCALATED = 'sys.support.ticket.escalated.v1' as const;
export const TOPIC_SYS_SUPPORT_SLA_BREACHED = 'sys.support.sla.breached.v1' as const;

// ── Analytics Topics ──
export const TOPIC_AU_ANALYTICS_METRIC_CALCULATED = 'au.analytics.metric.calculated.v1' as const;
export const TOPIC_AU_ANALYTICS_AGGREGATION_COMPLETED = 'au.analytics.aggregation.completed.v1' as const;

// ── Interop V2 Topics ──
export const TOPIC_AU_INTEROP_DHIS2_SYNCED = 'au.interop.dhis2.synced.v1' as const;
export const TOPIC_AU_INTEROP_FHIR_SYNCED = 'au.interop.fhir.synced.v1' as const;
export const TOPIC_AU_INTEROP_OMS_SYNCED = 'au.interop.oms.synced.v1' as const;
export const TOPIC_AU_INTEROP_V2_SYNC_REQUESTED = 'au.interop.v2.sync.requested.v1' as const;
export const TOPIC_AU_INTEROP_V2_SYNC_COMPLETED = 'au.interop.v2.sync.completed.v1' as const;
export const TOPIC_AU_INTEROP_V2_SYNC_FAILED = 'au.interop.v2.sync.failed.v1' as const;
export const TOPIC_AU_INTEROP_V2_TRANSACTION_CREATED = 'au.interop.v2.transaction.created.v1' as const;
export const TOPIC_AU_INTEROP_V2_FHIR_RESOURCE_RECEIVED = 'au.interop.v2.fhir.resource.received.v1' as const;

// ── Datalake OLAP Topics ──
export const TOPIC_SYS_DATALAKE_ENTRY_INGESTED = 'sys.datalake.entry.ingested.v1' as const;
export const TOPIC_SYS_DATALAKE_EXPORT_COMPLETED = 'sys.datalake.export.completed.v1' as const;
export const TOPIC_SYS_DATALAKE_EXPORT_FAILED = 'sys.datalake.export.failed.v1' as const;
export const TOPIC_SYS_DATALAKE_PARTITION_ARCHIVED = 'sys.datalake.partition.archived.v1' as const;

// ── Offline Sync Topics ──
export const TOPIC_SYS_OFFLINE_SYNC_INITIATED = 'sys.offline.sync.initiated.v1' as const;
export const TOPIC_SYS_OFFLINE_SYNC_PUSHED = 'sys.offline.sync.pushed.v1' as const;
export const TOPIC_SYS_OFFLINE_SYNC_CONFLICT = 'sys.offline.sync.conflict.v1' as const;
export const TOPIC_SYS_OFFLINE_SYNC_RESOLVED = 'sys.offline.sync.resolved.v1' as const;
export const TOPIC_SYS_OFFLINE_SYNC_COMPLETED = 'sys.offline.sync.completed.v1' as const;

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
  TOPIC_AU_QUALITY_VALIDATION_REQUESTED,
  TOPIC_MS_COLLECTE_CAMPAIGN_CREATED,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_MS_COLLECTE_FORM_SYNCED,
  TOPIC_MS_COLLECTE_SUBMISSION_QUALITY_COMPLETED,
  TOPIC_MS_COLLECTE_SUBMISSION_WORKFLOW_CREATED,
  TOPIC_MS_FORMBUILDER_TEMPLATE_CREATED,
  TOPIC_MS_FORMBUILDER_TEMPLATE_PUBLISHED,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_WORKFLOW_VALIDATION_ESCALATED,
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
  TOPIC_AU_WORKFLOW_INSTANCE_REQUESTED,
  TOPIC_AU_WORKFLOW_INSTANCE_CREATED,
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_UPDATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
  TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
  TOPIC_MS_HEALTH_ENTITY_FLAGS_UPDATED,
  TOPIC_AU_INTEROP_WAHIS_EXPORTED,
  TOPIC_AU_INTEROP_EMPRES_FED,
  TOPIC_AU_INTEROP_FAOSTAT_SYNCED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_DELETED,
  TOPIC_AU_KNOWLEDGE_ELEARNING_CREATED,
  TOPIC_AU_KNOWLEDGE_ELEARNING_UPDATED,
  TOPIC_AU_KNOWLEDGE_FAQ_CREATED,
  TOPIC_AU_KNOWLEDGE_FAQ_UPDATED,
  TOPIC_SYS_FORMATION_SESSION_CREATED,
  TOPIC_SYS_FORMATION_SESSION_UPDATED,
  TOPIC_SYS_FORMATION_PARTICIPANT_ENROLLED,
  TOPIC_SYS_FORMATION_CERTIFICATION_ISSUED,
  TOPIC_SYS_SUPPORT_TICKET_CREATED,
  TOPIC_SYS_SUPPORT_TICKET_UPDATED,
  TOPIC_SYS_SUPPORT_TICKET_CLOSED,
  TOPIC_SYS_SUPPORT_TICKET_ASSIGNED,
  TOPIC_SYS_SUPPORT_TICKET_ESCALATED,
  TOPIC_SYS_SUPPORT_SLA_BREACHED,
  TOPIC_AU_ANALYTICS_METRIC_CALCULATED,
  TOPIC_AU_ANALYTICS_AGGREGATION_COMPLETED,
  TOPIC_AU_INTEROP_DHIS2_SYNCED,
  TOPIC_AU_INTEROP_FHIR_SYNCED,
  TOPIC_AU_INTEROP_OMS_SYNCED,
  TOPIC_AU_INTEROP_V2_SYNC_REQUESTED,
  TOPIC_AU_INTEROP_V2_SYNC_COMPLETED,
  TOPIC_AU_INTEROP_V2_SYNC_FAILED,
  TOPIC_AU_INTEROP_V2_TRANSACTION_CREATED,
  TOPIC_AU_INTEROP_V2_FHIR_RESOURCE_RECEIVED,
  TOPIC_SYS_DATALAKE_ENTRY_INGESTED,
  TOPIC_SYS_DATALAKE_EXPORT_COMPLETED,
  TOPIC_SYS_DATALAKE_EXPORT_FAILED,
  TOPIC_SYS_DATALAKE_PARTITION_ARCHIVED,
  TOPIC_SYS_OFFLINE_SYNC_INITIATED,
  TOPIC_SYS_OFFLINE_SYNC_PUSHED,
  TOPIC_SYS_OFFLINE_SYNC_CONFLICT,
  TOPIC_SYS_OFFLINE_SYNC_RESOLVED,
  TOPIC_SYS_OFFLINE_SYNC_COMPLETED,
  TOPIC_DLQ_ALL,
  TOPIC_DLQ_HEALTH,
  TOPIC_DLQ_COLLECTE,
] as const;

export type TopicName = (typeof ALL_TOPICS)[number];
