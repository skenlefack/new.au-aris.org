import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_SYS_DATA_SHARING_ACCESS_RECORDED,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  DataShareAccessLogDto,
  ShareAccessAction,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { HttpError } from './agreement.service';

const SERVICE_NAME = 'data-sharing-service';

export interface LogInput {
  agreementId: string;
  userId: string;
  tenantId: string;
  action: ShareAccessAction;
  recordCount?: number;
  queryFilters?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AccessLogService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async log(input: LogInput): Promise<DataShareAccessLogDto> {
    const row = await (this.prisma as any).dataShareAccessLog.create({
      data: {
        agreement_id: input.agreementId,
        user_id: input.userId,
        tenant_id: input.tenantId,
        action: input.action,
        record_count: input.recordCount ?? null,
        query_filters: (input.queryFilters ?? null) as any,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        success: input.success,
        error_message: input.errorMessage ?? null,
      },
    });

    try {
      const headers: KafkaHeaders = {
        correlationId: randomUUID(),
        sourceService: SERVICE_NAME,
        tenantId: input.tenantId,
        userId: input.userId,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      };
      await this.kafkaProducer.send(
        TOPIC_SYS_DATA_SHARING_ACCESS_RECORDED,
        row.id,
        row,
        headers,
      );
    } catch (err) {
      console.error(
        `[AccessLogService] Failed to publish access event for ${row.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return this.toEntity(row);
  }

  async findByAgreement(
    agreementId: string,
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DataShareAccessLogDto>> {
    const agreement = await (this.prisma as any).dataShareAgreement.findUnique({
      where: { id: agreementId },
    });
    if (!agreement) {
      throw new HttpError(404, `Agreement ${agreementId} not found`);
    }
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      agreement.owner_tenant_id !== user.tenantId &&
      agreement.recipient_tenant_id !== user.tenantId
    ) {
      throw new HttpError(404, 'Agreement not found');
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { agreement_id: agreementId };

    const [data, total] = await Promise.all([
      (this.prisma as any).dataShareAccessLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' as const },
      }),
      (this.prisma as any).dataShareAccessLog.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  private toEntity(row: any): DataShareAccessLogDto {
    return {
      id: row.id,
      agreementId: row.agreement_id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      action: row.action as ShareAccessAction,
      recordCount: row.record_count ?? null,
      queryFilters: (row.query_filters as Record<string, unknown> | null) ?? null,
      ipAddress: row.ip_address ?? null,
      userAgent: row.user_agent ?? null,
      success: row.success,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
