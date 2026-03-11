import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel } from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AuditService } from './audit.service.js';
import {
  TOPIC_MS_TRADE_SPS_CERTIFIED,
  TOPIC_MS_TRADE_SPS_UPDATED,
} from '../kafka-topics.js';
import type {
  CreateSpsCertificateInput,
  UpdateSpsCertificateInput,
  SpsCertificateFilterInput,
} from '../schemas/sps-certificate.schema.js';

const SERVICE_NAME = 'trade-sps-service';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class SpsCertificateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSpsCertificateInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const certificate = await (this.prisma as any).spsCertificate.create({
      data: {
        tenantId: user.tenantId,
        certificateNumber: dto.certificateNumber,
        consignmentId: dto.consignmentId,
        exporterId: dto.exporterId,
        importerId: dto.importerId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        quantity: dto.quantity,
        unit: dto.unit,
        originCountryId: dto.originCountryId,
        destinationCountryId: dto.destinationCountryId,
        inspectionResult: dto.inspectionResult ?? 'PENDING',
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
        certifiedBy: dto.certifiedBy,
        certifiedAt: dto.certifiedAt ? new Date(dto.certifiedAt) : undefined,
        status: 'DRAFT',
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        remarks: dto.remarks,
        dataClassification: dto.dataClassification ?? 'RESTRICTED',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('SpsCertificate', certificate.id, 'CREATE', user, 'RESTRICTED', {
      newVersion: certificate,
    });

    await this.publishEvent(TOPIC_MS_TRADE_SPS_CERTIFIED, certificate, user);

    return { data: certificate };
  }

  async findAll(
    user: AuthenticatedUser,
    query: SpsCertificateFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).spsCertificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).spsCertificate.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const certificate = await (this.prisma as any).spsCertificate.findUnique({
      where: { id },
    });

    if (!certificate) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      certificate.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    return { data: certificate };
  }

  async update(
    id: string,
    dto: UpdateSpsCertificateInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).spsCertificate.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    const certificate = await (this.prisma as any).spsCertificate.update({
      where: { id },
      data: {
        ...(dto.certificateNumber !== undefined && { certificateNumber: dto.certificateNumber }),
        ...(dto.consignmentId !== undefined && { consignmentId: dto.consignmentId }),
        ...(dto.exporterId !== undefined && { exporterId: dto.exporterId }),
        ...(dto.importerId !== undefined && { importerId: dto.importerId }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.commodity !== undefined && { commodity: dto.commodity }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.originCountryId !== undefined && { originCountryId: dto.originCountryId }),
        ...(dto.destinationCountryId !== undefined && { destinationCountryId: dto.destinationCountryId }),
        ...(dto.inspectionResult !== undefined && { inspectionResult: dto.inspectionResult }),
        ...(dto.inspectionDate !== undefined && { inspectionDate: new Date(dto.inspectionDate) }),
        ...(dto.certifiedBy !== undefined && { certifiedBy: dto.certifiedBy }),
        ...(dto.validUntil !== undefined && { validUntil: new Date(dto.validUntil) }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    this.audit.log('SpsCertificate', certificate.id, 'UPDATE', user, 'RESTRICTED', {
      previousVersion: existing,
      newVersion: certificate,
    });

    await this.publishEvent(TOPIC_MS_TRADE_SPS_UPDATED, certificate, user);

    return { data: certificate };
  }

  /**
   * Transition an SPS certificate from DRAFT to ISSUED.
   * Sets certifiedAt to now and status to ISSUED.
   * Throws 400 if the certificate is already ISSUED.
   */
  async issue(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).spsCertificate.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `SPS certificate ${id} not found`);
    }

    if (existing.status === 'ISSUED') {
      throw new HttpError(400, `SPS certificate ${id} is already ISSUED`);
    }

    const certificate = await (this.prisma as any).spsCertificate.update({
      where: { id },
      data: {
        status: 'ISSUED',
        certifiedAt: new Date(),
        certifiedBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('SpsCertificate', certificate.id, 'VALIDATE', user, 'RESTRICTED', {
      previousVersion: existing,
      newVersion: certificate,
      reason: 'Certificate issued',
    });

    await this.publishEvent(TOPIC_MS_TRADE_SPS_CERTIFIED, certificate, user);

    return { data: certificate };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: SpsCertificateFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.originCountryId) where['originCountryId'] = query.originCountryId;
    if (query.destinationCountryId) where['destinationCountryId'] = query.destinationCountryId;
    if (query.inspectionResult) where['inspectionResult'] = query.inspectionResult;
    if (query.status) where['status'] = query.status;

    if (query.periodStart || query.periodEnd) {
      where['inspectionDate'] = {};
      if (query.periodStart) {
        (where['inspectionDate'] as Record<string, unknown>)['gte'] = new Date(query.periodStart);
      }
      if (query.periodEnd) {
        (where['inspectionDate'] as Record<string, unknown>)['lte'] = new Date(query.periodEnd);
      }
    }

    return where;
  }

  private async publishEvent(
    topic: string,
    payload: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, payload.id, payload, headers);
    } catch (error) {
      console.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
