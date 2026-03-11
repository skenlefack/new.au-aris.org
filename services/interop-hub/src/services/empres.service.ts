import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_EMPRES_FED,
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
import type { FeedRecordEntity, EmpresSignal, ExportRecordEntity } from '../entities/interop.entity';
import type { MinioStorage } from '../plugins/minio';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const SERVICE_NAME = 'interop-hub-service';
const INTEROP_BUCKET = 'interop-exports';

interface CreateEmpresFeedDto {
  healthEventId: string;
  diseaseCode: string;
  countryCode: string;
  confidenceLevel: string;
  context: string;
  coordinates?: { lat: number; lng: number };
  species?: string[];
  cases?: number;
  deaths?: number;
}

export interface EmpresExportDto {
  countryIso: string;
  dateFrom?: string;
  dateTo?: string;
  diseaseFilter?: string[];
}

interface EmpresExportRecord {
  disease_name: string;
  date_start: string;
  country_iso: string;
  species_affected: string;
  latitude: number | null;
  longitude: number | null;
  cases_reported: number;
  deaths: number;
}

export class EmpresService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly minio?: MinioStorage,
  ) {}

  /**
   * Push a verified health event as an EMPRES signal.
   * Transforms the event data and sends to the EMPRES endpoint (adapter pattern).
   */
  async createFeed(
    dto: CreateEmpresFeedDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FeedRecordEntity>> {
    // Build EMPRES signal payload
    const signal: EmpresSignal = {
      signalId: randomUUID(),
      eventId: dto.healthEventId,
      diseaseCode: dto.diseaseCode,
      countryCode: dto.countryCode,
      reportDate: new Date().toISOString(),
      confidence: dto.confidenceLevel,
      context: dto.context,
      coordinates: dto.coordinates ?? null,
      species: dto.species ?? [],
      cases: dto.cases ?? 0,
      deaths: dto.deaths ?? 0,
    };

    // Create feed record
    const record = await (this.prisma as any).feedRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'EMPRES',
        health_event_id: dto.healthEventId,
        disease_id: null,
        country_code: dto.countryCode,
        confidence_level: dto.confidenceLevel,
        status: 'PENDING',
        payload: JSON.parse(JSON.stringify(signal)),
        fed_by: user.userId,
      },
    });

    try {
      // Mock HTTP POST to EMPRES endpoint (adapter pattern)
      const response = await this.sendToEmpres(signal);

      const updated = await (this.prisma as any).feedRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          response_code: response.statusCode,
          response_body: response.body,
          fed_at: new Date(),
        },
      });

      // Publish Kafka event
      await this.publishFeedEvent(updated, user);

      return { data: this.toFeedEntity(updated) };
    } catch (error) {
      const failed = await (this.prisma as any).feedRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      return { data: this.toFeedEntity(failed) };
    }
  }

  /**
   * Export health events in EMPRES-i v2 JSON format.
   * Queries confirmed events with coordinates, generates JSON file, uploads to MinIO.
   */
  async exportEmpres(
    dto: EmpresExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // default: 90 days
    const dateTo = dto.dateTo ? new Date(dto.dateTo) : new Date();

    const record = await (this.prisma as any).exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'EMPRES',
        country_code: dto.countryIso,
        period_start: dateFrom,
        period_end: dateTo,
        format: 'EMPRES_JSON',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      const events = await this.queryHealthEventsForEmpres(
        dto.countryIso,
        dateFrom,
        dateTo,
        dto.diseaseFilter,
      );

      // Build EMPRES-i v2 JSON array
      const empresRecords: EmpresExportRecord[] = events.map((e) => ({
        disease_name: e.disease_name ?? 'Unknown',
        date_start: e.reported_date
          ? new Date(e.reported_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        country_iso: dto.countryIso,
        species_affected: e.species_name ?? 'Unknown',
        latitude: e.latitude,
        longitude: e.longitude,
        cases_reported: e.cases ?? 0,
        deaths: e.deaths ?? 0,
      }));

      const jsonContent = JSON.stringify(empresRecords, null, 2);
      const jsonBuffer = Buffer.from(jsonContent, 'utf-8');

      let packageUrl = `/api/v1/interop/empres/exports/${record.id}/download`;
      let packageSize = jsonBuffer.length;

      if (this.minio) {
        const dateStr = new Date().toISOString().split('T')[0];
        const key = `empres/${dto.countryIso}/${dateStr}/${record.id}.json`;

        await this.minio.putObject({
          bucket: INTEROP_BUCKET,
          key,
          body: jsonBuffer,
          contentType: 'application/json',
          metadata: {
            exportId: record.id,
            countryCode: dto.countryIso,
            connectorType: 'EMPRES',
          },
        });

        packageUrl = await this.minio.getPresignedDownloadUrl({
          bucket: INTEROP_BUCKET,
          key,
          expiresIn: 3600,
        });
        packageSize = jsonBuffer.length;
      }

      const updated = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: empresRecords.length,
          package_url: packageUrl,
          package_size: packageSize,
          exported_at: new Date(),
        },
      });

      await this.publishExportEvent(TOPIC_AU_INTEROP_EXPORT_COMPLETED, {
        id: updated.id,
        exportType: 'EMPRES',
        country: dto.countryIso,
        status: 'COMPLETED',
        fileUrl: packageUrl,
      }, user);

      return { data: this.toExportEntity(updated) };
    } catch (error) {
      const failed = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      await this.publishExportEvent(TOPIC_AU_INTEROP_EXPORT_FAILED, {
        id: failed.id,
        exportType: 'EMPRES',
        country: dto.countryIso,
        error: error instanceof Error ? error.message : String(error),
      }, user).catch(() => {});

      return { data: this.toExportEntity(failed) };
    }
  }

  /**
   * Query confirmed health events with coordinates for EMPRES export.
   */
  private async queryHealthEventsForEmpres(
    countryCode: string,
    dateFrom: Date,
    dateTo: Date,
    diseaseFilter?: string[],
  ): Promise<Array<{
    id: string;
    disease_name: string | null;
    reported_date: Date | null;
    species_name: string | null;
    latitude: number | null;
    longitude: number | null;
    cases: number | null;
    deaths: number | null;
  }>> {
    try {
      const diseaseClause = diseaseFilter?.length
        ? `AND he.disease_code = ANY($4::text[])`
        : '';

      const params: unknown[] = [dateFrom, dateTo, countryCode];
      if (diseaseFilter?.length) {
        params.push(diseaseFilter);
      }

      return await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        disease_name: string | null;
        reported_date: Date | null;
        species_name: string | null;
        latitude: number | null;
        longitude: number | null;
        cases: number | null;
        deaths: number | null;
      }>>(
        `SELECT he.id, he.disease_name, he.reported_date,
                he.species_name, he.latitude, he.longitude,
                he.cases, he.deaths
         FROM animal_health.health_events he
         WHERE he.reported_date >= $1
           AND he.reported_date <= $2
           AND he.country_code = $3
           AND he.status = 'CONFIRMED'
           AND he.latitude IS NOT NULL
           AND he.longitude IS NOT NULL
           ${diseaseClause}
         ORDER BY he.reported_date ASC`,
        ...params,
      );
    } catch {
      return [];
    }
  }

  /**
   * Mock HTTP adapter for EMPRES endpoint.
   * In production, this sends an actual HTTP POST.
   */
  async sendToEmpres(
    signal: EmpresSignal,
  ): Promise<{ statusCode: number; body: string }> {
    return {
      statusCode: 200,
      body: JSON.stringify({ accepted: true, signalId: signal.signalId }),
    };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<FeedRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      connector_type: 'EMPRES' as const,
      ...this.buildTenantFilter(user),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).feedRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).feedRecord.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toFeedEntity(r)),
      meta: { total, page, limit },
    };
  }

  // -- Entity mapping --

  toFeedEntity(row: {
    id: string;
    tenant_id: string;
    connector_type: string;
    health_event_id: string;
    disease_id: string | null;
    country_code: string;
    confidence_level: string;
    status: string;
    payload: unknown;
    response_code: number | null;
    response_body: string | null;
    error_message: string | null;
    fed_by: string;
    fed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): FeedRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      connectorType: row.connector_type as FeedRecordEntity['connectorType'],
      healthEventId: row.health_event_id,
      diseaseId: row.disease_id,
      countryCode: row.country_code,
      confidenceLevel: row.confidence_level,
      status: row.status as FeedRecordEntity['status'],
      payload: row.payload,
      responseCode: row.response_code,
      responseBody: row.response_body,
      errorMessage: row.error_message,
      fedBy: row.fed_by,
      fedAt: row.fed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  toExportEntity(row: {
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

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private async publishFeedEvent(
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
      await this.kafka.send(TOPIC_AU_INTEROP_EMPRES_FED, record.id as string, record, headers);
    } catch {
      // Log but don't fail for Kafka issues
    }
  }

  private async publishExportEvent(
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
    } catch {
      // Log but don't fail for Kafka issues
    }
  }
}
