import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_WAHIS_EXPORTED,
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
import type { CreateWahisExportDto } from '../dto/wahis-export.dto';
import type {
  ExportRecordEntity,
  WahisPackage,
  WahisEvent,
} from '../entities/interop.entity';

const SERVICE_NAME = 'interop-hub-service';

@Injectable()
export class WahisService {
  private readonly logger = new Logger(WahisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Generate a WAHIS-ready export package for a country/period.
   * Queries animal-health events with wahisReady=true, transforms to WOAH format,
   * and stores the export record.
   */
  async createExport(
    dto: CreateWahisExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    // Create the export record in PENDING state
    const record = await this.prisma.exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'WAHIS',
        country_code: dto.countryCode,
        period_start: new Date(dto.periodStart),
        period_end: new Date(dto.periodEnd),
        format: dto.format ?? 'WOAH_JSON',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      // Generate the WAHIS package
      const wahisPackage = await this.generateWahisPackage(
        record.id,
        dto.countryCode,
        new Date(dto.periodStart),
        new Date(dto.periodEnd),
      );

      // Update record with results
      const updated = await this.prisma.exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: wahisPackage.totalEvents,
          package_url: `/api/v1/interop/wahis/exports/${record.id}/download`,
          package_size: JSON.stringify(wahisPackage).length,
          exported_at: new Date(),
        },
      });

      // Publish Kafka event
      await this.publishEvent(TOPIC_AU_INTEROP_WAHIS_EXPORTED, updated, user);

      this.logger.log(
        `WAHIS export completed: ${dto.countryCode} ${dto.periodStart}..${dto.periodEnd} (${wahisPackage.totalEvents} events)`,
      );
      return { data: this.toEntity(updated) };
    } catch (error) {
      // Mark as failed
      const failed = await this.prisma.exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `WAHIS export failed: ${dto.countryCode}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Generate the WAHIS package by querying wahis-ready workflow instances
   * and transforming them to WOAH format.
   */
  async generateWahisPackage(
    exportId: string,
    countryCode: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<WahisPackage> {
    // Query workflow instances that are WAHIS-ready for this country/period.
    // In production this would query the animal-health service or a shared view.
    // Here we query workflow instances marked wahis_ready = true.
    const wahisInstances = await this.prisma.$queryRaw<
      Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        domain: string;
        created_at: Date;
      }>
    >`
      SELECT wi.id, wi.entity_type, wi.entity_id, wi.domain, wi.created_at
      FROM workflow.workflow_instances wi
      WHERE wi.wahis_ready = true
        AND wi.domain = 'health'
        AND wi.created_at >= ${periodStart}
        AND wi.created_at <= ${periodEnd}
      ORDER BY wi.created_at ASC
    `;

    // Transform to WAHIS event format
    const events: WahisEvent[] = wahisInstances.map((wi) => ({
      eventId: wi.entity_id,
      diseaseCode: 'PENDING', // Would be enriched from health event data
      diseaseName: 'PENDING',
      countryCode,
      reportDate: wi.created_at.toISOString(),
      onsetDate: null,
      species: [],
      cases: 0,
      deaths: 0,
      controlMeasures: [],
      coordinates: null,
      confidenceLevel: 'CONFIRMED',
    }));

    return {
      exportId,
      countryCode,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      format: 'WOAH_JSON',
      events,
      totalEvents: events.length,
    };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      connector_type: 'WAHIS' as const,
      ...this.buildTenantFilter(user),
    };

    const [data, total] = await Promise.all([
      this.prisma.exportRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.exportRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await this.prisma.exportRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Export record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenant_id);
    return { data: this.toEntity(record) };
  }

  // ── Entity mapping ──

  toEntity(row: {
    id: string;
    tenant_id: string;
    connector_type: string;
    country_code: string;
    period_start: Date;
    period_end: Date;
    format: string;
    status: string;
    record_count: number;
    package_url: string | null;
    package_size: number | null;
    error_message: string | null;
    exported_by: string;
    exported_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): ExportRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      connectorType: row.connector_type as ExportRecordEntity['connectorType'],
      countryCode: row.country_code,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      format: row.format as ExportRecordEntity['format'],
      status: row.status as ExportRecordEntity['status'],
      recordCount: row.record_count,
      packageUrl: row.package_url,
      packageSize: row.package_size,
      errorMessage: row.error_message,
      exportedBy: row.exported_by,
      exportedAt: row.exported_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Tenant helpers ──

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private verifyTenantAccess(user: AuthenticatedUser, recordTenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === recordTenantId) return;
    throw new NotFoundException('Export record not found');
  }

  // ── Kafka ──

  private async publishEvent(
    topic: string,
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
      await this.kafkaProducer.send(topic, record.id as string, record, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for ${record.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
