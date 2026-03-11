import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
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

const SERVICE_NAME = 'data-quality-service';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class CorrectionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  /**
   * Checks for overdue corrections and escalations.
   * Called by setInterval (no @Cron decorator).
   */
  async handleOverdueCorrections(): Promise<void> {
    console.log('[CorrectionService] Checking overdue corrections...');

    const now = new Date();

    // 1. Find PENDING trackers past correction deadline -> mark ESCALATED
    const overdueForEscalation = await (this.prisma as any).correctionTracker.findMany({
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
      await (this.prisma as any).correctionTracker.update({
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

    // 2. Find ESCALATED trackers past escalation deadline -> mark EXPIRED
    const overdueForExpiry = await (this.prisma as any).correctionTracker.findMany({
      where: {
        status: 'ESCALATED',
        escalationDeadline: { lt: now },
      },
    });

    let expiredCount = 0;
    for (const tracker of overdueForExpiry) {
      await (this.prisma as any).correctionTracker.update({
        where: { id: tracker.id },
        data: { status: 'EXPIRED' },
      });
      expiredCount++;
    }

    if (escalatedCount > 0 || expiredCount > 0) {
      console.warn(
        `[CorrectionService] Cron completed: ${escalatedCount} escalated, ${expiredCount} expired`,
      );
    } else {
      console.log('[CorrectionService] Cron completed: no overdue corrections found');
    }
  }

  /**
   * Mark a correction as CORRECTED (called after re-validation passes).
   */
  async markCorrected(
    reportId: string,
  ): Promise<ApiResponse<any>> {
    const tracker = await (this.prisma as any).correctionTracker.findUnique({
      where: { reportId },
    });

    if (!tracker) {
      throw new HttpError(404, `Correction tracker for report ${reportId} not found`);
    }

    if (tracker.status === 'CORRECTED') {
      return { data: tracker };
    }

    const updated = await (this.prisma as any).correctionTracker.update({
      where: { id: tracker.id },
      data: {
        status: 'CORRECTED',
        correctedAt: new Date(),
      },
    });

    console.log(
      `[CorrectionService] Correction completed for report ${reportId} (tracker ${tracker.id})`,
    );

    return { data: updated };
  }

  /**
   * Assign a correction to a user (Data Steward).
   */
  async assign(
    reportId: string,
    assignedTo: string,
  ): Promise<ApiResponse<any>> {
    const tracker = await (this.prisma as any).correctionTracker.findUnique({
      where: { reportId },
    });

    if (!tracker) {
      throw new HttpError(404, `Correction tracker for report ${reportId} not found`);
    }

    const updated = await (this.prisma as any).correctionTracker.update({
      where: { id: tracker.id },
      data: { assignedTo },
    });

    console.log(
      `[CorrectionService] Correction for report ${reportId} assigned to ${assignedTo}`,
    );

    return { data: updated };
  }

  /**
   * List corrections with filters.
   */
  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResponse<any>> {
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
      (this.prisma as any).correctionTracker.findMany({
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
      (this.prisma as any).correctionTracker.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  /**
   * Get a single correction by report ID.
   */
  async findByReportId(
    reportId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<any>> {
    const tracker = await (this.prisma as any).correctionTracker.findUnique({
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
      throw new HttpError(404, `Correction tracker for report ${reportId} not found`);
    }

    // Tenant isolation
    const report = tracker.report as { tenantId: string };
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      report.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Correction tracker for report ${reportId} not found`);
    }

    return { data: tracker };
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
      correlationId: randomUUID(),
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
      await this.kafka.send(
        TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
        tracker.reportId,
        payload,
        headers,
      );
    } catch (error) {
      console.error(
        `[CorrectionService] Failed to publish overdue correction event for report ${tracker.reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
