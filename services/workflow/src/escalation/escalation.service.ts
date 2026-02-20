import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma.service';
import { WorkflowService } from '../instance/workflow.service';

@Injectable()
export class EscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationService.name);
  private cronJob: CronJob | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  onModuleInit(): void {
    // Run every 15 minutes to check for SLA breaches
    const cronExpression = process.env['ESCALATION_CRON'] ?? '*/15 * * * *';
    this.cronJob = new CronJob(cronExpression, () => {
      this.checkOverdueInstances().catch((err) =>
        this.logger.error('Escalation check failed', err instanceof Error ? err.stack : String(err)),
      );
    });
    this.cronJob.start();
    this.logger.log(`Escalation cron started: ${cronExpression}`);
  }

  onModuleDestroy(): void {
    this.cronJob?.stop();
    this.logger.log('Escalation cron stopped');
  }

  /**
   * Find all workflow instances past their SLA deadline and escalate them.
   */
  async checkOverdueInstances(): Promise<number> {
    const now = new Date();

    const overdueInstances = await this.prisma.workflowInstance.findMany({
      where: {
        sla_deadline: { lt: now },
        status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] },
      },
      take: 100, // Process in batches
    });

    if (overdueInstances.length === 0) {
      return 0;
    }

    this.logger.log(`Found ${overdueInstances.length} overdue workflow instances`);

    let escalated = 0;
    for (const instance of overdueInstances) {
      try {
        await this.workflowService.escalate(
          instance.id,
          `SLA deadline breached (deadline: ${instance.sla_deadline?.toISOString()})`,
        );
        escalated++;
      } catch (error) {
        this.logger.error(
          `Failed to escalate instance ${instance.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Escalated ${escalated}/${overdueInstances.length} overdue instances`);
    return escalated;
  }
}
