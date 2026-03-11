import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
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
import type { AuditService } from './audit.service';
import type {
  CreateTrainingInput,
  UpdateTrainingInput,
  TrainingFilterInput,
} from '../schemas/training.schema';
import {
  TOPIC_MS_APICULTURE_TRAINING_CREATED,
  TOPIC_MS_APICULTURE_TRAINING_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TrainingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTrainingInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const training = await (this.prisma as any).beekeeperTraining.create({
      data: {
        beekeeperId: dto.beekeeperId,
        trainingType: dto.trainingType,
        completedDate: dto.completedDate,
        certificationNumber: dto.certificationNumber,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('BeekeeperTraining', training.id, 'CREATE', user, classification as any, {
      newVersion: training as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_TRAINING_CREATED, training, user);

    console.log(`[TrainingService] Beekeeper training created: ${training.id} (beekeeper=${dto.beekeeperId})`);
    return { data: training };
  }

  async findAll(
    user: AuthenticatedUser,
    query: TrainingFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).beekeeperTraining.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).beekeeperTraining.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const training = await (this.prisma as any).beekeeperTraining.findUnique({
      where: { id },
    });

    if (!training) {
      throw new HttpError(404, `Beekeeper training ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      training.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Beekeeper training ${id} not found`);
    }

    return { data: training };
  }

  async update(
    id: string,
    dto: UpdateTrainingInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).beekeeperTraining.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Beekeeper training ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Beekeeper training ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.beekeeperId !== undefined) updateData['beekeeperId'] = dto.beekeeperId;
    if (dto.trainingType !== undefined) updateData['trainingType'] = dto.trainingType;
    if (dto.completedDate !== undefined) updateData['completedDate'] = dto.completedDate;
    if (dto.certificationNumber !== undefined) updateData['certificationNumber'] = dto.certificationNumber;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).beekeeperTraining.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'BeekeeperTraining',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_TRAINING_UPDATED, updated, user);

    console.log(`[TrainingService] Beekeeper training updated: ${id}`);
    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: TrainingFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.beekeeperId) where['beekeeperId'] = query.beekeeperId;
    if (query.trainingType) where['trainingType'] = query.trainingType;

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
