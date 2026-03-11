/**
 * ARIS 4.0 — Centralized Event Catalog
 *
 * Every inter-service event in the system is declared here with its topic name.
 * Services import from this catalog rather than using string literals.
 *
 * Naming convention: {scope}.{domain}.{entity}.{action}.v{version}
 * Scopes: sys (system/platform), ms (member-state), rec (regional), au (continental)
 */

export const EVENTS = {
  // ── Credential / Auth ──
  CREDENTIAL: {
    USER_CREATED: 'sys.credential.user.created.v1',
    USER_UPDATED: 'sys.credential.user.updated.v1',
    USER_AUTHENTICATED: 'sys.credential.user.authenticated.v1',
    USER_DEACTIVATED: 'sys.credential.user.deactivated.v1',
    PASSWORD_CHANGED: 'sys.credential.password.changed.v1',
    MFA_ENABLED: 'sys.credential.mfa.enabled.v1',
  },

  // ── Tenant ──
  TENANT: {
    CREATED: 'sys.tenant.created.v1',
    UPDATED: 'sys.tenant.updated.v1',
    CONFIG_CHANGED: 'sys.tenant.config.changed.v1',
  },

  // ── Message / Notifications ──
  MESSAGE: {
    NOTIFICATION_QUEUED: 'sys.message.notification.queued.v1',
    NOTIFICATION_SENT: 'sys.message.notification.sent.v1',
    NOTIFICATION_FAILED: 'sys.message.notification.failed.v1',
    EMAIL_SENT: 'sys.message.email.sent.v1',
    SMS_SENT: 'sys.message.sms.sent.v1',
    PUSH_SENT: 'sys.message.push.sent.v1',
  },

  // ── Drive / Documents ──
  DRIVE: {
    FILE_UPLOADED: 'sys.drive.file.uploaded.v1',
    FILE_DELETED: 'sys.drive.file.deleted.v1',
  },

  // ── Master Data ──
  MASTER_DATA: {
    GEO_UPDATED: 'sys.master.geo.updated.v1',
    SPECIES_CREATED: 'sys.master.species.created.v1',
    SPECIES_UPDATED: 'sys.master.species.updated.v1',
    DISEASE_CREATED: 'sys.master.disease.created.v1',
    DISEASE_UPDATED: 'sys.master.disease.updated.v1',
    DENOMINATOR_UPDATED: 'sys.master.denominator.updated.v1',
  },

  // ── Data Quality ──
  QUALITY: {
    RECORD_VALIDATED: 'au.quality.record.validated.v1',
    RECORD_REJECTED: 'au.quality.record.rejected.v1',
    CORRECTION_OVERDUE: 'au.quality.correction.overdue.v1',
    /** New: request validation asynchronously (replaces REST call) */
    VALIDATION_REQUESTED: 'au.quality.validation.requested.v1',
  },

  // ── Collecte ──
  COLLECTE: {
    CAMPAIGN_CREATED: 'ms.collecte.campaign.created.v1',
    FORM_SUBMITTED: 'ms.collecte.form.submitted.v1',
    FORM_SYNCED: 'ms.collecte.form.synced.v1',
    /** New: update submission status after async quality/workflow processing */
    SUBMISSION_QUALITY_COMPLETED: 'ms.collecte.submission.quality-completed.v1',
    SUBMISSION_WORKFLOW_CREATED: 'ms.collecte.submission.workflow-created.v1',
  },

  // ── Form Builder ──
  FORM_BUILDER: {
    TEMPLATE_CREATED: 'ms.formbuilder.template.created.v1',
    TEMPLATE_PUBLISHED: 'ms.formbuilder.template.published.v1',
  },

  // ── Workflow ──
  WORKFLOW: {
    VALIDATION_SUBMITTED: 'au.workflow.validation.submitted.v1',
    VALIDATION_APPROVED: 'au.workflow.validation.approved.v1',
    VALIDATION_REJECTED: 'au.workflow.validation.rejected.v1',
    VALIDATION_ESCALATED: 'au.workflow.validation.escalated.v1',
    WAHIS_READY: 'au.workflow.wahis.ready.v1',
    ANALYTICS_READY: 'au.workflow.analytics.ready.v1',
    /** New: request workflow creation asynchronously (replaces REST call) */
    INSTANCE_REQUESTED: 'au.workflow.instance.requested.v1',
    INSTANCE_CREATED: 'au.workflow.instance.created.v1',
  },

  // ── Animal Health ──
  HEALTH: {
    EVENT_CREATED: 'ms.health.event.created.v1',
    EVENT_UPDATED: 'ms.health.event.updated.v1',
    EVENT_CONFIRMED: 'ms.health.event.confirmed.v1',
    LAB_RESULT_CREATED: 'ms.health.lab.result.created.v1',
    VACCINATION_COMPLETED: 'ms.health.vaccination.completed.v1',
    SURVEILLANCE_REPORTED: 'ms.health.surveillance.reported.v1',
    OUTBREAK_ALERT: 'rec.health.outbreak.alert.v1',
    /** New: entity flag patched via event (replaces REST callback) */
    ENTITY_FLAGS_UPDATED: 'ms.health.entity.flags-updated.v1',
  },

  // ── Livestock Production ──
  LIVESTOCK: {
    CENSUS_CREATED: 'ms.livestock.census.created.v1',
    CENSUS_UPDATED: 'ms.livestock.census.updated.v1',
    PRODUCTION_CREATED: 'ms.livestock.production.created.v1',
    TRANSHUMANCE_CREATED: 'ms.livestock.transhumance.created.v1',
  },

  // ── Fisheries ──
  FISHERIES: {
    CAPTURE_CREATED: 'ms.fisheries.capture.created.v1',
    VESSEL_REGISTERED: 'ms.fisheries.vessel.registered.v1',
    AQUACULTURE_CREATED: 'ms.fisheries.aquaculture.created.v1',
  },

  // ── Wildlife ──
  WILDLIFE: {
    INVENTORY_CREATED: 'ms.wildlife.inventory.created.v1',
    CITES_PERMIT_CREATED: 'ms.wildlife.cites-permit.created.v1',
    CRIME_REPORTED: 'ms.wildlife.crime.reported.v1',
  },

  // ── Apiculture ──
  APICULTURE: {
    APIARY_CREATED: 'ms.apiculture.apiary.created.v1',
    PRODUCTION_CREATED: 'ms.apiculture.production.created.v1',
    COLONY_HEALTH_REPORTED: 'ms.apiculture.colony-health.reported.v1',
  },

  // ── Trade & SPS ──
  TRADE: {
    FLOW_CREATED: 'ms.trade.flow.created.v1',
    SPS_CERTIFICATE_CREATED: 'ms.trade.sps-certificate.created.v1',
    MARKET_PRICE_UPDATED: 'ms.trade.market-price.updated.v1',
  },

  // ── Governance ──
  GOVERNANCE: {
    LEGAL_FRAMEWORK_CREATED: 'ms.governance.legal-framework.created.v1',
    PVS_EVALUATION_CREATED: 'ms.governance.pvs-evaluation.created.v1',
    CAPACITY_UPDATED: 'ms.governance.capacity.updated.v1',
  },

  // ── Climate & Environment ──
  CLIMATE: {
    WATER_STRESS_CREATED: 'ms.climate.water-stress.created.v1',
    RANGELAND_UPDATED: 'ms.climate.rangeland.updated.v1',
    HOTSPOT_DETECTED: 'ms.climate.hotspot.detected.v1',
  },

  // ── Interop Hub ──
  INTEROP: {
    WAHIS_EXPORTED: 'au.interop.wahis.exported.v1',
    EMPRES_FED: 'au.interop.empres.fed.v1',
    FAOSTAT_SYNCED: 'au.interop.faostat.synced.v1',
  },

  // ── Analytics ──
  ANALYTICS: {
    AGGREGATION_COMPLETED: 'au.analytics.aggregation.completed.v1',
    REPORT_GENERATED: 'au.analytics.report.generated.v1',
  },

  // ── Knowledge Hub ──
  KNOWLEDGE: {
    PUBLICATION_CREATED: 'au.knowledge.publication.created.v1',
    PUBLICATION_UPDATED: 'au.knowledge.publication.updated.v1',
    PUBLICATION_DELETED: 'au.knowledge.publication.deleted.v1',
    ELEARNING_CREATED: 'au.knowledge.elearning.created.v1',
    ELEARNING_UPDATED: 'au.knowledge.elearning.updated.v1',
    FAQ_CREATED: 'au.knowledge.faq.created.v1',
    FAQ_UPDATED: 'au.knowledge.faq.updated.v1',
  },

  // ── DLQ ──
  DLQ: {
    ALL: 'dlq.all.v1',
    HEALTH: 'dlq.health.v1',
    COLLECTE: 'dlq.collecte.v1',
    WORKFLOW: 'dlq.workflow.v1',
  },
} as const;

/** Flattened list of all event topic names */
export const ALL_EVENT_TOPICS = Object.values(EVENTS).flatMap((domain) =>
  Object.values(domain),
);

/** Type for any event topic in the catalog */
export type EventTopic = (typeof ALL_EVENT_TOPICS)[number];
