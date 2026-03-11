import type { FastifyInstance } from 'fastify';
import type { AggregationService } from '../services/aggregation.service';
import type { HealthEventPayload, VaccinationPayload, LabResultPayload, QualityRecordPayload, WorkflowApprovedPayload } from '../services/aggregation.service';
import type { DomainAggregationService } from '../services/domain-aggregation.service';
import type { LivestockCensusPayload, FishCapturePayload, WildlifeCrimePayload, TradeFlowPayload, ClimateHotspotPayload, ApicultureProductionPayload, GovernancePvsPayload } from '../dto/cross-domain.dto';
import {
  TOPIC_MS_LIVESTOCK_CENSUS_CREATED,
  TOPIC_MS_FISHERIES_CAPTURE_RECORDED,
  TOPIC_MS_WILDLIFE_CRIME_REPORTED,
  TOPIC_MS_TRADE_FLOW_CREATED,
  TOPIC_MS_CLIMATE_HOTSPOT_DETECTED,
  TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
  TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
} from '../dto/cross-domain.dto';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
} from '@aris/shared-types';

const CONSUMER_GROUP = 'analytics-aggregator';

export async function registerConsumers(
  app: FastifyInstance,
  aggregation: AggregationService,
  domainAggregation: DomainAggregationService,
): Promise<void> {
  // ── Health Event Created ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_HEALTH_EVENT_CREATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleHealthEventCreated(payload as HealthEventPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_HEALTH_EVENT_CREATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_HEALTH_EVENT_CREATED}: ${err}`);
  }

  // ── Health Event Confirmed ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_HEALTH_EVENT_CONFIRMED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleHealthEventConfirmed(payload as HealthEventPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_HEALTH_EVENT_CONFIRMED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_HEALTH_EVENT_CONFIRMED}: ${err}`);
  }

  // ── Vaccination Completed ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_HEALTH_VACCINATION_COMPLETED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleVaccinationCompleted(payload as VaccinationPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_HEALTH_VACCINATION_COMPLETED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_HEALTH_VACCINATION_COMPLETED}: ${err}`);
  }

  // ── Lab Result Created ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_HEALTH_LAB_RESULT_CREATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleLabResultCreated(payload as LabResultPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_HEALTH_LAB_RESULT_CREATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_HEALTH_LAB_RESULT_CREATED}: ${err}`);
  }

  // ── Quality Validated ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_AU_QUALITY_RECORD_VALIDATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleQualityValidated(payload as QualityRecordPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_AU_QUALITY_RECORD_VALIDATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_AU_QUALITY_RECORD_VALIDATED}: ${err}`);
  }

  // ── Quality Rejected ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_AU_QUALITY_RECORD_REJECTED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleQualityRejected(payload as QualityRecordPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_AU_QUALITY_RECORD_REJECTED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_AU_QUALITY_RECORD_REJECTED}: ${err}`);
  }

  // ── Workflow Approved ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await aggregation.handleWorkflowApproved(payload as WorkflowApprovedPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_AU_WORKFLOW_VALIDATION_APPROVED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_AU_WORKFLOW_VALIDATION_APPROVED}: ${err}`);
  }

  // ── Livestock Census Created ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_LIVESTOCK_CENSUS_CREATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleLivestockCensusCreated(payload as LivestockCensusPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_LIVESTOCK_CENSUS_CREATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_LIVESTOCK_CENSUS_CREATED}: ${err}`);
  }

  // ── Fisheries Capture Recorded ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_FISHERIES_CAPTURE_RECORDED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleFishCaptureRecorded(payload as FishCapturePayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_FISHERIES_CAPTURE_RECORDED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_FISHERIES_CAPTURE_RECORDED}: ${err}`);
  }

  // ── Wildlife Crime Reported ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_WILDLIFE_CRIME_REPORTED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleWildlifeCrimeReported(payload as WildlifeCrimePayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_WILDLIFE_CRIME_REPORTED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_WILDLIFE_CRIME_REPORTED}: ${err}`);
  }

  // ── Trade Flow Created ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_TRADE_FLOW_CREATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleTradeFlowCreated(payload as TradeFlowPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_TRADE_FLOW_CREATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_TRADE_FLOW_CREATED}: ${err}`);
  }

  // ── Climate Hotspot Detected ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_CLIMATE_HOTSPOT_DETECTED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleClimateHotspotDetected(payload as ClimateHotspotPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_CLIMATE_HOTSPOT_DETECTED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_CLIMATE_HOTSPOT_DETECTED}: ${err}`);
  }

  // ── Apiculture Production Recorded ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_APICULTURE_PRODUCTION_RECORDED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleApicultureProductionRecorded(payload as ApicultureProductionPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_APICULTURE_PRODUCTION_RECORDED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_APICULTURE_PRODUCTION_RECORDED}: ${err}`);
  }

  // ── Governance PVS Evaluated ──
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_MS_GOVERNANCE_PVS_EVALUATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await domainAggregation.handleGovernancePvsEvaluated(payload as GovernancePvsPayload);
      },
    );
    app.log.info(`Subscribed to ${TOPIC_MS_GOVERNANCE_PVS_EVALUATED}`);
  } catch (err) {
    app.log.warn(`Failed to subscribe to ${TOPIC_MS_GOVERNANCE_PVS_EVALUATED}: ${err}`);
  }
}
