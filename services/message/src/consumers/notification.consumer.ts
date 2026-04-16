import type { StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  NotificationChannel,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_SYS_CREDENTIAL_USER_CREATED,
  TOPIC_SYS_CREDENTIAL_PASSWORD_RESET,
  TOPIC_SYS_CREDENTIAL_NEW_DEVICE_LOGIN,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_SUBMITTED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_APPROVED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_REJECTED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_PUBLISHED,
  TOPIC_AU_KNOWLEDGE_CATEGORY_SUBMITTED,
  TOPIC_AU_KNOWLEDGE_CATEGORY_APPROVED,
  TOPIC_AU_KNOWLEDGE_CATEGORY_REJECTED,
} from '@aris/shared-types';
import type { PrismaClient } from '@prisma/client';
import type { NotificationService } from '../services/notification.service';
import type { TemplateEngine } from '../services/template-engine';
import type { PreferencesService } from '../services/preferences.service';
import type { MessageChannel } from '../services/channel.interface';

const GROUP_ID = 'message-service-notifications';

export class NotificationConsumer {
  constructor(
    private readonly kafkaConsumer: StandaloneKafkaConsumer,
    private readonly notificationService: NotificationService,
    private readonly templateEngine: TemplateEngine,
    private readonly preferencesService: PreferencesService,
    private readonly emailChannel?: MessageChannel,
    private readonly prisma?: PrismaClient,
  ) {}

  async start(): Promise<void> {
    await Promise.all([
      this.subscribeWorkflowApproved(),
      this.subscribeWorkflowRejected(),
      this.subscribeQualityRejected(),
      this.subscribeCorrectionOverdue(),
      this.subscribeFormSubmitted(),
      this.subscribeUserCreated(),
      this.subscribePasswordReset(),
      this.subscribeNewDeviceLogin(),
      this.subscribeKnowledgeSubmitted(),
      this.subscribeKnowledgeApproved(),
      this.subscribeKnowledgeRejected(),
      this.subscribeKnowledgePublished(),
      this.subscribeKnowledgeCategorySubmitted(),
      this.subscribeKnowledgeCategoryApproved(),
      this.subscribeKnowledgeCategoryRejected(),
    ]);
    console.log('All notification consumers subscribed');
  }

  async stop(): Promise<void> {
    await this.kafkaConsumer.disconnectAll();
  }

  private async sendToPreferredChannels(
    userId: string,
    tenantId: string,
    eventType: string,
    data: Record<string, unknown>,
    inAppFallbackBody: string,
  ): Promise<void> {
    const channels = await this.preferencesService.getChannelsForEvent(userId, tenantId, eventType);

    if (channels.email) {
      const rendered = this.templateEngine.renderEmail(eventType as any, data);
      await this.notificationService.send(
        { userId, channel: NotificationChannel.EMAIL, subject: rendered.subject, body: rendered.html },
        tenantId,
      );
    }

    if (channels.sms) {
      const smsBody = this.templateEngine.renderSms(eventType as any, data);
      await this.notificationService.send(
        { userId, channel: NotificationChannel.SMS, subject: (data['subject'] as string) ?? eventType, body: smsBody },
        tenantId,
      );
    }

    if (channels.inApp) {
      const subject = this.templateEngine.renderSubject(eventType as any, data);
      await this.notificationService.send(
        { userId, channel: NotificationChannel.IN_APP, subject, body: inAppFallbackBody },
        tenantId,
      );
    }

    if (channels.whatsapp) {
      const msgBody = this.templateEngine.renderSms(eventType as any, data);
      await this.notificationService.send(
        { userId, channel: NotificationChannel.WHATSAPP, subject: (data['subject'] as string) ?? eventType, body: msgBody },
        tenantId,
      );
    }

    if (channels.telegram) {
      const msgBody = this.templateEngine.renderSms(eventType as any, data);
      await this.notificationService.send(
        { userId, channel: NotificationChannel.TELEGRAM, subject: (data['subject'] as string) ?? eventType, body: msgBody },
        tenantId,
      );
    }
  }

  private async subscribeWorkflowApproved(): Promise<void> {
    await this.kafkaConsumer.subscribe({ topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: GROUP_ID }, async (payload) => {
      const data = payload as any;
      const templateData = {
        entityType: data.entityType, entityId: data.recordId, recordId: data.recordId,
        level: data.level, dashboardUrl: process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard',
      };
      await this.sendToPreferredChannels(data.submittedBy, data.tenantId, 'WORKFLOW_APPROVED', templateData,
        `Your ${data.entityType} submission (${data.recordId}) has been approved at validation level ${data.level}.`);
    });
  }

