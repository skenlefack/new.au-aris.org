import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_SYS_PROGRAMME_CYCLE_OPENED,
  TOPIC_SYS_PROGRAMME_CYCLE_CLOSED,
  TOPIC_SYS_PROGRAMME_REPORT_SUBMITTED,
  TOPIC_SYS_PROGRAMME_REPORT_VALIDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'programme-monitoring-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class ReportingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ── Cycles ──

  async createCycle(programmeId: string, dto: any, user: AuthenticatedUser) {
    const programme = await (this.prisma as any).programme.findUnique({ where: { id: programmeId } });
    if (!programme) throw new HttpError(404, `Programme ${programmeId} not found`);

    const cycle = await (this.prisma as any).reportingCycle.create({
      data: {
        programmeId,
        cycleType: dto.cycleType,
        periodLabel: dto.periodLabel,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        deadline: new Date(dto.deadline),
        status: 'OPEN',
        createdBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_SYS_PROGRAMME_CYCLE_OPENED, cycle, user);

    return { data: cycle };
  }

  async findCycles(
    programmeId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { programmeId };

    const [data, total] = await Promise.all([
      (this.prisma as any).reportingCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodStart: 'desc' },
        include: {
          _count: { select: { reports: true } },
        },
      }),
      (this.prisma as any).reportingCycle.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findCycle(id: string) {
    const cycle = await (this.prisma as any).reportingCycle.findUnique({
      where: { id },
      include: {
        reports: {
          include: {
            items: {
              include: { activity: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        programme: { select: { id: true, code: true, name: true } },
      },
    });
    if (!cycle) throw new HttpError(404, `Cycle ${id} not found`);
    return { data: cycle };
  }

  async updateCycle(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).reportingCycle.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Cycle ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      updateData['status'] = dto.status;
      if (dto.status === 'VALIDATED' || dto.status === 'PUBLISHED') {
        updateData['consolidatedBy'] = user.userId;
        updateData['consolidatedAt'] = new Date();
      }
    }
    if (dto.narrative !== undefined) updateData['narrative'] = dto.narrative;

    const updated = await (this.prisma as any).reportingCycle.update({ where: { id }, data: updateData });

    if (dto.status === 'VALIDATED' || dto.status === 'PUBLISHED') {
      await this.publishEvent(TOPIC_SYS_PROGRAMME_CYCLE_CLOSED, updated, user);
    }

    return { data: updated };
  }

  // ── Reports ──

  async createReport(cycleId: string, dto: any, user: AuthenticatedUser) {
    const cycle = await (this.prisma as any).reportingCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new HttpError(404, `Cycle ${cycleId} not found`);
    if (cycle.status !== 'OPEN') throw new HttpError(400, 'Cycle is not open for reports');

    // Check if user already submitted for this cycle
    const existingReport = await (this.prisma as any).activityReport.findFirst({
      where: { cycleId, reportedBy: user.userId },
    });
    if (existingReport) throw new HttpError(409, 'You have already submitted a report for this cycle');

    const report = await (this.prisma as any).activityReport.create({
      data: {
        cycleId,
        reportedBy: user.userId,
        overallNote: dto.overallNote ?? null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // Create report items and update activity statuses
    for (const item of dto.items) {
      await (this.prisma as any).activityReportItem.create({
        data: {
          reportId: report.id,
          activityId: item.activityId,
          previousStatus: item.previousStatus,
          currentStatus: item.currentStatus,
          completionPercent: item.completionPercent,
          expenditureThisPeriod: item.expenditureThisPeriod ?? null,
          narrative: item.narrative ?? null,
          blockers: item.blockers ?? null,
          supportNeeded: item.supportNeeded ?? null,
          attachments: item.attachments ?? [],
        },
      });

      // Auto-update activity status and completion from latest report
      await (this.prisma as any).activity.update({
        where: { id: item.activityId },
        data: {
          status: item.currentStatus,
          completionPercent: item.completionPercent,
          updatedBy: user.userId,
        },
      });
    }

    await this.publishEvent(TOPIC_SYS_PROGRAMME_REPORT_SUBMITTED, { ...report, cycleId }, user);

    return { data: report };
  }

  async findReports(cycleId: string) {
    const data = await (this.prisma as any).activityReport.findMany({
      where: { cycleId },
      include: {
        items: {
          include: { activity: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return { data };
  }

  async validateReport(id: string, dto: any, user: AuthenticatedUser) {
    const report = await (this.prisma as any).activityReport.findUnique({ where: { id } });
    if (!report) throw new HttpError(404, `Report ${id} not found`);

    const updated = await (this.prisma as any).activityReport.update({
      where: { id },
      data: {
        status: dto.status, // VALIDATED | REJECTED
        validatedBy: user.userId,
        validatedAt: new Date(),
        validationComment: dto.validationComment ?? null,
      },
    });

    await this.publishEvent(TOPIC_SYS_PROGRAMME_REPORT_VALIDATED, updated, user);

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
