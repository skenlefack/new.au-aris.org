import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_AU_KNOWLEDGE_ELEARNING_CREATED,
  TOPIC_AU_KNOWLEDGE_ELEARNING_UPDATED,
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
import type { ELearningModuleEntity } from '../elearning/entities/elearning-module.entity';
import type { LearnerProgressEntity } from '../elearning/entities/learner-progress.entity';
import type {
  CreateELearningInput,
  UpdateELearningInput,
  ELearningFilterInput,
  UpdateProgressInput,
} from '../schemas/knowledge.schema';

const SERVICE_NAME = 'knowledge-hub-service';

export class ELearningService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateELearningInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    const module = await (this.prisma as any).eLearningModule.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        description: dto.description ?? null,
        domain: dto.domain,
        lessons: dto.lessons as unknown as Prisma.InputJsonValue,
        estimatedDuration: dto.estimatedDuration,
        prerequisiteIds: dto.prerequisiteIds ?? [],
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        dataClassification: dto.dataClassification ?? DataClassification.PUBLIC,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_ELEARNING_CREATED,
      module,
      user,
    );

    console.log(`[ELearningService] E-Learning module created: ${module.title} (${module.id})`);
    return { data: module as ELearningModuleEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: ELearningFilterInput,
  ): Promise<PaginatedResponse<ELearningModuleEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'asc' as const };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
      ...(query.domain !== undefined && { domain: query.domain }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).eLearningModule.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).eLearningModule.count({ where }),
    ]);

    return {
      data: data as ELearningModuleEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    const module = await (this.prisma as any).eLearningModule.findUnique({
      where: { id },
    });

    if (!module) {
      const error = new Error(`E-Learning module ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.verifyTenantAccess(user, module.tenantId);

    return { data: module as ELearningModuleEntity };
  }

  async update(
    id: string,
    dto: UpdateELearningInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    const existing = await (this.prisma as any).eLearningModule.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error(`E-Learning module ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const module = await (this.prisma as any).eLearningModule.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.lessons !== undefined && { lessons: dto.lessons as unknown as Prisma.InputJsonValue }),
        ...(dto.estimatedDuration !== undefined && { estimatedDuration: dto.estimatedDuration }),
        ...(dto.prerequisiteIds !== undefined && { prerequisiteIds: dto.prerequisiteIds }),
        ...(dto.publishedAt !== undefined && { publishedAt: new Date(dto.publishedAt) }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_AU_KNOWLEDGE_ELEARNING_UPDATED,
      module,
      user,
    );

    console.log(`[ELearningService] E-Learning module updated: ${module.title} (${module.id})`);
    return { data: module as ELearningModuleEntity };
  }

  async enroll(
    moduleId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    // Verify module exists
    const module = await (this.prisma as any).eLearningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      const error = new Error(`E-Learning module ${moduleId} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check if already enrolled
    const existing = await (this.prisma as any).learnerProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: user.userId,
          moduleId,
        },
      },
    });

    if (existing) {
      return { data: existing as LearnerProgressEntity };
    }

    // Create new enrollment
    const progress = await (this.prisma as any).learnerProgress.create({
      data: {
        userId: user.userId,
        moduleId,
        completedLessons: [] as unknown as Prisma.InputJsonValue,
        score: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    console.log(`[ELearningService] User ${user.userId} enrolled in module ${moduleId}`);
    return { data: progress as LearnerProgressEntity };
  }

  async updateProgress(
    moduleId: string,
    dto: UpdateProgressInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    // Find existing enrollment
    const existing = await (this.prisma as any).learnerProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: user.userId,
          moduleId,
        },
      },
    });

    if (!existing) {
      const error = new Error(
        `No enrollment found for user ${user.userId} in module ${moduleId}`,
      ) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Get module to determine total lesson count
    const module = await (this.prisma as any).eLearningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      const error = new Error(`E-Learning module ${moduleId} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Parse lessons JSON to get total count
    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    const totalLessons = lessons.length;

    // Build update data
    const updateData: Record<string, unknown> = {
      completedLessons: dto.completedLessons as unknown as Prisma.InputJsonValue,
    };

    if (dto.score !== undefined) {
      updateData['score'] = dto.score;
    }

    // If all lessons completed, set completedAt
    if (dto.completedLessons.length >= totalLessons && totalLessons > 0) {
      updateData['completedAt'] = new Date();
    }

    const progress = await (this.prisma as any).learnerProgress.update({
      where: {
        userId_moduleId: {
          userId: user.userId,
          moduleId,
        },
      },
      data: updateData,
    });

    console.log(
      `[ELearningService] Progress updated for user ${user.userId} in module ${moduleId}: ${dto.completedLessons.length}/${totalLessons} lessons`,
    );
    return { data: progress as LearnerProgressEntity };
  }

  async getMyCourses(
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity[]>> {
    const progressList = await (this.prisma as any).learnerProgress.findMany({
      where: { userId: user.userId },
      include: { module: true },
    });

    return { data: progressList as LearnerProgressEntity[] };
  }

  /**
   * Build Prisma where clause based on user's tenant level.
   * - CONTINENTAL: sees all modules
   * - REC: sees own tenant's modules
   * - MEMBER_STATE: sees only own tenant's modules
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
   * Verify user has access to the requested module's tenant.
   * Throws 404 if not authorized (to avoid leaking entity existence).
   */
  private verifyTenantAccess(
    user: AuthenticatedUser,
    resourceTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return; // AU-IBAR sees everything
    }

    if (resourceTenantId === user.tenantId) {
      return; // Own tenant
    }

    const error = new Error('E-Learning module not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  private async publishEvent(
    topic: string,
    entity: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, entity.id as string, entity, headers);
    } catch (err) {
      // Log but don't fail the request -- event publishing is best-effort
      console.error(
        `[ELearningService] Failed to publish ${topic} for e-learning module ${entity.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
