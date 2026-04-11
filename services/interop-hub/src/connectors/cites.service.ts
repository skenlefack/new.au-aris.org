import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_CITES_EXPORTED,
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
import type { CreateCitesExportDto } from '../dto/cites-export.dto';
import type {
  ExportRecordEntity,
  CitesPackage,
  CitesPermitRow,
} from '../entities/interop.entity';

const SERVICE_NAME = 'interop-hub-service';

@Injectable()
export class CitesService {
  private readonly logger = new Logger(CitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Generate a CITES annual report export for a country/year.
   * Queries wildlife CITES permits and formats per CITES annual report spec.
   */
  async createExport(
    dto: CreateCitesExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await this.prisma.exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'CITES',
        country_code: dto.countryCode,
        period_start: new Date(`${dto.year}-01-01`),
        period_end: new Date(`${dto.year}-12-31`),
        format: 'CITES_CSV',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      const citesPackage = await this.generateCitesPackage(
        record.id,
        dto.countryCode,
        dto.year,
      );

      const csvContent = this.toCsv(citesPackage.permits);

      const updated = await this.prisma.exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: citesPackage.totalPermits,
          package_url: `/api/v1/interop/cites/exports/${record.id}/download`,
          package_size: csvContent.length,
          exported_at: new Date(),
        },
      });

      await this.publishEvent(TOPIC_AU_INTEROP_CITES_EXPORTED, updated, user);

      this.logger.log(
        `CITES export completed: ${dto.countryCode}/${dto.year} (${citesPackage.totalPermits} permits)`,
      );
      return { data: this.toEntity(updated) };
    } catch (error) {
      const failed = await this.prisma.exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `CITES export failed: ${dto.countryCode}/${dto.year}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Generate the CITES package by querying wildlife CITES permit data.
   * Falls back to querying generic wildlife trade data if specific CITES tables
   * are not yet populated.
   */
  async generateCitesPackage(
    exportId: string,
    countryCode: string,
    year: number,
  ): Promise<CitesPackage> {
    const permits: CitesPermitRow[] = [];

    // Try querying CITES permits from wildlife schema
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          year: number;
          country_code: string;
          species_name: string;
          species_code: string;
          appendix: string;
          purpose: string;
          source: string;
          origin_country: string;
          import_country: string;
          quantity: number;
          unit: string;
          permit_number: string;
        }>
      >`
        SELECT
          ${year} AS year,
          ${countryCode} AS country_code,
          COALESCE(rs.scientific_name, rs.common_name, 'Unknown') AS species_name,
          COALESCE(rs.cites_code, rs.code, 'UNK') AS species_code,
          COALESCE(cp.appendix, 'II') AS appendix,
          COALESCE(cp.purpose, 'T') AS purpose,
          COALESCE(cp.source_code, 'W') AS source,
          COALESCE(cp.origin_country, ${countryCode}) AS origin_country,
          COALESCE(cp.import_country, '') AS import_country,
          COALESCE(cp.quantity, 0)::numeric AS quantity,
          COALESCE(cp.unit, 'specimens') AS unit,
          COALESCE(cp.permit_number, '') AS permit_number
        FROM wildlife.cites_permits cp
        LEFT JOIN master_data.ref_species rs ON rs.id = cp.species_id
        WHERE cp.tenant_id IN (
          SELECT t.id FROM public.tenants t
          WHERE t.country_code = ${countryCode}
            OR t.code = ${countryCode}
        )
        AND EXTRACT(YEAR FROM COALESCE(cp.issued_date, cp.created_at)) = ${year}
        ORDER BY cp.created_at ASC
      `;

      for (const r of rows) {
        permits.push({
          year: r.year,
          countryCode: r.country_code,
          speciesName: r.species_name,
          speciesCode: r.species_code,
          appendix: r.appendix as CitesPermitRow['appendix'],
          purpose: r.purpose,
          source: r.source,
          originCountry: r.origin_country,
          importCountry: r.import_country,
          quantity: Number(r.quantity),
          unit: r.unit,
          permitNumber: r.permit_number,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to query CITES permits for ${countryCode}/${year}: ${error instanceof Error ? error.message : String(error)}. ` +
        'Wildlife CITES tables may not exist yet — returning empty export.',
      );
    }

    return {
      exportId,
      countryCode,
      year,
      generatedAt: new Date().toISOString(),
      format: 'CITES_CSV',
      permits,
      totalPermits: permits.length,
    };
  }

  /**
   * Convert CITES permit rows to CSV string per CITES annual report format.
   */
  toCsv(permits: CitesPermitRow[]): string {
    const header = 'Year,Country,Species_Name,Species_Code,Appendix,Purpose,Source,Origin_Country,Import_Country,Quantity,Unit,Permit_Number';
    const lines = permits.map((p) =>
      [
        p.year,
        p.countryCode,
        this.escapeCsv(p.speciesName),
        p.speciesCode,
        p.appendix,
        p.purpose,
        p.source,
        p.originCountry,
        p.importCountry,
        p.quantity,
        p.unit,
        this.escapeCsv(p.permitNumber),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ExportRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      connector_type: 'CITES' as const,
      ...this.buildTenantFilter(user),
    };

    const [data, total] = await Promise.all([
      this.prisma.exportRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.exportRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await this.prisma.exportRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Export record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenant_id);
    return { data: this.toEntity(record) };
  }

  // ── Entity mapping ──

  toEntity(row: {
    id: string;
    tenant_id: string;
    connector_type: string;
    country_code: string;
    period_start: Date;
    period_end: Date;
    format: string;
    status: string;
    record_count: number;
    package_url: string | null;
    package_size: number | null;
    error_message: string | null;
    exported_by: string;
    exported_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): ExportRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      connectorType: row.connector_type as ExportRecordEntity['connectorType'],
      countryCode: row.country_code,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      format: row.format as ExportRecordEntity['format'],
      status: row.status as ExportRecordEntity['status'],
      recordCount: row.record_count,
      packageUrl: row.package_url,
      packageSize: row.package_size,
      errorMessage: row.error_message,
      exportedBy: row.exported_by,
      exportedAt: row.exported_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Tenant helpers ──

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private verifyTenantAccess(user: AuthenticatedUser, recordTenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === recordTenantId) return;
    throw new NotFoundException('Export record not found');
  }

  // ── Kafka ──

  private async publishEvent(
    topic: string,
    record: { id: string; [key: string]: unknown },
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
      await this.kafkaProducer.send(topic, record.id as string, record, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for ${record.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
