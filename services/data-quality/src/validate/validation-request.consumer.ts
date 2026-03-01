import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventConsumer, EVENTS } from '@aris/kafka-client';
import type { QualityValidationRequestedEvent } from '@aris/kafka-client';
import { ValidateService } from './validate.service';

/**
 * Kafka consumer that handles asynchronous quality validation requests.
 *
 * Replaces the synchronous REST POST /api/v1/data-quality/validate endpoint
 * for inter-service calls. The REST endpoint remains available for external
 * clients (admin panel, testing).
 *
 * Flow:
 * 1. collecte-service publishes QUALITY.VALIDATION_REQUESTED
 * 2. This consumer picks it up and runs quality gates
 * 3. ValidateService publishes QUALITY.RECORD_VALIDATED or QUALITY.RECORD_REJECTED
 * 4. collecte-service consumes those to update submission status
 */
@Injectable()
export class ValidationRequestConsumer implements OnModuleInit {
  private readonly logger = new Logger(ValidationRequestConsumer.name);

  constructor(
    private readonly eventConsumer: EventConsumer,
    private readonly validateService: ValidateService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.eventConsumer.subscribe<QualityValidationRequestedEvent>({
        topic: EVENTS.QUALITY.VALIDATION_REQUESTED,
        groupId: 'data-quality-validation-request-consumer',
        handler: async (event) => {
          await this.handleValidationRequest(event);
        },
      });
      this.logger.log(
        `Subscribed to ${EVENTS.QUALITY.VALIDATION_REQUESTED}`,
      );
    } catch (error) {
      this.logger.warn(
        `Kafka consumer not available — async validation disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleValidationRequest(
    event: QualityValidationRequestedEvent,
  ): Promise<void> {
    const { recordId, entityType, domain, record } = event.payload;

    this.logger.log(
      `Processing validation request for ${domain}/${entityType} record=${recordId}`,
    );

    // Build a synthetic AuthenticatedUser from the event metadata
    const user = {
      userId: event.userId ?? '00000000-0000-0000-0000-000000000000',
      tenantId: event.tenantId ?? '',
      role: 'SYSTEM' as const,
      tenantLevel: 'CONTINENTAL' as const,
      email: 'system@au-aris.org',
    };

    try {
      // Reuse the existing ValidateService.validate() method.
      // It already persists the report and publishes the result event.
      await this.validateService.validate(
        {
          recordId,
          entityType,
          domain,
          record,
          ...(event.payload.requiredFields && { requiredFields: event.payload.requiredFields }),
          ...(event.payload.temporalPairs && { temporalPairs: event.payload.temporalPairs }),
          ...(event.payload.geoFields && { geoFields: event.payload.geoFields }),
          ...(event.payload.unitFields && { unitFields: event.payload.unitFields }),
          ...(event.payload.auditFields && { auditFields: event.payload.auditFields }),
          ...(event.payload.codeFields && { codeFields: event.payload.codeFields }),
          ...(event.payload.confidenceLevelField && { confidenceLevelField: event.payload.confidenceLevelField }),
          ...(event.payload.confidenceEvidenceFields && { confidenceEvidenceFields: event.payload.confidenceEvidenceFields }),
          ...(event.payload.dedupFields && { dedupFields: event.payload.dedupFields }),
          ...(event.payload.dataContractId && { dataContractId: event.payload.dataContractId }),
        },
        user as never,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process validation request for record ${recordId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
