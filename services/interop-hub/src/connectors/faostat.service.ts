import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_FAOSTAT_SYNCED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import type { CreateFaostatSyncDto, FaostatDenominatorRow } from '../dto/faostat-sync.dto';
import type {
  SyncRecordEntity,
  FaostatDiscrepancy,
} from '../entities/interop.entity';

const SERVICE_NAME = 'interop-hub-service';

/** Percentage difference threshold to flag a discrepancy */
const DISCREPANCY_THRESHOLD = 10; // 10%

@Injectable()
export class FaostatService {
  private readonly logger = new Logger(FaostatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Import/reconcile denominators from FAOSTAT data.
   * Compares with existing denominators and flags discrepancies.
   */
  async createSync(
    dto: CreateFaostatSyncDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SyncRecordEntity>> {
    const record = await this.prisma.syncRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'FAOSTAT',
        country_code: dto.countryCode,
        year: dto.year,
        status: 'IN_PROGRESS',
        source_url: dto.sourceUrl ?? null,
        synced_by: user.userId,
      },
    });

    try {
      const result = await this.reconcileDenominators(dto.records);

      const updated = await this.prisma.syncRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          records_imported: result.imported,
          records_updated: result.updated,
          discrepancies: result.discrepancies.length,
          discrepancy_details: JSON.parse(JSON.stringify(result.discrepancies)),
          synced_at: new Date(),
        },
      });

      await this.publishEvent(updated, user);

      this.logger.log(
        `FAOSTAT sync completed: ${dto.countryCode}/${dto.year} — imported=${result.imported} updated=${result.updated} discrepancies=${result.discrepancies.length}`,
      );
      return { data: this.toEntity(updated) };
    } catch (error) {
      const failed = await this.prisma.syncRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `FAOSTAT sync failed: ${dto.countryCode}/${dto.year}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Reconcile FAOSTAT denominator records against existing data.
   * Returns counts and discrepancy details.
   */
  async reconcileDenominators(
    records: FaostatDenominatorRow[],
  ): Promise<{
    imported: number;
    updated: number;
    discrepancies: FaostatDiscrepancy[];
  }> {
    let imported = 0;
    let updated = 0;
    const discrepancies: FaostatDiscrepancy[] = [];

    for (const row of records) {
      // Check for existing denominator (via master-data Denominator table)
      // In production, this would call the master-data service.
      // Here we track the reconciliation locally.
      const existing = await this.findExistingDenominator(
        row.countryCode,
        row.speciesCode,
        row.year,
      );

      if (!existing) {
        imported++;
      } else {
        const percentDiff = existing.population > 0
          ? Math.abs((row.population - existing.population) / existing.population) * 100
          : row.population > 0 ? 100 : 0;

        if (percentDiff > DISCREPANCY_THRESHOLD) {
          discrepancies.push({
            countryCode: row.countryCode,
            speciesCode: row.speciesCode,
            year: row.year,
            existingValue: existing.population,
            faostatValue: row.population,
            percentDiff: Math.round(percentDiff * 100) / 100,
          });
        }
        updated++;
      }
    }

    return { imported, updated, discrepancies };
  }

  /**
   * Look up existing denominator. In production, queries master-data service.
   * Returns null if not found (mock implementation).
   */
  async findExistingDenominator(
    _countryCode: string,
    _speciesCode: string,
    _year: number,
  ): Promise<{ population: number } | null> {
    // Mock: in production this calls master-data's denominator endpoint
    return null;
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SyncRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      connector_type: 'FAOSTAT' as const,
      ...this.buildTenantFilter(user),
    };

    const [data, total] = await Promise.all([
      this.prisma.syncRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.syncRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  // ── Entity mapping ──

  toEntity(row: {
    id: string;
    tenant_id: string;
    connector_type: string;
    country_code: string;
    year: number;
    status: string;
    records_imported: number;
    records_updated: number;
    discrepancies: number;
    discrepancy_details: unknown;
    source_url: string | null;
    synced_by: string;
    synced_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): SyncRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      connectorType: row.connector_type as SyncRecordEntity['connectorType'],
      countryCode: row.country_code,
      year: row.year,
      status: row.status as SyncRecordEntity['status'],
      recordsImported: row.records_imported,
      recordsUpdated: row.records_updated,
      discrepancies: row.discrepancies,
      discrepancyDetails: row.discrepancy_details,
      sourceUrl: row.source_url,
      syncedBy: row.synced_by,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private async publishEvent(
    record: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(TOPIC_AU_INTEROP_FAOSTAT_SYNCED, record.id as string, record, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish FAOSTAT sync event for ${record.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
