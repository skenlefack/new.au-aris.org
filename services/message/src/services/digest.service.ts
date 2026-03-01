import type { PrismaClient } from '@prisma/client';
import { NotificationChannel } from '@aris/shared-types';
import type { NotificationService } from './notification.service';
import type { TemplateEngine } from './template-engine';
import type { PreferencesService } from './preferences.service';

const PENDING_STATUSES = ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'] as const;

export class DigestService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notificationService: NotificationService,
    private readonly templateEngine: TemplateEngine,
    private readonly preferencesService: PreferencesService,
  ) {}

  async sendDailyDigests(): Promise<void> {
    try {
      console.log('Starting daily digest generation...');

      const userGroups = await (this.prisma as any).workflowInstance.groupBy({
        by: ['created_by'],
        where: { status: { in: [...PENDING_STATUSES] } },
      });

      const userIds = userGroups.map((g: any) => g.created_by);
      console.log(`Found ${userIds.length} users with pending actions`);

      let digestsSent = 0;

      for (const userId of userIds) {
        try {
          const sampleInstance = await (this.prisma as any).workflowInstance.findFirst({
            where: { created_by: userId, status: { in: [...PENDING_STATUSES] } },
            select: { tenant_id: true },
          });
          const tenantId = sampleInstance?.tenant_id ?? '';
          await this.sendDigestForUser(userId, tenantId);
          digestsSent++;
        } catch (error) {
          console.error(`Failed to send digest for user ${userId}`, error instanceof Error ? error.stack : String(error));
        }
      }

      console.log(`Daily digest complete: ${digestsSent} digests sent`);
    } catch (error) {
      console.error('Daily digest cron failed', error instanceof Error ? error.stack : String(error));
    }
  }

  async sendDigestForUser(userId: string, tenantId: string): Promise<void> {
    const { pendingApprovals, overdueCorrections, unreadCount, items } = await this.aggregatePendingActions(userId);

    if (pendingApprovals === 0 && overdueCorrections === 0) return;

    const channels = await this.preferencesService.getChannelsForEvent(userId, tenantId, 'DAILY_DIGEST');

    const data: Record<string, unknown> = {
      userName: 'User',
      pendingApprovals,
      overdueCorrections,
      unreadCount,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      dashboardUrl: process.env['DASHBOARD_URL'] ?? 'https://au-aris.org/dashboard',
      unsubscribeUrl: process.env['UNSUBSCRIBE_URL'] ?? 'https://au-aris.org/preferences',
      items,
    };

    if (channels.email) {
      try {
        const rendered = this.templateEngine.renderEmail('DAILY_DIGEST', data);
        await this.notificationService.send({ userId, channel: NotificationChannel.EMAIL, subject: rendered.subject, body: rendered.html }, tenantId);
      } catch { /* best-effort */ }
    }

    if (channels.sms) {
      try {
        const smsBody = this.templateEngine.renderSms('DAILY_DIGEST', data);
        await this.notificationService.send({ userId, channel: NotificationChannel.SMS, subject: 'ARIS Daily Digest', body: smsBody }, tenantId);
      } catch { /* best-effort */ }
    }

    if (channels.inApp) {
      try {
        const summary = `You have ${pendingApprovals} pending approval(s) and ${overdueCorrections} overdue correction(s).`;
        await this.notificationService.send({ userId, channel: NotificationChannel.IN_APP, subject: 'Daily Digest', body: summary }, tenantId);
      } catch { /* best-effort */ }
    }
  }

  async aggregatePendingActions(userId: string): Promise<{
    pendingApprovals: number;
    overdueCorrections: number;
    unreadCount: number;
    items: Array<{ entityType: string; entityId: string; level: string; domain: string; createdAt: string }>;
  }> {
    const pendingByLevel = await (this.prisma as any).workflowInstance.groupBy({
      by: ['current_level'],
      where: { created_by: userId, status: { in: [...PENDING_STATUSES] } },
      _count: { id: true },
    });
    const totalPending = pendingByLevel.reduce((sum: number, group: any) => sum + group._count.id, 0);

    const overdueCount = await (this.prisma as any).workflowInstance.count({
      where: { created_by: userId, sla_deadline: { lt: new Date() }, status: { in: [...PENDING_STATUSES] } },
    });

    const unreadCount = await (this.prisma as any).notification.count({
      where: { userId, readAt: null },
    });

    const topItems = await (this.prisma as any).workflowInstance.findMany({
      where: { created_by: userId, status: { in: [...PENDING_STATUSES] } },
      take: 5,
      orderBy: { created_at: 'asc' },
    });

    const items = topItems.map((i: any) => ({
      entityType: i.entity_type,
      entityId: i.entity_id,
      level: String(i.current_level),
      domain: i.domain,
      createdAt: i.created_at.toLocaleDateString('en-GB'),
    }));

    return { pendingApprovals: totalPending, overdueCorrections: overdueCount, unreadCount, items };
  }
}
