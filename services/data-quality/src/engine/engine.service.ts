import { Injectable, Logger } from '@nestjs/common';
import {
  QualityEngine,
  type QualityGateConfig,
  type QualityReport as EngineReport,
} from '@aris/quality-rules';
import { PrismaService } from '../prisma.service';

/**
 * NestJS wrapper around @aris/quality-rules QualityEngine.
 * Resolves Master Data codes at runtime to inject into gate configs.
 */
@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);
  private readonly engine: QualityEngine;

  // Cached code sets — refreshed periodically
  private geoCodes: Set<string> = new Set();
  private speciesCodes: Set<string> = new Set();
  private diseaseCodes: Set<string> = new Set();
  private unitCodes: Set<string> = new Set();
  private lastRefresh = 0;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {
    this.engine = new QualityEngine();
  }

  /**
   * Run all 8 quality gates on a record.
   */
  async check(
    record: Record<string, unknown>,
    entityType: string,
    domainConfig: QualityGateConfig,
  ): Promise<EngineReport> {
    await this.ensureCodeSetsLoaded();

    // Merge runtime code sets into domain config
    const config: QualityGateConfig = {
      ...domainConfig,
      validCodes: {
        ...domainConfig.validCodes,
        geo: this.geoCodes,
        species: this.speciesCodes,
        disease: this.diseaseCodes,
      },
      validUnits: domainConfig.validUnits ?? this.unitCodes,
    };

    return this.engine.check(record, entityType, config);
  }

  /**
   * Load Master Data code sets for validation.
   * Cached with periodic refresh.
   */
  private async ensureCodeSetsLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh < this.REFRESH_INTERVAL_MS) return;

    try {
      const [geoEntities, species, diseases, units] = await Promise.all([
        this.prisma.geoEntity.findMany({
          where: { isActive: true },
          select: { code: true },
        }),
        this.prisma.species.findMany({
          where: { isActive: true },
          select: { code: true },
        }),
        this.prisma.disease.findMany({
          where: { isActive: true },
          select: { code: true },
        }),
        this.prisma.unit.findMany({
          where: { isActive: true },
          select: { code: true },
        }),
      ]);

      this.geoCodes = new Set(geoEntities.map((e) => e.code));
      this.speciesCodes = new Set(species.map((s) => s.code));
      this.diseaseCodes = new Set(diseases.map((d) => d.code));
      this.unitCodes = new Set(units.map((u) => u.code));
      this.lastRefresh = now;

      this.logger.log(
        `Master Data codes refreshed: ${this.geoCodes.size} geo, ${this.speciesCodes.size} species, ${this.diseaseCodes.size} diseases, ${this.unitCodes.size} units`,
      );
    } catch (error) {
      this.logger.warn(
        'Failed to refresh Master Data codes, using cached values',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /** Force a refresh of code sets (e.g. after Master Data update event) */
  invalidateCache(): void {
    this.lastRefresh = 0;
  }
}
