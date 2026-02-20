import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
} from '@aris/shared-types';
import { ComplianceService } from './compliance.service';

@Injectable()
export class ComplianceConsumer implements OnModuleInit {
  private readonly logger = new Logger(ComplianceConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly complianceService: ComplianceService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeToSubmissions();
    await this.subscribeToQualityValidated();
    await this.subscribeToQualityRejected();
    this.logger.log('Compliance consumer subscribed to Kafka topics');
  }

  private async subscribeToSubmissions(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: 'data-contract-compliance' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const contractId = data.dataContractId ?? data.data_contract_id;
          if (!contractId) {
            return; // No contract linked to this submission
          }

          const tenantId =
            headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          await this.complianceService.recordSubmission({
            contractId: contractId as string,
            tenantId: tenantId as string,
            recordId: data.id as string,
            eventType: 'form_submitted',
            eventTimestamp: new Date((data.eventTimestamp ?? data.event_timestamp ?? data.createdAt ?? data.created_at) as string),
            submissionTime: new Date((data.submittedAt ?? data.submitted_at ?? Date.now()) as string | number),
          });
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to form submissions',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async subscribeToQualityValidated(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_QUALITY_RECORD_VALIDATED, groupId: 'data-contract-quality-validated' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const contractId = data.dataContractId ?? data.data_contract_id;
          if (!contractId) {
            return;
          }

          const tenantId =
            headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          await this.complianceService.recordQualityResult({
            contractId: contractId as string,
            tenantId: tenantId as string,
            recordId: (data.recordId ?? data.record_id) as string,
            passed: true,
            qualityReportId: (data.reportId ?? data.report_id ?? data.id) as string,
          });
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to quality validated',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async subscribeToQualityRejected(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_QUALITY_RECORD_REJECTED, groupId: 'data-contract-quality-rejected' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const contractId = data.dataContractId ?? data.data_contract_id;
          if (!contractId) {
            return;
          }

          const tenantId =
            headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          await this.complianceService.recordQualityResult({
            contractId: contractId as string,
            tenantId: tenantId as string,
            recordId: (data.recordId ?? data.record_id) as string,
            passed: false,
            qualityReportId: (data.reportId ?? data.report_id ?? data.id) as string,
          });
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to quality rejected',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
