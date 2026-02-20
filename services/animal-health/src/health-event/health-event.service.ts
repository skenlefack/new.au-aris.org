import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_UPDATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
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
import { CreateHealthEventDto } from './dto/create-health-event.dto';
import { UpdateHealthEventDto } from './dto/update-health-event.dto';
import type { HealthEventFilterDto } from './dto/health-event-filter.dto';
import type { HealthEventEntity } from './entities/health-event.entity';

const SERVICE_NAME = 'animal-health-service';

@Injectable()
export class HealthEventService {
  private readonly logger = new Logger(HealthEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateHealthEventDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const event = await this.prisma.healthEvent.create({
      data: {
        diseaseId: dto.diseaseId,
        eventType: dto.eventType,
        speciesIds: dto.speciesIds,
        dateOnset: dto.dateOnset ? new Date(dto.dateOnset) : null,
        dateSuspicion: new Date(dto.dateSuspicion),
        dateConfirmation: dto.dateConfirmation ? new Date(dto.dateConfirmation) : null,
        dateClosure: dto.dateClosure ? new Date(dto.dateClosure) : null,
        geoEntityId: dto.geoEntityId,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        holdingsAffected: dto.holdingsAffected,
        susceptible: dto.susceptible,
        cases: dto.cases,
        deaths: dto.deaths,
        killed: dto.killed,
        slaughtered: dto.slaughtered,
        controlMeasures: dto.controlMeasures ?? [],
        confidenceLevel: dto.confidenceLevel,
        dataClassification: classification,
        wahisReady: false,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('HealthEvent', event.id, 'CREATE', user, classification, {
      newVersion: event as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_HEALTH_EVENT_CREATED, event, user);

    this.logger.log(`Health event created: ${event.id} (disease=${dto.diseaseId})`);
    return { data: event as HealthEventEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: HealthEventFilterDto,
  ): Promise<PaginatedResponse<HealthEventEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.healthEvent.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.healthEvent.count({ where }),
    ]);

    return {
      data: data as HealthEventEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity & { labResults?: unknown[] }>> {
    const event = await this.prisma.healthEvent.findUnique({
      where: { id },
      include: { labResults: true },
    });

    if (!event) {
      throw new NotFoundException(`Health event ${id} not found`);
    }

    this.verifyTenantAccess(user, event.tenantId);

    return { data: event as unknown as HealthEventEntity & { labResults?: unknown[] } };
  }

  async update(
    id: string,
    dto: UpdateHealthEventDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    const existing = await this.prisma.healthEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Health event ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.eventType !== undefined) updateData['eventType'] = dto.eventType;
    if (dto.speciesIds !== undefined) updateData['speciesIds'] = dto.speciesIds;
    if (dto.dateOnset !== undefined) updateData['dateOnset'] = new Date(dto.dateOnset);
    if (dto.dateConfirmation !== undefined) updateData['dateConfirmation'] = new Date(dto.dateConfirmation);
    if (dto.dateClosure !== undefined) updateData['dateClosure'] = new Date(dto.dateClosure);
    if (dto.holdingsAffected !== undefined) updateData['holdingsAffected'] = dto.holdingsAffected;
    if (dto.susceptible !== undefined) updateData['susceptible'] = dto.susceptible;
    if (dto.cases !== undefined) updateData['cases'] = dto.cases;
    if (dto.deaths !== undefined) updateData['deaths'] = dto.deaths;
    if (dto.killed !== undefined) updateData['killed'] = dto.killed;
    if (dto.slaughtered !== undefined) updateData['slaughtered'] = dto.slaughtered;
    if (dto.controlMeasures !== undefined) updateData['controlMeasures'] = dto.controlMeasures;
    if (dto.confidenceLevel !== undefined) updateData['confidenceLevel'] = dto.confidenceLevel;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.healthEvent.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'HealthEvent',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_HEALTH_EVENT_UPDATED, updated, user);

    this.logger.log(`Health event updated: ${id}`);
    return { data: updated as HealthEventEntity };
  }

  async confirm(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HealthEventEntity>> {
    const existing = await this.prisma.healthEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Health event ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    if (existing.eventType === 'CONFIRMED') {
      throw new BadRequestException(`Health event ${id} is already confirmed`);
    }

    const confirmed = await this.prisma.healthEvent.update({
      where: { id },
      data: {
        eventType: 'CONFIRMED',
        confidenceLevel: 'CONFIRMED',
        dateConfirmation: new Date(),
        updatedBy: user.userId,
      },
    });

    this.audit.log(
      'HealthEvent',
      id,
      'VALIDATE',
      user,
      confirmed.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: confirmed as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_HEALTH_EVENT_CONFIRMED, confirmed, user);

    // Business rule: WOAH-listed disease + confirmed → outbreak alert
    await this.publishOutbreakAlertIfNeeded(confirmed, user);

    this.logger.log(`Health event confirmed: ${id}`);
    return { data: confirmed as HealthEventEntity };
  }

  /**
   * If disease is WOAH-listed and event is confirmed,
   * auto-publish rec.health.outbreak.alert.v1 for cross-border awareness.
   *
   * Phase 2: check Master Data for WOAH-listed flag on diseaseId.
   * For now, all confirmed events trigger the alert.
   */
  async publishOutbreakAlertIfNeeded(
    event: { id: string; eventType: string; diseaseId: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    if (event.eventType !== 'CONFIRMED') return;

    // TODO Phase 2: lookup diseaseId in Master Data → isWoahListed
    const isWoahListed = true;

    if (isWoahListed) {
      await this.publishEvent(TOPIC_REC_HEALTH_OUTBREAK_ALERT, event, user);
      this.logger.warn(`OUTBREAK ALERT published for event ${event.id} (disease=${event.diseaseId})`);
    }
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: HealthEventFilterDto,
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

    if (filter.diseaseId) where['diseaseId'] = filter.diseaseId;
    if (filter.status) where['eventType'] = filter.status;
    if (filter.speciesId) {
      where['speciesIds'] = { has: filter.speciesId };
    }
    if (filter.periodStart || filter.periodEnd) {
      where['dateSuspicion'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Health event not found');
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
        `Failed to publish ${topic} for event ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
