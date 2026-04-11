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
   * and transforming them to WOAH format with full enrichment from master data.
   */
  async generateWahisPackage(
    exportId: string,
    countryCode: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<WahisPackage> {
    // Query workflow instances that are WAHIS-ready for this country/period,
    // joined with animal_health events + master_data for enrichment.
    const wahisInstances = await this.prisma.$queryRaw<
      Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        domain: string;
        created_at: Date;
        disease_id: string | null;
        onset_date: Date | null;
        cases: number | null;
        deaths: number | null;
        latitude: number | null;
        longitude: number | null;
        confidence_level: string | null;
        control_measures: string | null;
      }>
    >`
      SELECT wi.id, wi.entity_type, wi.entity_id, wi.domain, wi.created_at,
             he.disease_id, he.onset_date, he.cases, he.deaths,
             he.latitude, he.longitude, he.confidence_level,
             he.control_measures
      FROM workflow.workflow_instances wi
      LEFT JOIN animal_health.health_events he ON he.id = wi.entity_id
      WHERE wi.wahis_ready = true
        AND wi.domain = 'health'
        AND wi.created_at >= ${periodStart}
        AND wi.created_at <= ${periodEnd}
      ORDER BY wi.created_at ASC
    `;

    // Collect unique disease IDs and entity IDs for batch enrichment
    const diseaseIds = [...new Set(
      wahisInstances.map((wi) => wi.disease_id).filter(Boolean) as string[]
    )];
    const entityIds = wahisInstances.map((wi) => wi.entity_id);

    // Batch-fetch disease codes from master_data.ref_diseases
    const diseaseMap = await this.fetchDiseaseMap(diseaseIds);

    // Batch-fetch species per event from animal_health.event_species
    const speciesMap = await this.fetchSpeciesMap(entityIds);

    // Fetch geo enrichment for country
    const geoInfo = await this.fetchGeoInfo(countryCode);

    // Transform to WAHIS event format with full enrichment
    const events: WahisEvent[] = wahisInstances.map((wi) => {
      const disease = wi.disease_id ? diseaseMap.get(wi.disease_id) : null;
      const eventSpecies = speciesMap.get(wi.entity_id) ?? [];

      return {
        eventId: wi.entity_id,
        diseaseCode: disease?.woahCode ?? 'UNKNOWN',
        diseaseName: disease?.name ?? 'Unknown Disease',
        countryCode: geoInfo?.iso3 ?? countryCode,
        reportDate: wi.created_at.toISOString(),
        onsetDate: wi.onset_date?.toISOString() ?? null,
        species: eventSpecies,
        cases: wi.cases ?? 0,
        deaths: wi.deaths ?? 0,
        controlMeasures: wi.control_measures
          ? (wi.control_measures as string).split(',').map((s) => s.trim())
          : [],
        coordinates: wi.latitude != null && wi.longitude != null
          ? { lat: wi.latitude, lng: wi.longitude }
          : null,
        confidenceLevel: wi.confidence_level ?? 'CONFIRMED',
      };
    });

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

  /**
   * Fetch WOAH disease codes from master_data.ref_diseases for a set of disease IDs.
   */
  private async fetchDiseaseMap(
    diseaseIds: string[],
  ): Promise<Map<string, { woahCode: string; name: string }>> {
    const map = new Map<string, { woahCode: string; name: string }>();
    if (diseaseIds.length === 0) return map;

    try {
      const diseases = await this.prisma.$queryRaw<
        Array<{ id: string; woah_code: string; name: string }>
      >`
        SELECT id, COALESCE(woah_code, code) AS woah_code, name
        FROM master_data.ref_diseases
        WHERE id = ANY(${diseaseIds}::uuid[])
      `;

      for (const d of diseases) {
        map.set(d.id, { woahCode: d.woah_code, name: d.name });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch disease enrichment (${diseaseIds.length} IDs): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return map;
  }

  /**
   * Fetch species names per health event from animal_health.event_species + master_data.ref_species.
   */
  private async fetchSpeciesMap(
    entityIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (entityIds.length === 0) return map;

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ event_id: string; species_name: string }>
      >`
        SELECT es.health_event_id AS event_id,
               COALESCE(rs.scientific_name, rs.common_name, rs.code) AS species_name
        FROM animal_health.event_species es
        LEFT JOIN master_data.ref_species rs ON rs.id = es.species_id
        WHERE es.health_event_id = ANY(${entityIds}::uuid[])
      `;

      for (const row of rows) {
        const existing = map.get(row.event_id) ?? [];
        existing.push(row.species_name);
        map.set(row.event_id, existing);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch species enrichment (${entityIds.length} events): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return map;
  }

  /**
   * Fetch ISO3 code and country name from master_data.ref_geo_entities.
   */
  private async fetchGeoInfo(
    countryCode: string,
  ): Promise<{ iso3: string; name: string } | null> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ iso3: string; name: string }>
      >`
        SELECT COALESCE(iso3_code, code) AS iso3, name
        FROM master_data.ref_geo_entities
        WHERE code = ${countryCode} OR iso3_code = ${countryCode}
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch geo info for ${countryCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
