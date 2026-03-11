import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED,
  TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { PublicationEntity } from '../publication/entities/publication.entity';
import type { CreatePublicationInput, UpdatePublicationInput, PublicationFilterInput } from '../schemas/knowledge.schema';

const SERVICE_NAME = 'knowledge-hub-service';

interface PublicationFilters {
  domain?: string;
  type?: string;
  language?: string;
  tag?: string;
}

export class PublicationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreatePublicationInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    // Check for duplicate title within same tenant
    const existing = await (this.prisma as any).publication.findFirst({
      where: { title: dto.title, tenantId: user.tenantId },
    });
    if (existing) {
      const error = new Error(`Publication with title "${dto.title}" already exists`) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const publication = await (this.prisma as any).publication.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        abstract: dto.abstract ?? null,
        authors: dto.authors,
        domain: dto.domain,
        type: dto.type,
        fileId: dto.fileId ?? null,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        tags: dto.tags ?? [],
        language: dto.language ?? 'EN',
        dataClassification: dto.dataClassification ?? DataClassification.PUBLIC,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    // Publish Kafka event
    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_PUBLICATION_CREATED,
      publication,
      user,
    );

    console.log(`[PublicationService] Publication created: ${publication.title} (${publication.id})`);
    return { data: publication as PublicationEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PublicationFilterInput,
  ): Promise<PaginatedResponse<PublicationEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'asc' as const };

    // Build where clause based on user's tenant level + optional filters
    const filters: PublicationFilters = {
      domain: query.domain,
      type: query.type,
      language: query.language,
      tag: query.tag,
    };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
      ...(filters.domain !== undefined && { domain: filters.domain }),
      ...(filters.type !== undefined && { type: filters.type }),
      ...(filters.language !== undefined && { language: filters.language }),
      ...(filters.tag !== undefined && { tags: { has: filters.tag } }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).publication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).publication.count({ where }),
    ]);

    return {
      data: data as PublicationEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    const publication = await (this.prisma as any).publication.findUnique({
      where: { id },
    });

    if (!publication) {
      const error = new Error(`Publication ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify access: MS can only see own, REC can see self + children
    this.verifyTenantAccess(user, publication.tenantId);

    return { data: publication as PublicationEntity };
  }

  async update(
    id: string,
    dto: UpdatePublicationInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PublicationEntity>> {
    const existing = await (this.prisma as any).publication.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error(`Publication ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const publication = await (this.prisma as any).publication.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.abstract !== undefined && { abstract: dto.abstract }),
        ...(dto.authors !== undefined && { authors: dto.authors }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.fileId !== undefined && { fileId: dto.fileId }),
        ...(dto.publishedAt !== undefined && { publishedAt: new Date(dto.publishedAt) }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    // Publish Kafka event
    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_PUBLICATION_UPDATED,
      publication,
      user,
    );

    console.log(`[PublicationService] Publication updated: ${publication.title} (${publication.id})`);
    return { data: publication as PublicationEntity };
  }

  async download(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    const publication = await (this.prisma as any).publication.findUnique({
      where: { id },
    });

    if (!publication) {
      const error = new Error(`Publication ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.verifyTenantAccess(user, publication.tenantId);

    if (!publication.fileId) {
      const error = new Error(`Publication ${id} has no attached file`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const driveBaseUrl = process.env['DRIVE_SERVICE_URL'] ?? 'http://localhost:3007';
    const downloadUrl = `${driveBaseUrl}/api/v1/drive/files/${publication.fileId}/download`;

    return { data: { downloadUrl } };
  }

  /**
   * Build Prisma where clause based on user's tenant level.
   * - CONTINENTAL: sees all publications
   * - REC: sees own + children tenant publications
   * - MEMBER_STATE: sees only own tenant publications
   */
  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};

      case TenantLevel.REC:
        return {
          tenantId: user.tenantId,
        };

      case TenantLevel.MEMBER_STATE:
        return { tenantId: user.tenantId };

      default:
        return { tenantId: user.tenantId };
    }
  }

  /**
   * Verify user has access to the requested publication's tenant.
   * Throws 404 if not (security: don't reveal existence).
   */
  private verifyTenantAccess(
    user: AuthenticatedUser,
    resourceTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return; // AU-IBAR sees everything
    }

    if (user.tenantLevel === TenantLevel.REC) {
      // REC sees own tenant publications + children
      // In a full implementation, child tenant IDs would be resolved
      // For now, REC can see its own tenantId records
      if (resourceTenantId === user.tenantId) {
        return;
      }
    }

    if (resourceTenantId === user.tenantId) {
      return; // Own tenant
    }

    const error = new Error('Publication not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  private async publishEvent(
    topic: string,
    publication: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, publication.id as string, publication, headers);
    } catch (err) {
      // Log but don't fail the request — event publishing is best-effort
      console.error(
        `[PublicationService] Failed to publish ${topic} for publication ${publication.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
