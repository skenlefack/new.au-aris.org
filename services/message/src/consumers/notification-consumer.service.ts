import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  NotificationChannel,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
} from '@aris/shared-types';
import { NotificationService } from '../notification/notification.service';

const GROUP_ID = 'message-service-notifications';

interface WorkflowApprovedPayload {
  recordId: string;
  entityType: string;
  submittedBy: string;
  tenantId: string;
  level: number;
}

interface WorkflowRejectedPayload {
  recordId: string;
  entityType: string;
  submittedBy: string;
  tenantId: string;
  level: number;
  reason: string;
}

interface QualityRejectedPayload {
  recordId: string;
  entityType: string;
  dataStewardId: string;
  tenantId: string;
  violations: string[];
}

interface CorrectionOverduePayload {
  recordId: string;
  entityType: string;
  dataStewardId: string;
  supervisorId?: string;
  tenantId: string;
  daysOverdue: number;
}

interface FormSubmittedPayload {
  formId: string;
  templateId: string;
  submittedBy: string;
  supervisorId: string;
  tenantId: string;
  templateName: string;
}

@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumerService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeAll();
  }

  async subscribeAll(): Promise<void> {
    await Promise.all([
      this.subscribeWorkflowApproved(),
      this.subscribeWorkflowRejected(),
      this.subscribeQualityRejected(),
      this.subscribeCorrectionOverdue(),
      this.subscribeFormSubmitted(),
    ]);
    this.logger.log('All notification consumers subscribed');
  }

  private async subscribeWorkflowApproved(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      {
        topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
        groupId: GROUP_ID,
      },
      async (payload) => {
        const data = payload as WorkflowApprovedPayload;
        this.logger.debug(`Workflow approved: ${data.recordId}`);

        await this.notificationService.send(
          {
            userId: data.submittedBy,
            channel: NotificationChannel.IN_APP,
            subject: 'Submission Approved',
            body: `Your ${data.entityType} submission (${data.recordId}) has been approved at validation level ${data.level}.`,
          },
          data.tenantId,
        );

        await this.notificationService.send(
          {
            userId: data.submittedBy,
            channel: NotificationChannel.EMAIL,
            subject: `[ARIS] Submission Approved — ${data.entityType}`,
            body: `<p>Your <strong>${data.entityType}</strong> submission (<code>${data.recordId}</code>) has been approved at validation level ${data.level}.</p>`,
          },
          data.tenantId,
        );
      },
    );
  }

  private async subscribeWorkflowRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      {
        topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
        groupId: GROUP_ID,
      },
      async (payload) => {
        const data = payload as WorkflowRejectedPayload;
        this.logger.debug(`Workflow rejected: ${data.recordId}`);

        await this.notificationService.send(
          {
            userId: data.submittedBy,
            channel: NotificationChannel.IN_APP,
            subject: 'Submission Rejected',
            body: `Your ${data.entityType} submission (${data.recordId}) was rejected at level ${data.level}. Reason: ${data.reason}`,
          },
          data.tenantId,
        );

        await this.notificationService.send(
          {
            userId: data.submittedBy,
            channel: NotificationChannel.EMAIL,
            subject: `[ARIS] Submission Rejected — ${data.entityType}`,
            body: `<p>Your <strong>${data.entityType}</strong> submission (<code>${data.recordId}</code>) was rejected at validation level ${data.level}.</p><p><strong>Reason:</strong> ${data.reason}</p>`,
          },
          data.tenantId,
        );
      },
    );
  }

  private async subscribeQualityRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      {
        topic: TOPIC_AU_QUALITY_RECORD_REJECTED,
        groupId: GROUP_ID,
      },
      async (payload) => {
        const data = payload as QualityRejectedPayload;
        this.logger.debug(`Quality rejected: ${data.recordId}`);

        const violationList = data.violations.join(', ');

        await this.notificationService.send(
          {
            userId: data.dataStewardId,
            channel: NotificationChannel.IN_APP,
            subject: 'Data Quality Rejection',
            body: `Record ${data.recordId} (${data.entityType}) failed quality gates: ${violationList}. Please review and correct.`,
          },
          data.tenantId,
        );

        await this.notificationService.send(
          {
            userId: data.dataStewardId,
            channel: NotificationChannel.EMAIL,
            subject: `[ARIS] Quality Gate Failure — ${data.entityType}`,
            body: `<p>Record <code>${data.recordId}</code> (<strong>${data.entityType}</strong>) failed quality gates:</p><ul>${data.violations.map((v) => `<li>${v}</li>`).join('')}</ul><p>Please review and correct.</p>`,
          },
          data.tenantId,
        );
      },
    );
  }

  private async subscribeCorrectionOverdue(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      {
        topic: TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
        groupId: GROUP_ID,
      },
      async (payload) => {
        const data = payload as CorrectionOverduePayload;
        this.logger.debug(`Correction overdue: ${data.recordId}`);

        // Notify data steward
        await this.notificationService.send(
          {
            userId: data.dataStewardId,
            channel: NotificationChannel.IN_APP,
            subject: 'Overdue Correction',
            body: `Record ${data.recordId} (${data.entityType}) correction is ${data.daysOverdue} days overdue. Please take action.`,
          },
          data.tenantId,
        );

        // Escalation email
        await this.notificationService.send(
          {
            userId: data.dataStewardId,
            channel: NotificationChannel.EMAIL,
            subject: `[ARIS] ESCALATION — Overdue Correction (${data.daysOverdue} days)`,
            body: `<p><strong>Escalation:</strong> Record <code>${data.recordId}</code> (<strong>${data.entityType}</strong>) correction is <strong>${data.daysOverdue} days overdue</strong>.</p><p>Please take immediate action.</p>`,
          },
          data.tenantId,
        );

        // Notify supervisor if provided
        if (data.supervisorId) {
          await this.notificationService.send(
            {
              userId: data.supervisorId,
              channel: NotificationChannel.EMAIL,
              subject: `[ARIS] ESCALATION — Overdue Correction (${data.daysOverdue} days)`,
              body: `<p><strong>Escalation:</strong> Record <code>${data.recordId}</code> (<strong>${data.entityType}</strong>) correction is <strong>${data.daysOverdue} days overdue</strong>. The assigned data steward has been notified.</p>`,
            },
            data.tenantId,
          );
        }
      },
    );
  }

  private async subscribeFormSubmitted(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      {
        topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        groupId: GROUP_ID,
      },
      async (payload) => {
        const data = payload as FormSubmittedPayload;
        this.logger.debug(`Form submitted: ${data.formId}`);

        await this.notificationService.send(
          {
            userId: data.supervisorId,
            channel: NotificationChannel.IN_APP,
            subject: 'New Form Submission',
            body: `A new ${data.templateName} form (${data.formId}) has been submitted and requires your review.`,
          },
          data.tenantId,
        );

        await this.notificationService.send(
          {
            userId: data.supervisorId,
            channel: NotificationChannel.EMAIL,
            subject: `[ARIS] New Submission — ${data.templateName}`,
            body: `<p>A new <strong>${data.templateName}</strong> form (<code>${data.formId}</code>) has been submitted and requires your review.</p>`,
          },
          data.tenantId,
        );
      },
    );
  }
}
