import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationChannel } from '@aris/shared-types';
import { PrismaService } from '../prisma.service';
import { NotificationService } from '../notification/notification.service';
import { TemplateEngine } from '../templates/template-engine';
import { PreferencesService } from '../preferences/preferences.service';

const PENDING_STATUSES = ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'] as const;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly templateEngine: TemplateEngine,
    private readonly preferencesService: PreferencesService,
  ) {}

  /**
   * Sends daily digest emails to all users with pending workflow actions.
   * Runs on weekdays at 08:00 AM.
   */
  @Cron('0 8 * * 1-5')
  async sendDailyDigests(): Promise<void> {
    try {
      this.logger.log('Starting daily digest generation...');

      // Find all distinct userIds with pending workflow instances
      const userGroups = await this.prisma.workflowInstance.groupBy({
        by: ['created_by'],
        where: {
          status: { in: [...PENDING_STATUSES] },
        },
      });

      const userIds = userGroups.map((g) => g.created_by);
      this.logger.log(`Found ${userIds.length} users with pending actions`);

      let digestsSent = 0;

      for (const userId of userIds) {
        try {
          // We need a tenantId for preferences and notifications.
          // Retrieve it from one of the user's workflow instances.
          const sampleInstance = await this.prisma.workflowInstance.findFirst({
            where: {
              created_by: userId,
              status: { in: [...PENDING_STATUSES] },
            },
            select: { tenant_id: true },
          });

          const tenantId = sampleInstance?.tenant_id ?? '';

          await this.sendDigestForUser(userId, tenantId);
          digestsSent++;
        } catch (error) {
          this.logger.error(
            `Failed to send digest for user ${userId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(`Daily digest complete: ${digestsSent} digests sent`);
    } catch (error) {
      this.logger.error(
        'Daily digest cron failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Sends a digest for a single user. Useful for manual triggers and testing.
   */
  async sendDigestForUser(userId: string, tenantId: string): Promise<void> {
    const { pendingApprovals, overdueCorrections, unreadCount, items } =
      await this.aggregatePendingActions(userId);

    if (pendingApprovals === 0 && overdueCorrections === 0) {
      this.logger.debug(
        `Skipping digest for user ${userId} — no pending or overdue items`,
      );
      return;
    }

    const channels = await this.preferencesService.getChannelsForEvent(
      userId,
      tenantId,
      'DAILY_DIGEST',
    );

    const data: Record<string, unknown> = {
      userName: 'User',
      pendingApprovals,
      overdueCorrections,
      unreadCount,
      date: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      dashboardUrl:
        process.env['DASHBOARD_URL'] ?? 'https://aris.africa/dashboard',
      unsubscribeUrl:
        process.env['UNSUBSCRIBE_URL'] ?? 'https://aris.africa/preferences',
      items,
    };

    // Send via preferred channels
    if (channels.email) {
      try {
        const rendered = this.templateEngine.renderEmail('DAILY_DIGEST', data);
        await this.notificationService.send(
          {
            userId,
            channel: NotificationChannel.EMAIL,
            subject: rendered.subject,
            body: rendered.html,
          },
          tenantId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send email digest for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (channels.sms) {
      try {
        const smsBody = this.templateEngine.renderSms('DAILY_DIGEST', data);
        await this.notificationService.send(
          {
            userId,
            channel: NotificationChannel.SMS,
            subject: 'ARIS Daily Digest',
            body: smsBody,
          },
          tenantId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send SMS digest for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (channels.inApp) {
      try {
        const summary = `You have ${pendingApprovals} pending approval(s) and ${overdueCorrections} overdue correction(s).`;
        await this.notificationService.send(
          {
            userId,
            channel: NotificationChannel.IN_APP,
            subject: 'Daily Digest',
            body: summary,
          },
          tenantId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send in-app digest for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Aggregates pending workflow actions for a given user.
   * Extracted for reuse and testability.
   */
  async aggregatePendingActions(userId: string): Promise<{
    pendingApprovals: number;
    overdueCorrections: number;
    unreadCount: number;
    items: Array<{
      entityType: string;
      entityId: string;
      level: string;
      domain: string;
      createdAt: string;
    }>;
  }> {
    // Count pending workflow instances grouped by current_level
    const pendingByLevel = await this.prisma.workflowInstance.groupBy({
      by: ['current_level'],
      where: {
        created_by: userId,
        status: { in: [...PENDING_STATUSES] },
      },
      _count: { id: true },
    });

    const totalPending = pendingByLevel.reduce(
      (sum, group) => sum + group._count.id,
      0,
    );

    // Count overdue corrections
    const overdueCount = await this.prisma.workflowInstance.count({
      where: {
        created_by: userId,
        sla_deadline: { lt: new Date() },
        status: { in: [...PENDING_STATUSES] },
      },
    });

    // Count unread notifications
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    // Top 5 pending items ordered by creation date ascending
    const topItems = await this.prisma.workflowInstance.findMany({
      where: {
        created_by: userId,
        status: { in: [...PENDING_STATUSES] },
      },
      take: 5,
      orderBy: { created_at: 'asc' },
    });

    const items = topItems.map((i) => ({
      entityType: i.entity_type,
      entityId: i.entity_id,
      level: String(i.current_level),
      domain: i.domain,
      createdAt: i.created_at.toLocaleDateString('en-GB'),
    }));

    return {
      pendingApprovals: totalPending,
      overdueCorrections: overdueCount,
      unreadCount,
      items,
    };
  }
}
