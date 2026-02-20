import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_EMPRES_FED,
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
import type { CreateEmpresFeedDto } from '../dto/empres-feed.dto';
import type { FeedRecordEntity, EmpresSignal } from '../entities/interop.entity';

const SERVICE_NAME = 'interop-hub-service';

@Injectable()
export class EmpresService {
  private readonly logger = new Logger(EmpresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
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
      signalId: uuidv4(),
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
    const record = await this.prisma.feedRecord.create({
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

      const updated = await this.prisma.feedRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          response_code: response.statusCode,
          response_body: response.body,
          fed_at: new Date(),
        },
      });

      // Publish Kafka event
      await this.publishEvent(updated, user);

      this.logger.log(
        `EMPRES feed completed: event=${dto.healthEventId} country=${dto.countryCode}`,
      );
      return { data: this.toEntity(updated) };
    } catch (error) {
      const failed = await this.prisma.feedRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `EMPRES feed failed: event=${dto.healthEventId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Mock HTTP adapter for EMPRES endpoint.
   * In production, this sends an actual HTTP POST.
   */
  async sendToEmpres(
    signal: EmpresSignal,
  ): Promise<{ statusCode: number; body: string }> {
    // Adapter pattern: replace with real HTTP call in production
    this.logger.log(`Sending EMPRES signal: ${signal.signalId} → ${signal.countryCode}`);
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
      this.prisma.feedRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.feedRecord.count({ where }),
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
      await this.kafkaProducer.send(TOPIC_AU_INTEROP_EMPRES_FED, record.id as string, record, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish EMPRES fed event for ${record.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
