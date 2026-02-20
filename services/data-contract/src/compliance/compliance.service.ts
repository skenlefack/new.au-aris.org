import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TenantLevel } from '@aris/shared-types';
import type { ApiResponse } from '@aris/shared-types';
import type {
  ComplianceMetrics,
  ComplianceRecordEntity,
  QualitySla,
} from '../contract/entities/contract.entity';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCompliance(
    contractId: string,
    user: AuthenticatedUser,
    periodDays = 30,
  ): Promise<ApiResponse<ComplianceMetrics>> {
    const contract = await this.prisma.dataContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    this.verifyTenantAccess(user, contract.tenant_id);

    const periodFrom = new Date();
    periodFrom.setDate(periodFrom.getDate() - periodDays);
    const periodTo = new Date();

    const records = await this.prisma.complianceRecord.findMany({
      where: {
        contract_id: contractId,
        created_at: { gte: periodFrom, lte: periodTo },
      },
    });

    const metrics = this.calculateMetrics(
      contractId,
      contract.name,
      contract.timeliness_sla,
      contract.quality_sla as QualitySla,
      records,
      periodFrom,
      periodTo,
    );

    return { data: metrics };
  }

  /**
   * Calculate SLA compliance metrics from a set of compliance records.
   * Exported for direct unit testing.
   */
  calculateMetrics(
    contractId: string,
    contractName: string,
    timelinessSla: number,
    qualitySla: QualitySla,
    records: Array<{
      timeliness_hours: number | null;
      sla_met: boolean | null;
      quality_passed: boolean | null;
      submission_time: Date | null;
    }>,
    periodFrom: Date,
    periodTo: Date,
  ): ComplianceMetrics {
    const totalSubmissions = records.length;

    // Timeliness
    const recordsWithTimeliness = records.filter(
      (r) => r.timeliness_hours !== null,
    );
    const onTimeSubmissions = recordsWithTimeliness.filter(
      (r) => r.sla_met === true,
    ).length;
    const lateSubmissions = recordsWithTimeliness.filter(
      (r) => r.sla_met === false,
    ).length;

    const totalHours = recordsWithTimeliness.reduce(
      (sum, r) => sum + (r.timeliness_hours ?? 0),
      0,
    );
    const averageTimelinessHours =
      recordsWithTimeliness.length > 0
        ? totalHours / recordsWithTimeliness.length
        : 0;

    const timelinessRate =
      recordsWithTimeliness.length > 0
        ? onTimeSubmissions / recordsWithTimeliness.length
        : 1; // No records = compliant by default

    // Quality
    const recordsWithQuality = records.filter(
      (r) => r.quality_passed !== null,
    );
    const qualityPassCount = recordsWithQuality.filter(
      (r) => r.quality_passed === true,
    ).length;
    const qualityFailCount = recordsWithQuality.filter(
      (r) => r.quality_passed === false,
    ).length;

    const qualityPassRate =
      recordsWithQuality.length > 0
        ? qualityPassCount / recordsWithQuality.length
        : 1;

    // Overdue: records submitted but without submission_time (still pending)
    const overdueCount = records.filter(
      (r) => r.submission_time === null,
    ).length;

    // SLA met overall: timeliness rate above threshold AND quality pass rate above min
    const slaMet =
      timelinessRate >= 0.9 && qualityPassRate >= qualitySla.minPassRate;

    // At risk: quality pass rate near min threshold or timeliness trending down
    const atRisk =
      !slaMet ||
      qualityPassRate < qualitySla.minPassRate + 0.1 ||
      averageTimelinessHours > timelinessSla * 0.8;

    return {
      contractId,
      contractName,
      period: { from: periodFrom, to: periodTo },
      totalSubmissions,
      onTimeSubmissions,
      lateSubmissions,
      timelinessRate: round(timelinessRate, 4),
      qualityPassCount,
      qualityFailCount,
      qualityPassRate: round(qualityPassRate, 4),
      averageTimelinessHours: round(averageTimelinessHours, 2),
      slaMet,
      overdueCount,
      atRisk,
    };
  }

  /**
   * Record a submission event against a contract for compliance tracking.
   * Called by the Kafka consumer when form.submitted events arrive.
   */
  async recordSubmission(params: {
    contractId: string;
    tenantId: string;
    recordId: string;
    eventType: string;
    eventTimestamp: Date;
    submissionTime: Date;
  }): Promise<void> {
    const contract = await this.prisma.dataContract.findUnique({
      where: { id: params.contractId },
    });

    if (!contract) {
      this.logger.warn(
        `Compliance: contract ${params.contractId} not found, skipping`,
      );
      return;
    }

    const timelinessHours =
      (params.submissionTime.getTime() - params.eventTimestamp.getTime()) /
      (1000 * 60 * 60);
    const slaMet = timelinessHours <= contract.timeliness_sla;

    await this.prisma.complianceRecord.create({
      data: {
        contract_id: params.contractId,
        tenant_id: params.tenantId,
        record_id: params.recordId,
        event_type: params.eventType,
        event_timestamp: params.eventTimestamp,
        submission_time: params.submissionTime,
        timeliness_hours: round(timelinessHours, 2),
        sla_met: slaMet,
      },
    });

    if (!slaMet) {
      this.logger.warn(
        `SLA breach: contract ${contract.name} — record ${params.recordId} took ${round(timelinessHours, 1)}h (limit: ${contract.timeliness_sla}h)`,
      );
    }
  }

  /**
   * Record a quality gate result against a contract for compliance tracking.
   * Called by the Kafka consumer when quality.record.validated/rejected events arrive.
   */
  async recordQualityResult(params: {
    contractId: string;
    tenantId: string;
    recordId: string;
    passed: boolean;
    qualityReportId: string;
  }): Promise<void> {
    // Try to update an existing compliance record for this record
    const existing = await this.prisma.complianceRecord.findFirst({
      where: {
        contract_id: params.contractId,
        record_id: params.recordId,
      },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      await this.prisma.complianceRecord.update({
        where: { id: existing.id },
        data: {
          quality_passed: params.passed,
          quality_report_id: params.qualityReportId,
        },
      });
    } else {
      // Create a standalone quality record
      await this.prisma.complianceRecord.create({
        data: {
          contract_id: params.contractId,
          tenant_id: params.tenantId,
          record_id: params.recordId,
          event_type: 'quality_check',
          event_timestamp: new Date(),
          quality_passed: params.passed,
          quality_report_id: params.qualityReportId,
        },
      });
    }
  }

  private verifyTenantAccess(
    user: AuthenticatedUser,
    contractTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }
    if (contractTenantId === user.tenantId) {
      return;
    }
    throw new NotFoundException('Contract not found');
  }
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
