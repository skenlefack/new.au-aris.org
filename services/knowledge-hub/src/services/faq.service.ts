import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_AU_KNOWLEDGE_FAQ_CREATED,
  TOPIC_AU_KNOWLEDGE_FAQ_UPDATED,
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
import type { FaqEntity } from '../faq/entities/faq.entity';
import type { CreateFaqInput, UpdateFaqInput, FaqFilterInput } from '../schemas/knowledge.schema';

const SERVICE_NAME = 'knowledge-hub-service';

interface FaqFilters {
  domain?: string;
  language?: string;
}

export class FaqService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateFaqInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FaqEntity>> {
    const faq = await (this.prisma as any).fAQ.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        domain: dto.domain,
        language: dto.language ?? 'EN',
        sortOrder: dto.sortOrder ?? 0,
        dataClassification: dto.dataClassification ?? DataClassification.PUBLIC,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_FAQ_CREATED,
      faq,
      user,
    );

    console.log(`[FaqService] FAQ created: ${faq.id}`);
    return { data: faq as FaqEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: FaqFilterInput,
  ): Promise<PaginatedResponse<FaqEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { sortOrder: 'asc' as const };

    const filters: FaqFilters = {
      domain: query.domain,
      language: query.language,
    };

    const where = {
      ...this.buildTenantFilter(user),
      ...(filters.domain && { domain: filters.domain }),
      ...(filters.language && { language: filters.language }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).fAQ.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).fAQ.count({ where }),
    ]);

    return {
      data: data as FaqEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FaqEntity>> {
    const faq = await (this.prisma as any).fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      const error = new Error(`FAQ ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.verifyTenantAccess(user, faq.tenantId);

    return { data: faq as FaqEntity };
  }

  async update(
    id: string,
    dto: UpdateFaqInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FaqEntity>> {
    const existing = await (this.prisma as any).fAQ.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error(`FAQ ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const faq = await (this.prisma as any).fAQ.update({
      where: { id },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_FAQ_UPDATED,
      faq,
      user,
    );

    console.log(`[FaqService] FAQ updated: ${faq.id}`);
    return { data: faq as FaqEntity };
  }

  /**
   * Build Prisma where clause based on user's tenant level.
   * - CONTINENTAL: sees all FAQs
   * - REC: sees own tenant + children
   * - MEMBER_STATE: sees only own tenant
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
   * Verify user has access to the requested FAQ's tenant.
   * Throws 404 if not (masking forbidden as not found).
   */
  private verifyTenantAccess(
    user: AuthenticatedUser,
    faqTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return; // AU-IBAR sees everything
    }

    if (faqTenantId === user.tenantId) {
      return; // Own tenant
    }

    const error = new Error('FAQ not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  private async publishEvent(
    topic: string,
    faq: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, faq.id as string, faq, headers);
    } catch (err) {
      // Log but don't fail the request — event publishing is best-effort
      console.error(
        `[FaqService] Failed to publish ${topic} for FAQ ${faq.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