  private async subscribeWorkflowRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe({ topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, groupId: GROUP_ID }, async (payload) => {
      const data = payload as any;
      const templateData = {
        entityType: data.entityType, entityId: data.recordId, recordId: data.recordId, level: data.level, reason: data.reason,
        correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/corrections/${data.recordId}`,
      };
      await this.sendToPreferredChannels(data.submittedBy, data.tenantId, 'WORKFLOW_REJECTED', templateData,
        `Your ${data.entityType} submission (${data.recordId}) was rejected at level ${data.level}. Reason: ${data.reason}`);
    });
  }

  private async subscribeQualityRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe({ topic: TOPIC_AU_QUALITY_RECORD_REJECTED, groupId: GROUP_ID }, async (payload) => {
      const data = payload as any;
      const templateData = {
        entityType: data.entityType, recordId: data.recordId, violations: data.violations,
        violationCount: data.violations.length,
        correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/corrections/${data.recordId}`,
      };
      await this.sendToPreferredChannels(data.dataStewardId, data.tenantId, 'QUALITY_FAILED', templateData,
        `Record ${data.recordId} (${data.entityType}) failed quality gates: ${data.violations.join(', ')}. Please review and correct.`);
    });
  }

  private async subscribeCorrectionOverdue(): Promise<void> {
    await this.kafkaConsumer.subscribe({ topic: TOPIC_AU_QUALITY_CORRECTION_OVERDUE, groupId: GROUP_ID }, async (payload) => {
      const data = payload as any;
      const templateData = {
        entityType: data.entityType, recordId: data.recordId, daysOverdue: data.daysOverdue,
        deadline: new Date().toISOString(),
        correctionUrl: `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/corrections/${data.recordId}`,
      };
      await this.sendToPreferredChannels(data.dataStewardId, data.tenantId, 'CORRECTION_OVERDUE', templateData,
        `Record ${data.recordId} (${data.entityType}) correction is ${data.daysOverdue} days overdue. Please take action.`);
      if (data.supervisorId) {
        await this.sendToPreferredChannels(data.supervisorId, data.tenantId, 'CORRECTION_OVERDUE',
          { ...templateData, isSupervisorEscalation: true },
          `ESCALATION: Record ${data.recordId} (${data.entityType}) correction is ${data.daysOverdue} days overdue.`);
      }
    });
  }

  private async subscribeFormSubmitted(): Promise<void> {
    await this.kafkaConsumer.subscribe({ topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: GROUP_ID }, async (payload) => {
      const data = payload as any;
      const templateData = {
        campaignName: data.templateName, formId: data.formId, templateName: data.templateName,
        dashboardUrl: `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/submissions/${data.formId}`,
      };
      await this.sendToPreferredChannels(data.supervisorId, data.tenantId, 'CAMPAIGN_ASSIGNED', templateData,
        `A new ${data.templateName} form (${data.formId}) has been submitted and requires your review.`);
    });
  }

  /**
   * Welcome email on user creation. Triggered by TOPIC_SYS_CREDENTIAL_USER_CREATED
   * (published by services/credential AuthService.register). Renders the
   * WELCOME template with the temp password, role, tenant, and login URL so
   * the new user can perform their first sign-in. The ForcePasswordChangeModal
   * then forces them to rotate the password.
   *
   * Uses a dedicated transactional group so this is processed independently
   * of the preference-driven notification flow — password/welcome emails
   * must always be sent regardless of user opt-out preferences.
   */
  private async subscribeUserCreated(): Promise<void> {
    if (!this.emailChannel) {
      console.warn('[NotificationConsumer] No email channel — welcome emails will not be sent');
      return;
    }
    const channel = this.emailChannel;
    // Each transactional topic gets its own consumer group so KafkaJS's
    // partition assigner does not mistakenly hand off partitions of this
    // topic to a consumer subscribed to a different topic.
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_SYS_CREDENTIAL_USER_CREATED, groupId: 'message-service-welcome' },
      async (payload) => {
        const data = payload as any;
        // Only send the welcome email when a temporary password is present —
        // that is, the user was created with an admin-supplied password. This
        // filter avoids sending the welcome email to future service accounts
        // or imports that don't follow the register() path.
        if (!data.email || !data.temporaryPassword) {
          return;
        }
        const userName = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email;
        const roleName = String(data.role ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        const templateData = {
          userName,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email,
          roleName,
          tenantName: data.tenantName ?? 'ARIS',
          temporaryPassword: data.temporaryPassword,
          loginUrl: data.loginUrl ?? process.env['PUBLIC_WEB_URL'] ?? 'https://au-aris.org/login',
        };
        const rendered = this.templateEngine.renderEmail('WELCOME', templateData);
        const result = await channel.send({
          to: data.email,
          subject: rendered.subject,
          body: rendered.html,
        });
        if (result.success) {
          console.log(`[WELCOME] Email sent to ${data.email}`);
        } else {
          console.error(`[WELCOME] Failed to send email to ${data.email}: ${result.error}`);
        }
      },
    );
  }

  private async subscribePasswordReset(): Promise<void> {
    if (!this.emailChannel) {
      console.warn('[NotificationConsumer] No email channel provided — password reset emails will not be sent');
      return;
    }
    const channel = this.emailChannel;
    await this.kafkaConsumer.subscribe({ topic: TOPIC_SYS_CREDENTIAL_PASSWORD_RESET, groupId: 'message-service-transactional' }, async (payload) => {
      const data = payload as any;
      const templateData = { resetUrl: data.resetUrl, expiresIn: data.expiresIn };
      const rendered = this.templateEngine.renderEmail('PASSWORD_RESET', templateData);
      const result = await channel.send({
        to: data.email,
        subject: rendered.subject,
        body: rendered.html,
      });
      if (result.success) {
        console.log(`[PASSWORD_RESET] Email sent to ${data.email}`);
      } else {
        console.error(`[PASSWORD_RESET] Failed to send email to ${data.email}: ${result.error}`);
      }
    });
  }

  // ─── Knowledge Hub publication workflow ─────────────────────────────────
  //
  // Bidirectional notifications:
  //   - SUBMITTED → notify all KNOWLEDGE_MANAGER + CONTINENTAL_ADMIN reviewers
  //   - APPROVED  → notify the author (publication.authorId)
  //   - REJECTED  → notify the author with reviewer comment
  //   - PUBLISHED → notify the author so they know it's live

  private extractTitle(data: any): string {
    const t = data?.title ?? {};
    return t.en ?? t.fr ?? t.pt ?? t.ar ?? data?.slug ?? '(untitled)';
  }

  private async subscribeKnowledgeSubmitted(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_PUBLICATION_SUBMITTED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const title = this.extractTitle(data);
        const portalUrl = `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/knowledge/admin/review/${data.id}`;
        const body = `A new publication "${title}" is awaiting your review on the Knowledge Hub.\n\n${portalUrl}`;

        // Find all reviewers (KNOWLEDGE_MANAGER + CONTINENTAL_ADMIN + SUPER_ADMIN)
        if (!this.prisma) {
          console.warn('[NotificationConsumer] No prisma client — cannot resolve KH reviewers');
          return;
        }
        try {
          const reviewers = await (this.prisma as any).user.findMany({
            where: {
              role: { in: ['KNOWLEDGE_MANAGER', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'] },
              isActive: true,
            },
            select: { id: true, tenantId: true },
          });
          for (const r of reviewers) {
            await this.notificationService.send(
              { userId: r.id, channel: NotificationChannel.IN_APP, subject: `Knowledge Hub review needed: ${title}`, body },
              r.tenantId,
            );
          }
        } catch (err) {
          console.error('[NotificationConsumer] Failed to notify reviewers:', err);
        }
      },
    );
  }

  private async subscribeKnowledgeApproved(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_PUBLICATION_APPROVED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const title = this.extractTitle(data);
        const authorId = data.authorId ?? data.createdBy;
        if (!authorId) return;
        await this.notificationService.send(
          {
            userId: authorId,
            channel: NotificationChannel.IN_APP,
            subject: `✅ Publication approved: ${title}`,
            body: `Your publication "${title}" has been approved by the continental knowledge manager.${data.reviewerComment ? `\n\nComment: ${data.reviewerComment}` : ''}`,
          },
          data.tenantId,
        );
      },
    );
  }

  private async subscribeKnowledgeRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_PUBLICATION_REJECTED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const title = this.extractTitle(data);
        const authorId = data.authorId ?? data.createdBy;
        if (!authorId) return;
        await this.notificationService.send(
          {
            userId: authorId,
            channel: NotificationChannel.IN_APP,
            subject: `Publication needs revision: ${title}`,
            body: `Your publication "${title}" was not approved. ${data.reviewerComment || data.rejectionReason || 'See details on the Knowledge Hub.'}`,
          },
          data.tenantId,
        );
      },
    );
  }

  private async subscribeKnowledgePublished(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_PUBLICATION_PUBLISHED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const title = this.extractTitle(data);
        const authorId = data.authorId ?? data.createdBy;
        if (!authorId) return;
        const url = `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org'}/knowledge/p/${data.slug}`;
        await this.notificationService.send(
          {
            userId: authorId,
            channel: NotificationChannel.IN_APP,
            subject: `🌍 Publication is live: ${title}`,
            body: `Your publication "${title}" is now visible on the public Knowledge Hub portal.\n\n${url}`,
          },
          data.tenantId,
        );
      },
    );
  }

  // ── Knowledge Hub category proposal workflow ──────────────────────────

  private async subscribeKnowledgeCategorySubmitted(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_CATEGORY_SUBMITTED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const name = data.nameEn ?? data.slug ?? '(category)';
        const portalUrl = `${process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard'}/knowledge/admin/categories/review`;
        const body = `A new ${data.scope} category "${name}" was proposed and is awaiting your approval.\n\n${portalUrl}`;
        if (!this.prisma) return;
        try {
          const reviewers = await (this.prisma as any).user.findMany({
            where: {
              role: { in: ['KNOWLEDGE_MANAGER', 'CONTINENTAL_ADMIN', 'SUPER_ADMIN'] },
              isActive: true,
            },
            select: { id: true, tenantId: true },
          });
          for (const r of reviewers) {
            await this.notificationService.send(
              { userId: r.id, channel: NotificationChannel.IN_APP, subject: `Knowledge Hub category review: ${name}`, body },
              r.tenantId,
            );
          }
        } catch (err) {
          console.error('[NotificationConsumer] Failed to notify category reviewers:', err);
        }
      },
    );
  }

  private async subscribeKnowledgeCategoryApproved(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_CATEGORY_APPROVED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const submitterId = data.submitterId ?? data.submittedBy;
        if (!submitterId) return;
        await this.notificationService.send(
          {
            userId: submitterId,
            channel: NotificationChannel.IN_APP,
            subject: `✅ Category approved: ${data.nameEn ?? data.slug}`,
            body: `Your proposed category "${data.nameEn ?? data.slug}" has been approved and is now available for publishing.`,
          },
          data.tenantId ?? data.scopeTenantId,
        );
      },
    );
  }

  private async subscribeKnowledgeCategoryRejected(): Promise<void> {
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_AU_KNOWLEDGE_CATEGORY_REJECTED, groupId: GROUP_ID },
      async (payload) => {
        const data = payload as any;
        const submitterId = data.submitterId ?? data.submittedBy;
        if (!submitterId) return;
        await this.notificationService.send(
          {
            userId: submitterId,
            channel: NotificationChannel.IN_APP,
            subject: `Category not approved: ${data.nameEn ?? data.slug}`,
            body: `Your proposed category "${data.nameEn ?? data.slug}" was not approved. ${data.reviewerComment || data.rejectionReason || ''}`,
          },
          data.tenantId ?? data.scopeTenantId,
        );
      },
    );
  }

  private async subscribeNewDeviceLogin(): Promise<void> {
    if (!this.emailChannel) {
      console.warn('[NotificationConsumer] No email channel provided — new device login emails will not be sent');
      return;
    }
    const channel = this.emailChannel;
    await this.kafkaConsumer.subscribe(
      { topic: TOPIC_SYS_CREDENTIAL_NEW_DEVICE_LOGIN, groupId: 'message-service-transactional' },
      async (payload) => {
        const data = payload as any;
        const templateData = {
          firstName: data.firstName,
          lastName: data.lastName,
          deviceName: data.deviceName,
          deviceType: data.deviceType,
          ipAddress: data.ipAddress,
          loginAt: data.loginAt,
          isNewDevice: data.isNewDevice,
          allowMultipleConnections: data.allowMultipleConnections,
          dashboardUrl: process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard',
        };
        const rendered = this.templateEngine.renderEmail('NEW_DEVICE_LOGIN', templateData);
        const result = await channel.send({
          to: data.email,
          subject: rendered.subject,
          body: rendered.html,
        });
        const tag = data.isNewDevice ? '[NEW_DEVICE_LOGIN]' : '[LOGIN_ALERT]';
        if (result.success) {
          console.log(`${tag} Security email sent to ${data.email} (device: ${data.deviceName})`);
        } else {
          console.error(`${tag} Failed to send security email to ${data.email}: ${result.error}`);
        }
      },
    );
  }
}
