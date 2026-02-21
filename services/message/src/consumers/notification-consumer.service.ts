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
import { TemplateEngine } from '../templates/template-engine';
import { PreferencesService } from '../preferences/preferences.service';

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
    private readonly templateEngine: TemplateEngine,
    private readonly preferencesService: PreferencesService,
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

  private async sendToPreferredChannels(
    userId: string,
    tenantId: string,
    eventType: string,
    data: Record<string, unknown>,
    inAppFallbackBody: string,
  ): Promise<void> {
    const channels = await this.preferencesService.getChannelsForEvent(
      userId,
      tenantId,
      eventType,
    );

    if (channels.email) {
      const rendered = this.templateEngine.renderEmail(
        eventType as Parameters<TemplateEngine['renderEmail']>[0],
        data,
      );
      await this.notificationService.send(
        {
          userId,
          channel: NotificationChannel.EMAIL,
          subject: rendered.subject,
          body: rendered.html,
        },
        tenantId,
      );
    }

    if (channels.sms) {
      const smsBody = this.templateEngine.renderSms(
        eventType as Parameters<TemplateEngine['renderSms']>[0],
        data,
      );
      await this.notificationService.send(
        {
          userId,
          channel: NotificationChannel.SMS,
          subject: data['subject'] as string ?? eventType,
          body: smsBody,
        },
        tenantId,
      );
    }

    if (channels.inApp) {
      const subject = this.templateEngine.renderSubject(
        eventType as Parameters<TemplateEngine['renderSubject']>[0],
        data,
      );
      await this.notificationService.send(
        {
          userId,
          channel: NotificationChannel.IN_APP,
          subject,
          body: inAppFallbackBody,
        },
        tenantId,
      );
    }
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

        const templateData: Record<string, unknown> = {
          entityType: data.entityType,
          entityId: data.recordId,
          recordId: data.recordId,
          level: data.level,
          dashboardUrl: process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard',
        };

        await this.sendToPreferredChannels(
          data.submittedBy,
          data.tenantId,
          'WORKFLOW_APPROVED',
          templateData,
          `Your ${data.entityType} submission (${data.recordId}) has been approved at validation level ${data.level}.`,
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

        const templateData: Record<string, unknown> = {
          entityType: data.entityType,
          entityId: data.recordId,
          recordId: data.recordId,
          level: data.level,
          reason: data.reason,
          correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard'}/corrections/${data.recordId}`,
        };

        await this.sendToPreferredChannels(
          data.submittedBy,
          data.tenantId,
          'WORKFLOW_REJECTED',
          templateData,
          `Your ${data.entityType} submission (${data.recordId}) was rejected at level ${data.level}. Reason: ${data.reason}`,
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

        const templateData: Record<string, unknown> = {
          entityType: data.entityType,
          recordId: data.recordId,
          violations: data.violations,
          violationCount: data.violations.length,
          correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard'}/corrections/${data.recordId}`,
        };

        await this.sendToPreferredChannels(
          data.dataStewardId,
          data.tenantId,
          'QUALITY_FAILED',
          templateData,
          `Record ${data.recordId} (${data.entityType}) failed quality gates: ${violationList}. Please review and correct.`,
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

        const templateData: Record<string, unknown> = {
          entityType: data.entityType,
          recordId: data.recordId,
          daysOverdue: data.daysOverdue,
          deadline: new Date().toISOString(),
          correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard'}/corrections/${data.recordId}`,
        };

        // Notify data steward
        await this.sendToPreferredChannels(
          data.dataStewardId,
          data.tenantId,
          'CORRECTION_OVERDUE',
          templateData,
          `Record ${data.recordId} (${data.entityType}) correction is ${data.daysOverdue} days overdue. Please take action.`,
        );

        // Escalate to supervisor if provided
        if (data.supervisorId) {
          await this.sendToPreferredChannels(
            data.supervisorId,
            data.tenantId,
            'CORRECTION_OVERDUE',
            { ...templateData, isSupervisorEscalation: true },
            `ESCALATION: Record ${data.recordId} (${data.entityType}) correction is ${data.daysOverdue} days overdue. The assigned data steward has been notified.`,
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

        const templateData: Record<string, unknown> = {
          campaignName: data.templateName,
          formId: data.formId,
          templateName: data.templateName,
          dashboardUrl: `${process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard'}/submissions/${data.formId}`,
        };

        await this.sendToPreferredChannels(
          data.supervisorId,
          data.tenantId,
          'CAMPAIGN_ASSIGNED',
          templateData,
          `A new ${data.templateName} form (${data.formId}) has been submitted and requires your review.`,
        );
      },
    );
  }
}
