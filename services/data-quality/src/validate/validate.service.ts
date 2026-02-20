import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
} from '@aris/shared-types';
import type { KafkaHeaders, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { QualityGateConfig, QualityReport as EngineReport } from '@aris/quality-rules';
import { QualityGateResult } from '@aris/shared-types';
import { PrismaService } from '../prisma.service';
import { EngineService } from '../engine/engine.service';
import { ValidateRecordDto } from './dto/validate-record.dto';
import type { QualityReportEntity } from './entities/quality-report.entity';

const SERVICE_NAME = 'data-quality-service';

/** Map engine result to Prisma enum values */
function mapOverallStatus(result: QualityGateResult): 'PASSED' | 'FAILED' | 'WARNING' {
  switch (result) {
    case QualityGateResult.PASS: return 'PASSED';
    case QualityGateResult.FAIL: return 'FAILED';
    case QualityGateResult.WARNING: return 'WARNING';
    default: return 'PASSED';
  }
}

function mapGateStatus(result: QualityGateResult): 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED' {
  return result as 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
}

@Injectable()
export class ValidateService {
  private readonly logger = new Logger(ValidateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async validate(
    dto: ValidateRecordDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<QualityReportEntity>> {
    // Build gate config from DTO + any custom rules for this domain
    const gateConfig = await this.buildGateConfig(dto, user.tenantId);

    // Run the quality engine
    const engineReport = await this.engine.check(
      dto.record,
      dto.entityType,
      gateConfig,
    );

    // Persist the report
    const report = await this.persistReport(engineReport, dto, user);

    // If FAILED, create correction tracker
    if (engineReport.overallResult === QualityGateResult.FAIL) {
      await this.createCorrectionTracker(report.id, dto.dataContractId);
    }

    // Publish Kafka event
    await this.publishResult(report, engineReport, user);

    this.logger.log(
      `Quality check: ${dto.domain}/${dto.entityType} record=${dto.recordId} → ${engineReport.overallResult} (${engineReport.violations.length} violations, ${engineReport.totalDurationMs}ms)`,
    );

    return { data: report };
  }

  private async buildGateConfig(
    dto: ValidateRecordDto,
    tenantId: string,
  ): Promise<QualityGateConfig> {
    // Start with DTO-provided config
    const config: QualityGateConfig = {
      requiredFields: dto.requiredFields,
      temporalPairs: dto.temporalPairs,
      geoFields: dto.geoFields,
      unitFields: dto.unitFields,
      auditFields: dto.auditFields,
      codeFields: dto.codeFields,
      confidenceLevelField: dto.confidenceLevelField,
      confidenceEvidenceFields: dto.confidenceEvidenceFields,
      dedupFields: dto.dedupFields,
    };

    // Merge custom rules from the database
    const customRules = await this.prisma.customQualityRule.findMany({
      where: {
        domain: dto.domain,
        entityType: dto.entityType,
        isActive: true,
        OR: [
          { tenantId },
          // Continental rules apply to all
          { tenantId: '00000000-0000-0000-0000-000000000000' },
        ],
      },
    });

    for (const rule of customRules) {
      const ruleConfig = rule.config as Record<string, unknown>;
      // Merge rule config fields into the gate config
      if (ruleConfig['requiredFields'] && Array.isArray(ruleConfig['requiredFields'])) {
        config.requiredFields = [
          ...(config.requiredFields ?? []),
          ...(ruleConfig['requiredFields'] as string[]),
        ];
      }
      if (ruleConfig['temporalPairs'] && Array.isArray(ruleConfig['temporalPairs'])) {
        config.temporalPairs = [
          ...(config.temporalPairs ?? []),
          ...(ruleConfig['temporalPairs'] as [string, string][]),
        ];
      }
      if (ruleConfig['geoFields'] && Array.isArray(ruleConfig['geoFields'])) {
        config.geoFields = [
          ...(config.geoFields ?? []),
          ...(ruleConfig['geoFields'] as string[]),
        ];
      }
      if (ruleConfig['codeFields'] && typeof ruleConfig['codeFields'] === 'object') {
        config.codeFields = {
          ...config.codeFields,
          ...(ruleConfig['codeFields'] as Record<string, string>),
        };
      }
    }

    // Load existing records for dedup if dedupFields are configured
    if (config.dedupFields && config.dedupFields.length > 0) {
      const existingReports = await this.prisma.qualityReport.findMany({
        where: {
          domain: dto.domain,
          entityType: dto.entityType,
          overallStatus: { in: ['PASSED', 'WARNING'] },
        },
        take: 100,
        orderBy: { checkedAt: 'desc' },
        select: { recordId: true },
      });
      // In a real implementation, we'd load the actual records from the domain service.
      // For now, we pass the record IDs as a signal to the dedup gate.
      config.existingRecords = existingReports.map((r) => ({ id: r.recordId }));
    }

    return config;
  }

  private async persistReport(
    engineReport: EngineReport,
    dto: ValidateRecordDto,
    user: AuthenticatedUser,
  ): Promise<QualityReportEntity> {
    const report = await this.prisma.qualityReport.create({
      data: {
        recordId: dto.recordId,
        entityType: dto.entityType,
        domain: dto.domain,
        tenantId: user.tenantId,
        overallStatus: mapOverallStatus(engineReport.overallResult),
        totalDurationMs: engineReport.totalDurationMs,
        checkedAt: new Date(engineReport.checkedAt),
        submittedBy: user.userId,
        dataContractId: dto.dataContractId ?? null,
        gateResults: {
          create: engineReport.gates.map((g) => ({
            gate: g.gate,
            status: mapGateStatus(g.result),
            durationMs: g.durationMs,
          })),
        },
        violations: {
          create: engineReport.violations.map((v) => ({
            gate: v.gate,
            field: v.field,
            message: v.message,
            severity: v.severity,
          })),
        },
      },
      include: {
        gateResults: true,
        violations: true,
      },
    });

    return report as unknown as QualityReportEntity;
  }

  private async createCorrectionTracker(
    reportId: string,
    dataContractId?: string,
  ): Promise<void> {
    // Default SLAs (can be overridden by data contract)
    let correctionHours = 48;
    let escalationHours = 168; // 7 days

    if (dataContractId) {
      try {
        // Try to load SLAs from data contract (if data-contract service is available)
        // For now, use defaults — the data-contract integration will be wired later
        this.logger.debug(`Would load SLA from data contract ${dataContractId}`);
      } catch {
        // Use defaults
      }
    }

    const now = new Date();
    await this.prisma.correctionTracker.create({
      data: {
        reportId,
        correctionDeadline: new Date(now.getTime() + correctionHours * 60 * 60 * 1000),
        escalationDeadline: new Date(now.getTime() + escalationHours * 60 * 60 * 1000),
      },
    });
  }

  private async publishResult(
    report: QualityReportEntity,
    engineReport: EngineReport,
    user: AuthenticatedUser,
  ): Promise<void> {
    const topic = engineReport.overallResult === QualityGateResult.FAIL
      ? TOPIC_AU_QUALITY_RECORD_REJECTED
      : TOPIC_AU_QUALITY_RECORD_VALIDATED;

    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      reportId: report.id,
      recordId: report.recordId,
      entityType: report.entityType,
      domain: report.domain,
      overallStatus: report.overallStatus,
      violationCount: engineReport.violations.length,
      checkedAt: report.checkedAt,
    };

    try {
      await this.kafkaProducer.send(topic, report.recordId, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish quality event for report ${report.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
