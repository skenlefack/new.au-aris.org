import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_WAHIS_EXPORTED,
  TOPIC_AU_INTEROP_EXPORT_COMPLETED,
  TOPIC_AU_INTEROP_EXPORT_FAILED,
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
import type {
  ExportRecordEntity,
  WahisPackage,
  WahisEvent,
} from '../entities/interop.entity';
import type { MinioStorage } from '../plugins/minio';
import { buildWahisXml } from './wahis-xml.builder';
import type { WahisDiseaseOccurrence } from './wahis-xml.builder';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const SERVICE_NAME = 'interop-hub-service';
const INTEROP_BUCKET = 'interop-exports';

interface CreateWahisExportDto {
  countryCode: string;
  periodStart: string;
  periodEnd: string;
  format?: 'WOAH_JSON' | 'WOAH_XML';
}

export interface WahisExportDto {
  countryIso: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  diseases: string[];
}

export class WahisService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly minio?: MinioStorage,
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
    const record = await (this.prisma as any).exportRecord.create({
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

      let packageUrl = `/api/v1/interop/wahis/exports/${record.id}/download`;
      let packageSize = JSON.stringify(wahisPackage).length;

      // If XML format requested and MinIO available, generate XML and upload
      if (dto.format === 'WOAH_XML' && this.minio) {
        const xmlContent = this.buildXmlFromPackage(wahisPackage, dto.countryCode);
        const xmlBuffer = Buffer.from(xmlContent, 'utf-8');
        const periodStart = new Date(dto.periodStart);
        const quarter = Math.ceil((periodStart.getMonth() + 1) / 3);
        const key = `wahis/${dto.countryCode}/${periodStart.getFullYear()}-Q${quarter}/${record.id}.xml`;

        await this.minio.putObject({
          bucket: INTEROP_BUCKET,
          key,
          body: xmlBuffer,
          contentType: 'application/xml',
          metadata: {
            exportId: record.id,
            countryCode: dto.countryCode,
            connectorType: 'WAHIS',
          },
        });

        packageUrl = await this.minio.getPresignedDownloadUrl({
          bucket: INTEROP_BUCKET,
          key,
          expiresIn: 3600,
        });
        packageSize = xmlBuffer.length;
      } else if (this.minio) {
        // JSON format to MinIO
        const jsonContent = JSON.stringify(wahisPackage, null, 2);
        const jsonBuffer = Buffer.from(jsonContent, 'utf-8');
        const periodStart = new Date(dto.periodStart);
        const quarter = Math.ceil((periodStart.getMonth() + 1) / 3);
        const key = `wahis/${dto.countryCode}/${periodStart.getFullYear()}-Q${quarter}/${record.id}.json`;

        await this.minio.putObject({
          bucket: INTEROP_BUCKET,
          key,
          body: jsonBuffer,
          contentType: 'application/json',
          metadata: {
            exportId: record.id,
            countryCode: dto.countryCode,
            connectorType: 'WAHIS',
          },
        });

        packageUrl = await this.minio.getPresignedDownloadUrl({
          bucket: INTEROP_BUCKET,
          key,
          expiresIn: 3600,
        });
        packageSize = jsonBuffer.length;
      }

      // Update record with results
      const updated = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: wahisPackage.totalEvents,
          package_url: packageUrl,
          package_size: packageSize,
          exported_at: new Date(),
        },
      });

      // Publish Kafka events
      await this.publishEvent(TOPIC_AU_INTEROP_WAHIS_EXPORTED, updated, user);
      await this.publishEvent(TOPIC_AU_INTEROP_EXPORT_COMPLETED, {
        id: updated.id,
        exportType: 'WAHIS',
        country: dto.countryCode,
        status: 'COMPLETED',
        fileUrl: packageUrl,
      }, user);

      return { data: this.toEntity(updated) };
    } catch (error) {
      // Mark as failed
      const failed = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      await this.publishEvent(TOPIC_AU_INTEROP_EXPORT_FAILED, {
        id: failed.id,
        exportType: 'WAHIS',
        country: dto.countryCode,
        error: error instanceof Error ? error.message : String(error),
      }, user).catch(() => {});

      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Full WAHIS export with XML generation. Accepts country, year, quarter, diseases.
   * Queries health events, groups by disease, generates XML, uploads to MinIO.
   */
  async exportWahis(
    dto: WahisExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const quarterStartMonth = (dto.quarter - 1) * 3;
    const periodStart = new Date(dto.year, quarterStartMonth, 1);
    const periodEnd = new Date(dto.year, quarterStartMonth + 3, 0); // last day of quarter

    const record = await (this.prisma as any).exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'WAHIS',
        country_code: dto.countryIso,
        period_start: periodStart,
        period_end: periodEnd,
        format: 'WOAH_XML',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      // Query health events from animal-health schema
      const healthEvents = await this.queryHealthEvents(
        dto.countryIso,
        periodStart,
        periodEnd,
        dto.diseases,
      );

      // Group events by disease
      const diseaseMap = new Map<string, WahisDiseaseOccurrence>();
      for (const event of healthEvents) {
        const key = event.disease_code ?? 'UNKNOWN';
        if (!diseaseMap.has(key)) {
          diseaseMap.set(key, {
            diseaseName: event.disease_name ?? key,
            oieCode: key,
            outbreaks: [],
          });
        }
        diseaseMap.get(key)!.outbreaks.push({
          dateReported: event.reported_date
            ? new Date(event.reported_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          onsetDate: event.onset_date
            ? new Date(event.onset_date).toISOString().split('T')[0]
            : null,
          latitude: event.latitude ?? null,
          longitude: event.longitude ?? null,
          adminLevel1: event.admin_level1 ?? null,
          species: event.species_name
            ? [{
                name: event.species_name,
                affected: event.cases ?? 0,
                deaths: event.deaths ?? 0,
              }]
            : [],
          controlMeasures: event.control_measures
            ? (event.control_measures as string[])
            : [],
        });
      }

      const xmlContent = buildWahisXml({
        countryIso3: dto.countryIso,
        year: dto.year,
        quarter: dto.quarter,
        diseases: Array.from(diseaseMap.values()),
      });

      let packageUrl = `/api/v1/interop/wahis/exports/${record.id}/download`;
      let packageSize = Buffer.byteLength(xmlContent, 'utf-8');

      if (this.minio) {
        const xmlBuffer = Buffer.from(xmlContent, 'utf-8');
        const key = `wahis/${dto.countryIso}/${dto.year}-Q${dto.quarter}/${record.id}.xml`;

        await this.minio.putObject({
          bucket: INTEROP_BUCKET,
          key,
          body: xmlBuffer,
          contentType: 'application/xml',
          metadata: {
            exportId: record.id,
            countryCode: dto.countryIso,
            connectorType: 'WAHIS',
          },
        });

        packageUrl = await this.minio.getPresignedDownloadUrl({
          bucket: INTEROP_BUCKET,
          key,
          expiresIn: 3600,
        });
        packageSize = xmlBuffer.length;
      }

      const updated = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: healthEvents.length,
          package_url: packageUrl,
          package_size: packageSize,
          exported_at: new Date(),
        },
      });

      await this.publishEvent(TOPIC_AU_INTEROP_WAHIS_EXPORTED, updated, user);
      await this.publishEvent(TOPIC_AU_INTEROP_EXPORT_COMPLETED, {
        id: updated.id,
        exportType: 'WAHIS',
        country: dto.countryIso,
        status: 'COMPLETED',
        fileUrl: packageUrl,
      }, user);

      return { data: this.toEntity(updated) };
    } catch (error) {
      const failed = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      await this.publishEvent(TOPIC_AU_INTEROP_EXPORT_FAILED, {
        id: failed.id,
        exportType: 'WAHIS',
        country: dto.countryIso,
        error: error instanceof Error ? error.message : String(error),
      }, user).catch(() => {});

      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Query health events from animal_health schema that are WAHIS-ready.
   */
  private async queryHealthEvents(
    countryCode: string,
    periodStart: Date,
    periodEnd: Date,
    diseases: string[],
  ): Promise<Array<{
    id: string;
    disease_code: string | null;
    disease_name: string | null;
    reported_date: Date | null;
    onset_date: Date | null;
    latitude: number | null;
    longitude: number | null;
    admin_level1: string | null;
    species_name: string | null;
    cases: number | null;
    deaths: number | null;
    control_measures: unknown;
  }>> {
    // Query workflow instances marked WAHIS-ready, then join with health events
    const diseaseFilter = diseases.length > 0
      ? `AND he.disease_code = ANY($4::text[])`
      : '';

    const params: unknown[] = [periodStart, periodEnd, countryCode];
    if (diseases.length > 0) {
      params.push(diseases);
    }

    try {
      return await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        disease_code: string | null;
        disease_name: string | null;
        reported_date: Date | null;
        onset_date: Date | null;
        latitude: number | null;
        longitude: number | null;
        admin_level1: string | null;
        species_name: string | null;
        cases: number | null;
        deaths: number | null;
        control_measures: unknown;
      }>>(
        `SELECT he.id, he.disease_code, he.disease_name,
                he.reported_date, he.onset_date,
                he.latitude, he.longitude, he.admin_level1,
                he.species_name, he.cases, he.deaths,
                he.control_measures
         FROM animal_health.health_events he
         WHERE he.reported_date >= $1
           AND he.reported_date <= $2
           AND he.country_code = $3
           AND he.wahis_ready = true
           ${diseaseFilter}
         ORDER BY he.reported_date ASC`,
        ...params,
      );
    } catch {
      // Fallback: if animal_health schema doesn't exist, query workflow instances
      return this.queryFromWorkflowInstances(countryCode, periodStart, periodEnd);
    }
  }

  /**
   * Fallback: query workflow instances for WAHIS data.
   */
  private async queryFromWorkflowInstances(
    countryCode: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Array<{
    id: string;
    disease_code: string | null;
    disease_name: string | null;
    reported_date: Date | null;
    onset_date: Date | null;
    latitude: number | null;
    longitude: number | null;
    admin_level1: string | null;
    species_name: string | null;
    cases: number | null;
    deaths: number | null;
    control_measures: unknown;
  }>> {
    try {
      const instances = await this.prisma.$queryRaw<
        Array<{
          id: string;
          entity_id: string;
          created_at: Date;
        }>
      >`
        SELECT wi.id, wi.entity_id, wi.created_at
        FROM workflow.workflow_instances wi
        WHERE wi.wahis_ready = true
          AND wi.domain = 'health'
          AND wi.created_at >= ${periodStart}
          AND wi.created_at <= ${periodEnd}
        ORDER BY wi.created_at ASC
      `;

      return instances.map((wi) => ({
        id: wi.entity_id,
        disease_code: null,
        disease_name: null,
        reported_date: wi.created_at,
        onset_date: null,
        latitude: null,
        longitude: null,
        admin_level1: null,
        species_name: null,
        cases: null,
        deaths: null,
        control_measures: null,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Build XML from a WahisPackage (used by legacy createExport method).
   */
  private buildXmlFromPackage(wahisPackage: WahisPackage, countryCode: string): string {
    const diseaseMap = new Map<string, WahisDiseaseOccurrence>();

    for (const event of wahisPackage.events) {
      const key = event.diseaseCode || 'UNKNOWN';
      if (!diseaseMap.has(key)) {
        diseaseMap.set(key, {
          diseaseName: event.diseaseName || key,
          oieCode: key,
          outbreaks: [],
        });
      }
      diseaseMap.get(key)!.outbreaks.push({
        dateReported: event.reportDate.split('T')[0],
        onsetDate: event.onsetDate?.split('T')[0] ?? null,
        latitude: event.coordinates?.lat ?? null,
        longitude: event.coordinates?.lng ?? null,
        adminLevel1: null,
        species: event.species.map((s) => ({ name: s, affected: event.cases, deaths: event.deaths })),
        controlMeasures: event.controlMeasures,
      });
    }

    const periodStart = new Date(wahisPackage.periodStart);
    const quarter = Math.ceil((periodStart.getMonth() + 1) / 3);

    return buildWahisXml({
      countryIso3: countryCode,
      year: periodStart.getFullYear(),
      quarter,
      diseases: Array.from(diseaseMap.values()),
    });
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

    const events: WahisEvent[] = wahisInstances.map((wi) => ({
      eventId: wi.entity_id,
      diseaseCode: 'PENDING',
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
      (this.prisma as any).exportRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).exportRecord.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await (this.prisma as any).exportRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Export record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenant_id);
    return { data: this.toEntity(record) };
  }

  /**
   * Find all export records across all connector types with filtering.
   */
  async findAllExports(
    user: AuthenticatedUser,
    query: PaginationQuery & { connector?: string; status?: string },
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
    };
    if (query.connector) {
      where.connector_type = query.connector;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).exportRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).exportRecord.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  /**
   * Retry a failed export by re-creating it with the same parameters.
   */
  async retryExport(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await (this.prisma as any).exportRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Export record ${id} not found`);
    }

    if (record.status !== 'FAILED') {
      throw new HttpError(400, 'Only FAILED exports can be retried');
    }

    this.verifyTenantAccess(user, record.tenant_id);

    return this.createExport(
      {
        countryCode: record.country_code,
        periodStart: record.period_start.toISOString(),
        periodEnd: record.period_end.toISOString(),
        format: record.format,
      },
      user,
    );
  }

  // -- Entity mapping --

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

  // -- Tenant helpers --

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private verifyTenantAccess(user: AuthenticatedUser, recordTenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === recordTenantId) return;
    throw new HttpError(404, 'Export record not found');
  }

  // -- Kafka --

  private async publishEvent(
    topic: string,
    record: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafka.send(topic, record.id as string, record, headers);
    } catch (error) {
      // Log but don't fail the export for Kafka issues
    }
  }
}
