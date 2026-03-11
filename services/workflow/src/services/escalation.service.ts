import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowService } from './workflow.service.js';

export class EscalationService {
  private cronJob: CronJob | null = null;
  private logger: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };

  constructor(
    private readonly prisma: PrismaClient,
    private readonly workflowService: WorkflowService,
    logger?: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void },
  ) {
    this.logger = logger ?? console;
  }

  start(): void {
    const cronExpression = process.env['ESCALATION_CRON'] ?? '*/15 * * * *';
    this.cronJob = new CronJob(cronExpression, () => {
      this.checkOverdueInstances().catch((err) =>
        this.logger.error('Escalation check failed', err instanceof Error ? err.stack : String(err)),
      );
    });
    this.cronJob.start();
    this.logger.log(`Escalation cron started: ${cronExpression}`);
  }

  stop(): void {
    this.cronJob?.stop();
  }

  /**
   * Find all workflow instances past their SLA deadline and escalate them.
   */
  async checkOverdueInstances(): Promise<number> {
    const now = new Date();

    const overdueInstances = await (this.prisma as any).workflowInstance.findMany({
      where: {
        sla_deadline: { lt: now },
        status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] },
      },
      take: 100, // Process in batches
    });

    if (overdueInstances.length === 0) {
      return 0;
    }

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

    return escalated;
  }
}
