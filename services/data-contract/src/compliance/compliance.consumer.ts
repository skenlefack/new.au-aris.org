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
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        'data-contract-compliance',
        async (message) => {
          const payload = JSON.parse(message.value?.toString() ?? '{}');
          const headers = message.headers ?? {};

          const contractId = payload.dataContractId ?? payload.data_contract_id;
          if (!contractId) {
            return; // No contract linked to this submission
          }

          const tenantId =
            headers['tenantId']?.toString() ?? payload.tenantId ?? payload.tenant_id;

          await this.complianceService.recordSubmission({
            contractId,
            tenantId,
            recordId: payload.id,
            eventType: 'form_submitted',
            eventTimestamp: new Date(payload.eventTimestamp ?? payload.event_timestamp ?? payload.createdAt ?? payload.created_at),
            submissionTime: new Date(payload.submittedAt ?? payload.submitted_at ?? Date.now()),
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
        TOPIC_AU_QUALITY_RECORD_VALIDATED,
        'data-contract-quality-validated',
        async (message) => {
          const payload = JSON.parse(message.value?.toString() ?? '{}');
          const headers = message.headers ?? {};

          const contractId = payload.dataContractId ?? payload.data_contract_id;
          if (!contractId) {
            return;
          }

          const tenantId =
            headers['tenantId']?.toString() ?? payload.tenantId ?? payload.tenant_id;

          await this.complianceService.recordQualityResult({
            contractId,
            tenantId,
            recordId: payload.recordId ?? payload.record_id,
            passed: true,
            qualityReportId: payload.reportId ?? payload.report_id ?? payload.id,
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
        TOPIC_AU_QUALITY_RECORD_REJECTED,
        'data-contract-quality-rejected',
        async (message) => {
          const payload = JSON.parse(message.value?.toString() ?? '{}');
          const headers = message.headers ?? {};

          const contractId = payload.dataContractId ?? payload.data_contract_id;
          if (!contractId) {
            return;
          }

          const tenantId =
            headers['tenantId']?.toString() ?? payload.tenantId ?? payload.tenant_id;

          await this.complianceService.recordQualityResult({
            contractId,
            tenantId,
            recordId: payload.recordId ?? payload.record_id,
            passed: false,
            qualityReportId: payload.reportId ?? payload.report_id ?? payload.id,
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
