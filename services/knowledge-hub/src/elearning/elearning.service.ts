import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
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
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { CreateELearningModuleDto } from './dto/create-elearning-module.dto';
import { UpdateELearningModuleDto } from './dto/update-elearning-module.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import type { ELearningModuleEntity } from './entities/elearning-module.entity';
import type { LearnerProgressEntity } from './entities/learner-progress.entity';

const SERVICE_NAME = 'knowledge-hub-service';

@Injectable()
export class ELearningService {
  private readonly logger = new Logger(ELearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(
    dto: CreateELearningModuleDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    const module = await this.prisma.eLearningModule.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        description: dto.description ?? null,
        domain: dto.domain,
        lessons: dto.lessons as Prisma.InputJsonValue,
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

    this.logger.log(`E-Learning module created: ${module.title} (${module.id})`);
    return { data: module as ELearningModuleEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    domain?: string,
  ): Promise<PaginatedResponse<ELearningModuleEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'asc' as const };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
      ...(domain !== undefined && { domain }),
    };

    const [data, total] = await Promise.all([
      this.prisma.eLearningModule.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.eLearningModule.count({ where }),
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
    const module = await this.prisma.eLearningModule.findUnique({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException(`E-Learning module ${id} not found`);
    }

    this.verifyTenantAccess(user, module.tenantId);

    return { data: module as ELearningModuleEntity };
  }

  async update(
    id: string,
    dto: UpdateELearningModuleDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ELearningModuleEntity>> {
    const existing = await this.prisma.eLearningModule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`E-Learning module ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const module = await this.prisma.eLearningModule.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.lessons !== undefined && { lessons: dto.lessons as Prisma.InputJsonValue }),
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

    this.logger.log(`E-Learning module updated: ${module.title} (${module.id})`);
    return { data: module as ELearningModuleEntity };
  }

  async enroll(
    moduleId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    // Verify module exists
    const module = await this.prisma.eLearningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`E-Learning module ${moduleId} not found`);
    }

    // Check if already enrolled
    const existing = await this.prisma.learnerProgress.findUnique({
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
    const progress = await this.prisma.learnerProgress.create({
      data: {
        userId: user.userId,
        moduleId,
        completedLessons: [] as Prisma.InputJsonValue,
        score: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    this.logger.log(`User ${user.userId} enrolled in module ${moduleId}`);
    return { data: progress as LearnerProgressEntity };
  }

  async updateProgress(
    moduleId: string,
    dto: UpdateProgressDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity>> {
    // Find existing enrollment
    const existing = await this.prisma.learnerProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: user.userId,
          moduleId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `No enrollment found for user ${user.userId} in module ${moduleId}`,
      );
    }

    // Get module to determine total lesson count
    const module = await this.prisma.eLearningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`E-Learning module ${moduleId} not found`);
    }

    // Parse lessons JSON to get total count
    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    const totalLessons = lessons.length;

    // Build update data
    const updateData: Record<string, unknown> = {
      completedLessons: dto.completedLessons as Prisma.InputJsonValue,
    };

    if (dto.score !== undefined) {
      updateData['score'] = dto.score;
    }

    // If all lessons completed, set completedAt
    if (dto.completedLessons.length >= totalLessons && totalLessons > 0) {
      updateData['completedAt'] = new Date();
    }

    const progress = await this.prisma.learnerProgress.update({
      where: {
        userId_moduleId: {
          userId: user.userId,
          moduleId,
        },
      },
      data: updateData,
    });

    this.logger.log(
      `Progress updated for user ${user.userId} in module ${moduleId}: ${dto.completedLessons.length}/${totalLessons} lessons`,
    );
    return { data: progress as LearnerProgressEntity };
  }

  async getMyCourses(
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LearnerProgressEntity[]>> {
    const progressList = await this.prisma.learnerProgress.findMany({
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
   * Throws NotFoundException if not authorized (to avoid leaking entity existence).
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

    throw new NotFoundException(`E-Learning module not found`);
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
      await this.kafkaProducer.send(topic, entity.id as string, entity, headers);
    } catch (error) {
      // Log but don't fail the request -- event publishing is best-effort
      this.logger.error(
        `Failed to publish ${topic} for e-learning module ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
