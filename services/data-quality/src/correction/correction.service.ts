import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
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

const SERVICE_NAME = 'data-quality-service';

export interface CorrectionEntity {
  id: string;
  reportId: string;
  status: string;
  correctionDeadline: Date;
  escalationDeadline: Date;
  correctedAt: Date | null;
  escalatedAt: Date | null;
  notifiedAt: Date | null;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CorrectionService {
  private readonly logger = new Logger(CorrectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Cron job: runs every 15 minutes.
   * Checks for overdue corrections and escalations.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleOverdueCorrections(): Promise<void> {
    this.logger.log('Cron: checking overdue corrections...');

    const now = new Date();

    // 1. Find PENDING trackers past correction deadline → mark ESCALATED
    const overdueForEscalation = await this.prisma.correctionTracker.findMany({
      where: {
        status: 'PENDING',
        correctionDeadline: { lt: now },
      },
      include: {
        report: {
          select: {
            id: true,
            recordId: true,
            domain: true,
            entityType: true,
            tenantId: true,
            submittedBy: true,
          },
        },
      },
    });

    let escalatedCount = 0;
    for (const tracker of overdueForEscalation) {
      await this.prisma.correctionTracker.update({
        where: { id: tracker.id },
        data: {
          status: 'ESCALATED',
          escalatedAt: now,
        },
      });

      // Publish overdue event
      await this.publishOverdueEvent(tracker);
      escalatedCount++;
    }

    // 2. Find ESCALATED trackers past escalation deadline → mark EXPIRED
    const overdueForExpiry = await this.prisma.correctionTracker.findMany({
      where: {
        status: 'ESCALATED',
        escalationDeadline: { lt: now },
      },
    });

    let expiredCount = 0;
    for (const tracker of overdueForExpiry) {
      await this.prisma.correctionTracker.update({
        where: { id: tracker.id },
        data: { status: 'EXPIRED' },
      });
      expiredCount++;
    }

    if (escalatedCount > 0 || expiredCount > 0) {
      this.logger.warn(
        `Cron completed: ${escalatedCount} escalated, ${expiredCount} expired`,
      );
    } else {
      this.logger.log('Cron completed: no overdue corrections found');
    }
  }

  /**
   * Mark a correction as CORRECTED (called after re-validation passes).
   */
  async markCorrected(
    reportId: string,
  ): Promise<ApiResponse<CorrectionEntity>> {
    const tracker = await this.prisma.correctionTracker.findUnique({
      where: { reportId },
    });

    if (!tracker) {
      throw new NotFoundException(
        `Correction tracker for report ${reportId} not found`,
      );
    }

    if (tracker.status === 'CORRECTED') {
      return { data: tracker as unknown as CorrectionEntity };
    }

    const updated = await this.prisma.correctionTracker.update({
      where: { id: tracker.id },
      data: {
        status: 'CORRECTED',
        correctedAt: new Date(),
      },
    });

    this.logger.log(
      `Correction completed for report ${reportId} (tracker ${tracker.id})`,
    );

    return { data: updated as unknown as CorrectionEntity };
  }

  /**
   * Assign a correction to a user (Data Steward).
   */
  async assign(
    reportId: string,
    assignedTo: string,
  ): Promise<ApiResponse<CorrectionEntity>> {
    const tracker = await this.prisma.correctionTracker.findUnique({
      where: { reportId },
    });

    if (!tracker) {
      throw new NotFoundException(
        `Correction tracker for report ${reportId} not found`,
      );
    }

    const updated = await this.prisma.correctionTracker.update({
      where: { id: tracker.id },
      data: { assignedTo },
    });

    this.logger.log(
      `Correction for report ${reportId} assigned to ${assignedTo}`,
    );

    return { data: updated as unknown as CorrectionEntity };
  }

  /**
   * List corrections with filters.
   */
  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResponse<CorrectionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Tenant isolation via report relation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['report'] = { tenantId: user.tenantId };
    }

    if (query.status) where['status'] = query.status;

    const [data, total] = await Promise.all([
      this.prisma.correctionTracker.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          report: {
            select: {
              id: true,
              recordId: true,
              domain: true,
              entityType: true,
              overallStatus: true,
            },
          },
        },
      }),
      this.prisma.correctionTracker.count({ where }),
    ]);

    return {
      data: data as unknown as CorrectionEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Get a single correction by report ID.
   */
  async findByReportId(
    reportId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CorrectionEntity>> {
    const tracker = await this.prisma.correctionTracker.findUnique({
      where: { reportId },
      include: {
        report: {
          select: {
            id: true,
            recordId: true,
            domain: true,
            entityType: true,
            tenantId: true,
            overallStatus: true,
          },
        },
      },
    });

    if (!tracker) {
      throw new NotFoundException(
        `Correction tracker for report ${reportId} not found`,
      );
    }

    // Tenant isolation
    const report = tracker.report as unknown as { tenantId: string };
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      report.tenantId !== user.tenantId
    ) {
      throw new NotFoundException(
        `Correction tracker for report ${reportId} not found`,
      );
    }

    return { data: tracker as unknown as CorrectionEntity };
  }

  private async publishOverdueEvent(
    tracker: {
      id: string;
      reportId: string;
      correctionDeadline: Date;
      escalationDeadline: Date;
      report: {
        id: string;
        recordId: string;
        domain: string;
        entityType: string;
        tenantId: string;
        submittedBy: string | null;
      };
    },
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: tracker.report.tenantId,
      userId: 'system',
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      trackerId: tracker.id,
      reportId: tracker.reportId,
      recordId: tracker.report.recordId,
      domain: tracker.report.domain,
      entityType: tracker.report.entityType,
      tenantId: tracker.report.tenantId,
      submittedBy: tracker.report.submittedBy,
      correctionDeadline: tracker.correctionDeadline.toISOString(),
      escalationDeadline: tracker.escalationDeadline.toISOString(),
      escalatedAt: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(
        TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
        tracker.reportId,
        payload,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish overdue correction event for report ${tracker.reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
