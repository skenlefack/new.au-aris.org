import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AuditService } from './audit.service.js';
import { TOPIC_SYS_PROGRAMME_ACTIVITY_UPDATED } from '../kafka-topics.js';

const SERVICE_NAME = 'programme-monitoring-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

// RAG status auto-calculation
function computeRagStatus(activity: {
  status: string;
  plannedEndDate: Date;
  completionPercent: number;
}): string {
  if (activity.status === 'NOT_STARTED') return 'GREY';
  if (activity.status === 'COMPLETED') return 'GREEN';
  if (activity.status === 'CANCELLED' || activity.status === 'ON_HOLD') return 'GREY';

  const now = new Date();
  const end = new Date(activity.plannedEndDate);
  const daysLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (activity.status === 'DELAYED') return 'RED';
  if (daysLeft < 0) return 'RED'; // Past due
  if (daysLeft < 15) return 'AMBER'; // Less than 15 days left
  return 'GREEN';
}

export class ActivityService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: any, user: AuthenticatedUser) {
    const ragStatus = computeRagStatus({
      status: dto.status ?? 'NOT_STARTED',
      plannedEndDate: new Date(dto.plannedEndDate),
      completionPercent: 0,
    });

    const activity = await (this.prisma as any).activity.create({
      data: {
        outputId: dto.outputId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
        responsibleUnit: dto.responsibleUnit ?? null,
        responsibleLevel: dto.responsibleLevel ?? 'CONTINENTAL',
        geoEntityId: dto.geoEntityId ?? null,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        status: dto.status ?? 'NOT_STARTED',
        priorityLevel: dto.priorityLevel ?? 'MEDIUM',
        completionPercent: 0,
        weightInOutput: dto.weightInOutput ?? null,
        procurementRequired: dto.procurementRequired ?? false,
        procurementStatus: dto.procurementStatus ?? null,
        ragStatus,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
      include: { output: true, subActivities: true, budgetLines: true, milestones: true },
    });

    this.audit.log('Activity', activity.id, 'CREATE', user, 'PARTNER' as any, {
      newVersion: activity as unknown as object,
    });

    return { data: activity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: any,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = {};

    if (filter.outputId) where['outputId'] = filter.outputId;
    if (filter.status) where['status'] = filter.status;
    if (filter.responsibleUserId) where['responsibleUserId'] = filter.responsibleUserId;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.priorityLevel) where['priorityLevel'] = filter.priorityLevel;
    if (filter.ragStatus) where['ragStatus'] = filter.ragStatus;

    // Filter by programmeId (join through output → component → programme)
    if (filter.programmeId) {
      where['output'] = {
        component: {
          programmeId: filter.programmeId,
        },
      };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).activity.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          output: { include: { component: { select: { id: true, code: true, name: true, programmeId: true } } } },
          subActivities: { orderBy: { code: 'asc' } },
          budgetLines: true,
          milestones: { orderBy: { dueDate: 'asc' } },
          _count: { select: { evidence: true, reportItems: true } },
        },
      }),
      (this.prisma as any).activity.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, _user: AuthenticatedUser) {
    const activity = await (this.prisma as any).activity.findUnique({
      where: { id },
      include: {
        output: { include: { component: { select: { id: true, code: true, name: true, programmeId: true } } } },
        subActivities: { orderBy: { code: 'asc' } },
        budgetLines: true,
        milestones: { orderBy: { dueDate: 'asc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
        reportItems: { orderBy: { createdAt: 'desc' }, take: 5, include: { report: { select: { id: true, cycleId: true, status: true } } } },
      },
    });

    if (!activity) {
      throw new HttpError(404, `Activity ${id} not found`);
    }

    return { data: activity };
  }

  async update(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).activity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Activity ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.responsibleUserId !== undefined) updateData['responsibleUserId'] = dto.responsibleUserId;
    if (dto.responsibleUnit !== undefined) updateData['responsibleUnit'] = dto.responsibleUnit;
    if (dto.responsibleLevel !== undefined) updateData['responsibleLevel'] = dto.responsibleLevel;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.plannedStartDate !== undefined) updateData['plannedStartDate'] = new Date(dto.plannedStartDate);
    if (dto.plannedEndDate !== undefined) updateData['plannedEndDate'] = new Date(dto.plannedEndDate);
    if (dto.actualStartDate !== undefined) updateData['actualStartDate'] = new Date(dto.actualStartDate);
    if (dto.actualEndDate !== undefined) updateData['actualEndDate'] = new Date(dto.actualEndDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.priorityLevel !== undefined) updateData['priorityLevel'] = dto.priorityLevel;
    if (dto.completionPercent !== undefined) updateData['completionPercent'] = dto.completionPercent;
    if (dto.weightInOutput !== undefined) updateData['weightInOutput'] = dto.weightInOutput;
    if (dto.procurementRequired !== undefined) updateData['procurementRequired'] = dto.procurementRequired;
    if (dto.procurementStatus !== undefined) updateData['procurementStatus'] = dto.procurementStatus;
    if (dto.delayReason !== undefined) updateData['delayReason'] = dto.delayReason;

    // Auto-calculate RAG status
    const newStatus = (dto.status ?? existing.status) as string;
    const newEnd = dto.plannedEndDate ? new Date(dto.plannedEndDate) : existing.plannedEndDate;
    const newCompletion = dto.completionPercent ?? existing.completionPercent;
    updateData['ragStatus'] = computeRagStatus({
      status: newStatus,
      plannedEndDate: newEnd,
      completionPercent: newCompletion,
    });

    // Auto-set actual dates
    if (dto.status === 'IN_PROGRESS' && !existing.actualStartDate && !dto.actualStartDate) {
      updateData['actualStartDate'] = new Date();
    }
    if (dto.status === 'COMPLETED' && !existing.actualEndDate && !dto.actualEndDate) {
      updateData['actualEndDate'] = new Date();
      updateData['completionPercent'] = 100;
    }

    const updated = await (this.prisma as any).activity.update({
      where: { id },
      data: updateData,
    });

    this.audit.log('Activity', id, 'UPDATE', user, 'PARTNER' as any, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    await this.publishEvent(TOPIC_SYS_PROGRAMME_ACTIVITY_UPDATED, updated, user);

    return { data: updated };
  }

  // ── Sub-Activities ──

  async createSubActivity(activityId: string, dto: any, user: AuthenticatedUser) {
    const activity = await (this.prisma as any).activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new HttpError(404, `Activity ${activityId} not found`);

    const sub = await (this.prisma as any).subActivity.create({
      data: {
        activityId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        status: 'NOT_STARTED',
        completionPercent: 0,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    return { data: sub };
  }

  async findSubActivities(activityId: string) {
    const data = await (this.prisma as any).subActivity.findMany({
      where: { activityId },
      orderBy: { code: 'asc' },
    });
    return { data };
  }

  async updateSubActivity(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).subActivity.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `SubActivity ${id} not found`);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };
    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.responsibleUserId !== undefined) updateData['responsibleUserId'] = dto.responsibleUserId;
    if (dto.plannedStartDate !== undefined) updateData['plannedStartDate'] = new Date(dto.plannedStartDate);
    if (dto.plannedEndDate !== undefined) updateData['plannedEndDate'] = new Date(dto.plannedEndDate);
    if (dto.actualStartDate !== undefined) updateData['actualStartDate'] = new Date(dto.actualStartDate);
    if (dto.actualEndDate !== undefined) updateData['actualEndDate'] = new Date(dto.actualEndDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.completionPercent !== undefined) updateData['completionPercent'] = dto.completionPercent;

    const updated = await (this.prisma as any).subActivity.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  // ── Milestones ──

  async createMilestone(activityId: string, dto: any, user: AuthenticatedUser) {
    const activity = await (this.prisma as any).activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new HttpError(404, `Activity ${activityId} not found`);

    const milestone = await (this.prisma as any).activityMilestone.create({
      data: {
        activityId,
        name: dto.name,
        dueDate: new Date(dto.dueDate),
        deliverable: dto.deliverable ?? null,
        status: 'PENDING',
      },
    });

    return { data: milestone };
  }

  async updateMilestone(id: string, dto: any, _user: AuthenticatedUser) {
    const existing = await (this.prisma as any).activityMilestone.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Milestone ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.dueDate !== undefined) updateData['dueDate'] = new Date(dto.dueDate);
    if (dto.deliverable !== undefined) updateData['deliverable'] = dto.deliverable;
    if (dto.status !== undefined) {
      updateData['status'] = dto.status;
      if (dto.status === 'COMPLETED') updateData['completedAt'] = new Date();
    }
    if (dto.evidenceUrl !== undefined) updateData['evidenceUrl'] = dto.evidenceUrl;

    const updated = await (this.prisma as any).activityMilestone.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  private async publishEvent(
    topic: string,
    payload: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await Promise.race([
        this.kafka.send(topic, payload.id, payload, headers),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000)),
      ]);
    } catch (error) {
      console.error(`Failed to publish ${topic}`, error);
    }
  }
}
