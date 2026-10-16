// ═══════════════════════════════════════════════════════════════════
//  Schedule Manager — Cron-based pipeline execution scheduling
// ═══════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  HubSchedule,
  HubScheduleFrequency,
  CreateScheduleDto,
  UpdateScheduleDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';
import type { PipelineEngineService } from './pipeline-engine.service';

/** Frequency to cron expression mapping */
const FREQUENCY_CRON: Record<HubScheduleFrequency, string | null> = {
  REALTIME: null,        // Event-driven, no cron
  HOURLY: '0 * * * *',
  DAILY: '0 2 * * *',   // 02:00 UTC
  WEEKLY: '0 2 * * 1',  // Monday 02:00 UTC
  BIWEEKLY: '0 2 1,15 * *', // 1st and 15th of month
  MONTHLY: '0 2 1 * *', // 1st of month
  QUARTERLY: '0 2 1 1,4,7,10 *', // Jan, Apr, Jul, Oct
  BIANNUAL: '0 2 1 1,7 *', // Jan, Jul
  ANNUAL: '0 2 1 1 *',  // Jan 1st
  ON_DEMAND: null,       // Manual only
};

interface ScheduledJob {
  scheduleId: string;
  intervalId: NodeJS.Timeout;
}

export class ScheduleService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private evaluateIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly pipelineEngine: PipelineEngineService,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubSchedule;
  }

  private throwHttp(statusCode: number, message: string): never {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  async create(dto: CreateScheduleDto): Promise<HubSchedule> {
    // Validate connection
    const connection = await (this.prisma as any).hubConnection.findFirst({
      where: { id: dto.connection_id, tenant_id: dto.tenant_id },
    });
    if (!connection) {
      this.throwHttp(404, `Connection ${dto.connection_id} not found`);
    }

    // Validate pipeline if specified
    if (dto.pipeline_id) {
      const pipeline = await (this.prisma as any).hubPipeline.findFirst({
        where: { id: dto.pipeline_id, connection_id: dto.connection_id },
      });
      if (!pipeline) {
        this.throwHttp(404, `Pipeline ${dto.pipeline_id} not found for this connection`);
      }
    }

    // Determine cron expression
    const cronExpression = dto.cron_expression ?? FREQUENCY_CRON[dto.frequency] ?? null;

    // Compute next run time
    const nextRunAt = cronExpression ? this.computeNextRun(cronExpression, dto.timezone ?? 'UTC') : null;

    const schedule = await this.db.create({
      data: {
        connection_id: dto.connection_id,
        pipeline_id: dto.pipeline_id ?? null,
        tenant_id: dto.tenant_id,
        frequency: dto.frequency,
        cron_expression: cronExpression,
        timezone: dto.timezone ?? 'UTC',
        window_start: dto.window_start ?? null,
        window_end: dto.window_end ?? null,
        period_type: dto.period_type ?? null,
        period_start: dto.period_start ?? null,
        period_end: dto.period_end ?? null,
        is_active: true,
        next_run_at: nextRunAt,
      },
    });

    this.logger.info(`Schedule created: ${schedule.id} (${dto.frequency})`);
    return schedule as HubSchedule;
  }

  async findAll(
    tenantId: string,
    params: PaginationParams & { connection_id?: string } = {},
  ): Promise<PaginatedResult<HubSchedule>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (params.connection_id) where.connection_id = params.connection_id;

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        include: { connection: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubSchedule[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<HubSchedule> {
    const schedule = await this.db.findUnique({
      where: { id },
      include: { connection: true },
    });
    if (!schedule) {
      this.throwHttp(404, `Schedule ${id} not found`);
    }
    return schedule as HubSchedule;
  }

  async update(id: string, dto: UpdateScheduleDto): Promise<HubSchedule> {
    const existing = await this.db.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Schedule ${id} not found`);
    }

    // Recompute cron if frequency changed
    let cronExpression = existing.cron_expression;
    if (dto.cron_expression !== undefined) {
      cronExpression = dto.cron_expression;
    } else if (dto.frequency !== undefined) {
      cronExpression = FREQUENCY_CRON[dto.frequency] ?? null;
    }

    const timezone = dto.timezone ?? existing.timezone;
    const nextRunAt = cronExpression ? this.computeNextRun(cronExpression, timezone) : null;

    const schedule = await this.db.update({
      where: { id },
      data: {
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(cronExpression !== existing.cron_expression && { cron_expression: cronExpression }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.window_start !== undefined && { window_start: dto.window_start }),
        ...(dto.window_end !== undefined && { window_end: dto.window_end }),
        ...(dto.period_type !== undefined && { period_type: dto.period_type }),
        ...(dto.period_start !== undefined && { period_start: dto.period_start }),
        ...(dto.period_end !== undefined && { period_end: dto.period_end }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        next_run_at: nextRunAt,
      },
    });

    // If schedule was deactivated, remove its job
    if (dto.is_active === false && this.jobs.has(id)) {
      this.removeJob(id);
    }

    this.logger.info(`Schedule updated: ${id}`);
    return schedule as HubSchedule;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Schedule ${id} not found`);
    }
    this.removeJob(id);
    await this.db.delete({ where: { id } });
    this.logger.info(`Schedule deleted: ${id}`);
  }

  // ─── Scheduler Engine ───────────────────────────────────────────

  /**
   * Start the schedule evaluator. Checks every 60 seconds which
   * schedules need to run and triggers pipeline execution.
   */
  startScheduler(): void {
    if (this.evaluateIntervalId) {
      this.logger.warn('Scheduler already running');
      return;
    }

    // Evaluate immediately, then every 60s
    this.evaluateSchedules().catch(err => {
      this.logger.error(`Initial schedule evaluation failed: ${err}`);
    });

    this.evaluateIntervalId = setInterval(() => {
      this.evaluateSchedules().catch(err => {
        this.logger.error(`Schedule evaluation failed: ${err}`);
      });
    }, 60_000);

    this.logger.info('Schedule evaluator started (interval: 60s)');
  }

  /** Stop the schedule evaluator and all cron jobs. */
  stopScheduler(): void {
    if (this.evaluateIntervalId) {
      clearInterval(this.evaluateIntervalId);
      this.evaluateIntervalId = null;
    }

    for (const [id] of this.jobs) {
      this.removeJob(id);
    }

    this.logger.info('Schedule evaluator stopped');
  }

  /**
   * Evaluate all active schedules and trigger pipelines that are due.
   */
  async evaluateSchedules(): Promise<void> {
    const now = new Date();

    const dueSchedules = await this.db.findMany({
      where: {
        is_active: true,
        next_run_at: { lte: now },
      },
      include: { connection: true },
    });

    if (dueSchedules.length === 0) return;

    this.logger.info(`Found ${dueSchedules.length} due schedule(s)`);

    for (const schedule of dueSchedules) {
      try {
        await this.triggerSchedule(schedule);
      } catch (err: any) {
        this.logger.error(`Failed to trigger schedule ${schedule.id}: ${err.message}`);

        await this.db.update({
          where: { id: schedule.id },
          data: { last_run_ok: false },
        });
      }
    }
  }

  /** Trigger a single schedule — runs associated pipeline(s). */
  private async triggerSchedule(schedule: any): Promise<void> {
    this.logger.info(`Triggering schedule ${schedule.id} (${schedule.frequency})`);

    const startedAt = new Date();

    // Find pipelines to run
    let pipelines: any[];
    if (schedule.pipeline_id) {
      const pipeline = await (this.prisma as any).hubPipeline.findUnique({
        where: { id: schedule.pipeline_id },
      });
      pipelines = pipeline ? [pipeline] : [];
    } else {
      // Run all active pipelines for this connection
      pipelines = await (this.prisma as any).hubPipeline.findMany({
        where: {
          connection_id: schedule.connection_id,
          status: 'ACTIVE',
        },
      });
    }

    let allOk = true;
    for (const pipeline of pipelines) {
      try {
        // For scheduled runs, use SYSTEM as initiator and empty input
        // Real adapters (Phase 7) will fetch data from external systems
        await this.pipelineEngine.executePipeline(
          pipeline.id,
          { records: [], metadata: { triggered_by: 'schedule', schedule_id: schedule.id } },
          'SYSTEM',
        );
      } catch (err: any) {
        this.logger.error(`Pipeline ${pipeline.id} execution failed for schedule ${schedule.id}: ${err.message}`);
        allOk = false;
      }
    }

    // Update schedule: last_run_at, next_run_at, last_run_ok
    const cronExpr = schedule.cron_expression;
    const nextRunAt = cronExpr ? this.computeNextRun(cronExpr, schedule.timezone) : null;

    await this.db.update({
      where: { id: schedule.id },
      data: {
        last_run_at: startedAt,
        last_run_ok: allOk,
        next_run_at: nextRunAt,
      },
    });
  }

  // ─── Job Management ─────────────────────────────────────────────

  private removeJob(scheduleId: string): void {
    const job = this.jobs.get(scheduleId);
    if (job) {
      clearInterval(job.intervalId);
      this.jobs.delete(scheduleId);
    }
  }

  // ─── Cron Utilities ─────────────────────────────────────────────

  /**
   * Compute the next run time from a cron expression.
   * Simple implementation — covers standard ARIS frequencies.
   * For production, consider using a proper cron parser (e.g., cron-parser).
   */
  private computeNextRun(cronExpression: string, _timezone: string): Date {
    // Simple approach: next occurrence = now + interval derived from frequency
    // In production, use `cron-parser` npm package for accurate cron evaluation
    const now = new Date();
    const parts = cronExpression.split(' ');

    if (parts.length !== 5) {
      // Invalid cron — default to 1 hour from now
      return new Date(now.getTime() + 3_600_000);
    }

    const [minute, hour] = parts;

    // Hourly
    if (minute !== '*' && hour === '*') {
      const next = new Date(now);
      next.setMinutes(parseInt(minute, 10), 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    }

    // Daily or more (specific hour)
    if (minute !== '*' && hour !== '*') {
      const next = new Date(now);
      next.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    // Fallback: 1 hour from now
    return new Date(now.getTime() + 3_600_000);
  }
}
