import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_FISHSTATJ_EXPORTED,
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
import type { CreateFishstatjExportDto } from '../dto/fishstatj-export.dto';
import type {
  ExportRecordEntity,
  FishStatJPackage,
  FishStatJRow,
} from '../entities/interop.entity';

const SERVICE_NAME = 'interop-hub-service';

@Injectable()
export class FishstatjService {
  private readonly logger = new Logger(FishstatjService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Generate a FishStatJ-aligned CSV export for a country/year.
   * Queries fisheries captures + aquaculture production, aggregates by
   * country + species + FAO area + year, and formats per FAO FishStatJ spec.
   */
  async createExport(
    dto: CreateFishstatjExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const record = await this.prisma.exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'FISHSTATJ',
        country_code: dto.countryCode,
        period_start: new Date(`${dto.year}-01-01`),
        period_end: new Date(`${dto.year}-12-31`),
        format: 'FISHSTATJ_CSV',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      const fishstatjPackage = await this.generateFishstatjPackage(
        record.id,
        dto.countryCode,
        dto.year,
      );

      const csvContent = this.toCsv(fishstatjPackage.rows);

      const updated = await this.prisma.exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: fishstatjPackage.totalRows,
          package_url: `/api/v1/interop/fishstatj/exports/${record.id}/download`,
          package_size: csvContent.length,
          exported_at: new Date(),
        },
      });

      await this.publishEvent(TOPIC_AU_INTEROP_FISHSTATJ_EXPORTED, updated, user);

      this.logger.log(
        `FishStatJ export completed: ${dto.countryCode}/${dto.year} (${fishstatjPackage.totalRows} rows)`,
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
        `FishStatJ export failed: ${dto.countryCode}/${dto.year}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Generate the FishStatJ package by querying fisheries data
   * and aggregating by country + species + FAO area + year.
   */
  async generateFishstatjPackage(
    exportId: string,
    countryCode: string,
    year: number,
  ): Promise<FishStatJPackage> {
    const rows: FishStatJRow[] = [];

    // Query capture fisheries data
    try {
      const captures = await this.prisma.$queryRaw<
        Array<{
          country_name: string;
          country_code: string;
          isscaap_group: string;
          species_scientific: string;
          species_fao_code: string;
          fao_area: string;
          quantity: number;
        }>
      >`
        SELECT
          COALESCE(ge.name, ${countryCode}) AS country_name,
          ${countryCode} AS country_code,
          COALESCE(rs.category, 'UNKNOWN') AS isscaap_group,
          COALESCE(rs.scientific_name, rs.common_name, 'Unknown') AS species_scientific,
          COALESCE(rs.fao_code, rs.code, 'UNK') AS species_fao_code,
          COALESCE(fc.fao_area, 'UNKNOWN') AS fao_area,
          SUM(COALESCE(fc.quantity, fc.weight, 0))::numeric AS quantity
        FROM fisheries.fish_captures fc
        LEFT JOIN master_data.ref_species rs ON rs.id = fc.species_id
        LEFT JOIN master_data.ref_geo_entities ge ON ge.code = ${countryCode}
        WHERE fc.tenant_id IN (
          SELECT t.id FROM public.tenants t
          WHERE t.country_code = ${countryCode}
            OR t.code = ${countryCode}
        )
        AND EXTRACT(YEAR FROM COALESCE(fc.capture_date, fc.created_at)) = ${year}
        GROUP BY ge.name, rs.category, rs.scientific_name, rs.common_name,
                 rs.fao_code, rs.code, fc.fao_area
      `;

      for (const c of captures) {
        rows.push({
          country: c.country_name,
          countryCode: c.country_code,
          isscaapGroup: c.isscaap_group,
          speciesScientific: c.species_scientific,
          speciesFaoCode: c.species_fao_code,
          faoArea: c.fao_area,
          productionSource: 'C',
          unit: 't',
          year,
          quantity: Number(c.quantity),
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to query capture fisheries for ${countryCode}/${year}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Query aquaculture production data
    try {
      const aquaculture = await this.prisma.$queryRaw<
        Array<{
          country_name: string;
          country_code: string;
          isscaap_group: string;
          species_scientific: string;
          species_fao_code: string;
          fao_area: string;
          quantity: number;
        }>
      >`
        SELECT
          COALESCE(ge.name, ${countryCode}) AS country_name,
          ${countryCode} AS country_code,
          COALESCE(rs.category, 'UNKNOWN') AS isscaap_group,
          COALESCE(rs.scientific_name, rs.common_name, 'Unknown') AS species_scientific,
          COALESCE(rs.fao_code, rs.code, 'UNK') AS species_fao_code,
          COALESCE(ap.fao_area, 'UNKNOWN') AS fao_area,
          SUM(COALESCE(ap.quantity, ap.weight, 0))::numeric AS quantity
        FROM fisheries.aquaculture_production ap
        LEFT JOIN master_data.ref_species rs ON rs.id = ap.species_id
        LEFT JOIN master_data.ref_geo_entities ge ON ge.code = ${countryCode}
        WHERE ap.tenant_id IN (
          SELECT t.id FROM public.tenants t
          WHERE t.country_code = ${countryCode}
            OR t.code = ${countryCode}
        )
        AND EXTRACT(YEAR FROM COALESCE(ap.production_date, ap.created_at)) = ${year}
        GROUP BY ge.name, rs.category, rs.scientific_name, rs.common_name,
                 rs.fao_code, rs.code, ap.fao_area
      `;

      for (const a of aquaculture) {
        rows.push({
          country: a.country_name,
          countryCode: a.country_code,
          isscaapGroup: a.isscaap_group,
          speciesScientific: a.species_scientific,
          speciesFaoCode: a.species_fao_code,
          faoArea: a.fao_area,
          productionSource: 'A',
          unit: 't',
          year,
          quantity: Number(a.quantity),
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to query aquaculture production for ${countryCode}/${year}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      exportId,
      countryCode,
      year,
      generatedAt: new Date().toISOString(),
      format: 'FISHSTATJ_CSV',
      rows,
      totalRows: rows.length,
    };
  }

  /**
   * Convert FishStatJ rows to CSV string.
   */
  toCsv(rows: FishStatJRow[]): string {
    const header = 'Country,Country_Code,ISSCAAP_Group,Species_Scientific,Species_FAO_Code,FAO_Area,Production_Source,Unit,Year,Quantity';
    const lines = rows.map((r) =>
      [
        this.escapeCsv(r.country),
        r.countryCode,
        this.escapeCsv(r.isscaapGroup),
        this.escapeCsv(r.speciesScientific),
        r.speciesFaoCode,
        r.faoArea,
        r.productionSource,
        r.unit,
        r.year,
        r.quantity,
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
      connector_type: 'FISHSTATJ' as const,
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
