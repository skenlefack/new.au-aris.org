import type { StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
} from '@aris/shared-types';
import type { ComplianceService } from './compliance.service';

const GROUP_PREFIX = 'data-contract-compliance';

/**
 * Registers Kafka consumers for compliance tracking events.
 * Subscribes to form submissions and quality gate results.
 */
export async function registerComplianceConsumers(
  consumer: StandaloneKafkaConsumer,
  complianceService: ComplianceService,
): Promise<void> {
  // Subscribe to form submissions
  try {
    await consumer.subscribe(
      { topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: GROUP_PREFIX },
      async (payload, headers) => {
        const data = payload as Record<string, unknown> | null;
        if (!data) return;

        const contractId = data.dataContractId ?? data.data_contract_id;
        if (!contractId) {
          return; // No contract linked to this submission
        }

        const tenantId =
          headers['tenantId'] ??
          (data.tenantId as string | undefined) ??
          (data.tenant_id as string | undefined);

        await complianceService.recordSubmission({
          contractId: contractId as string,
          tenantId: tenantId as string,
          recordId: data.id as string,
          eventType: 'form_submitted',
          eventTimestamp: new Date(
            (data.eventTimestamp ?? data.event_timestamp ?? data.createdAt ?? data.created_at) as string,
          ),
          submissionTime: new Date(
            (data.submittedAt ?? data.submitted_at ?? Date.now()) as string | number,
          ),
        });
      },
    );
  } catch (error) {
    console.error(
      '[ComplianceConsumer] Failed to subscribe to form submissions',
      error instanceof Error ? error.stack : String(error),
    );
  }

  // Subscribe to quality validated events
  try {
    await consumer.subscribe(
      { topic: TOPIC_AU_QUALITY_RECORD_VALIDATED, groupId: `${GROUP_PREFIX}-quality-validated` },
      async (payload, headers) => {
        const data = payload as Record<string, unknown> | null;
        if (!data) return;

        const contractId = data.dataContractId ?? data.data_contract_id;
        if (!contractId) {
          return;
        }

        const tenantId =
          headers['tenantId'] ??
          (data.tenantId as string | undefined) ??
          (data.tenant_id as string | undefined);

        await complianceService.recordQualityResult({
          contractId: contractId as string,
          tenantId: tenantId as string,
          recordId: (data.recordId ?? data.record_id) as string,
          passed: true,
          qualityReportId: (data.reportId ?? data.report_id ?? data.id) as string,
        });
      },
    );
  } catch (error) {
    console.error(
      '[ComplianceConsumer] Failed to subscribe to quality validated',
      error instanceof Error ? error.stack : String(error),
    );
  }

  // Subscribe to quality rejected events
  try {
    await consumer.subscribe(
      { topic: TOPIC_AU_QUALITY_RECORD_REJECTED, groupId: `${GROUP_PREFIX}-quality-rejected` },
      async (payload, headers) => {
        const data = payload as Record<string, unknown> | null;
        if (!data) return;

        const contractId = data.dataContractId ?? data.data_contract_id;
        if (!contractId) {
          return;
        }

        const tenantId =
          headers['tenantId'] ??
          (data.tenantId as string | undefined) ??
          (data.tenant_id as string | undefined);

        await complianceService.recordQualityResult({
          contractId: contractId as string,
          tenantId: tenantId as string,
          recordId: (data.recordId ?? data.record_id) as string,
          passed: false,
          qualityReportId: (data.reportId ?? data.report_id ?? data.id) as string,
        });
      },
    );
  } catch (error) {
    console.error(
      '[ComplianceConsumer] Failed to subscribe to quality rejected',
      error instanceof Error ? error.stack : String(error),
    );
  }

  console.log('[ComplianceConsumer] Subscribed to compliance Kafka topics');
}
