import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { WorkflowInstanceService } from './workflow-engine.service';

/**
 * Cron-based background jobs for workflow automation.
 * Uses setInterval instead of node-cron to avoid extra dependencies.
 */
export class WorkflowCronService {
  private readonly instanceService: WorkflowInstanceService;
  private autoTransmitTimer: ReturnType<typeof setInterval> | null = null;
  private escalationTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {
    this.instanceService = new WorkflowInstanceService(prisma, kafkaProducer);
  }

  /** Start all cron jobs */
  start(): void {
    // Auto-transmit: every 15 minutes
    this.autoTransmitTimer = setInterval(() => {
      this.runAutoTransmit().catch((err) =>
        console.error('[WorkflowCron] Auto-transmit error:', err),
      );
    }, 15 * 60 * 1000);

    // Escalation: every hour
    this.escalationTimer = setInterval(() => {
      this.runEscalation().catch((err) =>
        console.error('[WorkflowCron] Escalation error:', err),
      );
    }, 60 * 60 * 1000);

    // Deadline reminders: every 6 hours
    this.reminderTimer = setInterval(() => {
      this.runDeadlineReminders().catch((err) =>
        console.error('[WorkflowCron] Reminder error:', err),
      );
    }, 6 * 60 * 60 * 1000);

    console.log('[WorkflowCron] Started: auto-transmit (15min), escalation (1h), reminders (6h)');

    // Run initial auto-transmit after 30 seconds
    setTimeout(() => {
      this.runAutoTransmit().catch((err) =>
        console.error('[WorkflowCron] Initial auto-transmit error:', err),
      );
    }, 30_000);
  }

  /** Stop all cron jobs */
  stop(): void {
    if (this.autoTransmitTimer) clearInterval(this.autoTransmitTimer);
    if (this.escalationTimer) clearInterval(this.escalationTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    console.log('[WorkflowCron] Stopped all cron jobs');
  }

  private async runAutoTransmit(): Promise<void> {
    const count = await this.instanceService.processAutoTransmit();
    if (count > 0) {
      console.log(`[WorkflowCron] Auto-transmitted ${count} instances`);
    }
  }

  private async runEscalation(): Promise<void> {
    const count = await this.instanceService.processEscalation();
    if (count > 0) {
      console.log(`[WorkflowCron] Escalated ${count} instances`);
    }
  }

  private async runDeadlineReminders(): Promise<void> {
    const now = new Date();
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    // Find instances with approaching deadlines
    const approaching = await (this.prisma as any).collecteInstance.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'RETURNED'] },
        currentDeadline: {
          gte: now,
          lte: in12h,
        },
        currentAssigneeId: { not: null },
      },
      take: 100,
    });

    if (approaching.length > 0) {
      console.log(`[WorkflowCron] Sending deadline reminders for ${approaching.length} instances`);
      // In production, this would publish Kafka events for the message service to send notifications
      for (const instance of approaching) {
        try {
          const hoursLeft = Math.round(
            ((instance.currentDeadline as Date).getTime() - now.getTime()) / (1000 * 60 * 60),
          );
          await this.kafkaProducer.send(
            'ms.collecte.workflow.deadline_approaching.v1',
            instance.id,
            {
              instanceId: instance.id,
              assigneeId: instance.currentAssigneeId,
              hoursRemaining: hoursLeft,
              deadline: instance.currentDeadline,
            },
            {
              correlationId: instance.id,
              sourceService: 'collecte-service',
              tenantId: 'system',
              userId: 'system',
              schemaVersion: '1',
              timestamp: now.toISOString(),
            },
          );
        } catch {
          // Kafka publishing failures are non-fatal for reminders
        }
      }
    }
  }
}
