import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
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
import { AuditService } from '../audit.service';
import { CreateBeekeeperTrainingDto } from './dto/create-training.dto';
import { UpdateBeekeeperTrainingDto } from './dto/update-training.dto';
import type { TrainingFilterDto } from './dto/training-filter.dto';
import type { BeekeeperTrainingEntity } from './entities/training.entity';
import {
  TOPIC_MS_APICULTURE_TRAINING_CREATED,
  TOPIC_MS_APICULTURE_TRAINING_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateBeekeeperTrainingDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const training = await this.prisma.beekeeperTraining.create({
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

    this.audit.log('BeekeeperTraining', training.id, 'CREATE', user, classification, {
      newVersion: training as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_TRAINING_CREATED, training, user);

    this.logger.log(`Beekeeper training created: ${training.id} (beekeeper=${dto.beekeeperId})`);
    return { data: training as BeekeeperTrainingEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: TrainingFilterDto,
  ): Promise<PaginatedResponse<BeekeeperTrainingEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.beekeeperTraining.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.beekeeperTraining.count({ where }),
    ]);

    return {
      data: data as BeekeeperTrainingEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    const training = await this.prisma.beekeeperTraining.findUnique({
      where: { id },
    });

    if (!training) {
      throw new NotFoundException(`Beekeeper training ${id} not found`);
    }

    this.verifyTenantAccess(user, training.tenantId);

    return { data: training as BeekeeperTrainingEntity };
  }

  async update(
    id: string,
    dto: UpdateBeekeeperTrainingDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<BeekeeperTrainingEntity>> {
    const existing = await this.prisma.beekeeperTraining.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Beekeeper training ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.beekeeperId !== undefined) updateData['beekeeperId'] = dto.beekeeperId;
    if (dto.trainingType !== undefined) updateData['trainingType'] = dto.trainingType;
    if (dto.completedDate !== undefined) updateData['completedDate'] = dto.completedDate;
    if (dto.certificationNumber !== undefined) updateData['certificationNumber'] = dto.certificationNumber;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.beekeeperTraining.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'BeekeeperTraining',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_TRAINING_UPDATED, updated, user);

    this.logger.log(`Beekeeper training updated: ${id}`);
    return { data: updated as BeekeeperTrainingEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: TrainingFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Tenant scoping
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      // REC sees own + children — service-level filter
      // Phase 2: resolve child tenantIds from tenant service
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter (sees all)

    if (filter.beekeeperId) where['beekeeperId'] = filter.beekeeperId;
    if (filter.trainingType) where['trainingType'] = filter.trainingType;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Beekeeper training not found');
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
      await this.kafkaProducer.send(topic, payload.id, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for training ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
