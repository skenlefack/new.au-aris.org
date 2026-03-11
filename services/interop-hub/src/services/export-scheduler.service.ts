import cron from 'node-cron';
import type { WahisService } from './wahis.service';
import type { EmpresService } from './empres.service';
import type { PrismaClient } from '@prisma/client';

interface SchedulerLogger {
  info(msg: string): void;
  error(msg: string | object, ...args: unknown[]): void;
  warn(msg: string): void;
}

/**
 * Scheduled export service using node-cron.
 * Runs periodic WAHIS and EMPRES exports for eligible countries.
 */
export class ExportSchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    private readonly wahisService: WahisService,
    private readonly empresService: EmpresService,
    private readonly logger: SchedulerLogger,
  ) {}

  /**
   * Start all scheduled export jobs.
   */
  start(): void {
    // Quarterly WAHIS auto-export: 1st of Jan/Apr/Jul/Oct at 02:00 UTC
    const wahisTask = cron.schedule('0 2 1 */3 *', () => {
      this.runWahisAutoExport().catch((err) =>
        this.logger.error(`WAHIS auto-export failed: ${err}`),
      );
    }, { timezone: 'UTC' });
    this.tasks.push(wahisTask);

    // Weekly EMPRES active alerts: Monday 03:00 UTC
    const empresTask = cron.schedule('0 3 * * 1', () => {
      this.runEmpresActiveAlerts().catch((err) =>
        this.logger.error(`EMPRES active alerts export failed: ${err}`),
      );
    }, { timezone: 'UTC' });
    this.tasks.push(empresTask);

    this.logger.info(
      'Export scheduler started: WAHIS quarterly (0 2 1 */3 *), EMPRES weekly (0 3 * * 1)',
    );
  }

  /**
   * Stop all scheduled tasks.
   */
  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.logger.info('Export scheduler stopped');
  }

  /**
   * Run automatic WAHIS export for countries with autoExportWahis=true.
   */
  async runWahisAutoExport(): Promise<void> {
    this.logger.info('Running scheduled WAHIS auto-export...');

    // Find countries with auto-export enabled
    const configs = await (this.prisma as any).connectorConfig.findMany({
      where: {
        connector_type: 'WAHIS',
        is_active: true,
      },
    });

    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
    // Export previous quarter
    const exportQuarter = currentQuarter === 1 ? 4 : (currentQuarter - 1) as 1 | 2 | 3 | 4;
    const exportYear = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();

    let successCount = 0;
    let failCount = 0;

    for (const config of configs) {
      const autoExport = (config.config as Record<string, unknown>)?.autoExportWahis;
      if (!autoExport) continue;

      const countryCode = (config.config as Record<string, unknown>)?.countryCode as string | undefined;
      if (!countryCode) continue;

      try {
        // Use system user context for automated exports
        const systemUser = {
          userId: 'system-scheduler',
          tenantId: config.tenant_id ?? 'system',
          role: 'SUPER_ADMIN',
          tenantLevel: 'CONTINENTAL',
          email: 'system@au-aris.org',
        } as any;

        await this.wahisService.exportWahis({
          countryIso: countryCode,
          year: exportYear,
          quarter: exportQuarter,
          diseases: [],
        }, systemUser);

        successCount++;
        this.logger.info(`WAHIS auto-export completed: ${countryCode} Q${exportQuarter}/${exportYear}`);
      } catch (err) {
        failCount++;
        this.logger.error(`WAHIS auto-export failed for ${countryCode}: ${err}`);
      }
    }

    this.logger.info(
      `WAHIS auto-export batch finished: ${successCount} success, ${failCount} failed`,
    );
  }

  /**
   * Run weekly EMPRES active alerts export.
   * Exports confirmed events with confidence >= VERIFIED for each configured country.
   */
  async runEmpresActiveAlerts(): Promise<void> {
    this.logger.info('Running scheduled EMPRES active alerts export...');

    const configs = await (this.prisma as any).connectorConfig.findMany({
      where: {
        connector_type: 'EMPRES',
        is_active: true,
      },
    });

    const dateTo = new Date();
    const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    let successCount = 0;
    let failCount = 0;

    for (const config of configs) {
      const countryCode = (config.config as Record<string, unknown>)?.countryCode as string | undefined;
      if (!countryCode) continue;

      try {
        const systemUser = {
          userId: 'system-scheduler',
          tenantId: config.tenant_id ?? 'system',
          role: 'SUPER_ADMIN',
          tenantLevel: 'CONTINENTAL',
          email: 'system@au-aris.org',
        } as any;

        await this.empresService.exportEmpres({
          countryIso: countryCode,
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
        }, systemUser);

        successCount++;
        this.logger.info(`EMPRES active alerts export completed: ${countryCode}`);
      } catch (err) {
        failCount++;
        this.logger.error(`EMPRES active alerts export failed for ${countryCode}: ${err}`);
      }
    }

    this.logger.info(
      `EMPRES active alerts batch finished: ${successCount} success, ${failCount} failed`,
    );
  }
}
