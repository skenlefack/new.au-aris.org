import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_FAOSTAT_SYNCED,
  TOPIC_AU_INTEROP_EXPORT_COMPLETED,
  TOPIC_AU_INTEROP_EXPORT_FAILED,
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
import type {
  SyncRecordEntity,
  ExportRecordEntity,
  FaostatDiscrepancy,
} from '../entities/interop.entity';
import type { MinioStorage } from '../plugins/minio';
import { buildFaostatCsv } from './faostat-csv.builder';
import type { FaostatCsvRow } from './faostat-csv.builder';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const SERVICE_NAME = 'interop-hub-service';
const INTEROP_BUCKET = 'interop-exports';

/** Percentage difference threshold to flag a discrepancy */
const DISCREPANCY_THRESHOLD = 10; // 10%

interface FaostatDenominatorRow {
  countryCode: string;
  speciesCode: string;
  year: number;
  population: number;
  source?: string;
}

interface CreateFaostatSyncDto {
  countryCode: string;
  year: number;
  records: FaostatDenominatorRow[];
  sourceUrl?: string;
}

export interface FaostatExportDto {
  indicatorCode: string; // QCL, QL, TM
  countryIso: string[];
  yearRange: [number, number];
}

/** Country code to name mapping for CSV Area column */
const COUNTRY_NAMES: Record<string, string> = {
  KE: 'Kenya', ET: 'Ethiopia', NG: 'Nigeria', SN: 'Senegal', ZA: 'South Africa',
  TZ: 'Tanzania', UG: 'Uganda', GH: 'Ghana', CI: "Cote d'Ivoire", CM: 'Cameroon',
  EG: 'Egypt', MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', LY: 'Libya',
  SD: 'Sudan', ML: 'Mali', BF: 'Burkina Faso', NE: 'Niger', TD: 'Chad',
  CD: 'DR Congo', AO: 'Angola', MZ: 'Mozambique', ZW: 'Zimbabwe', MW: 'Malawi',
  ZM: 'Zambia', BW: 'Botswana', NA: 'Namibia', RW: 'Rwanda', BI: 'Burundi',
  SO: 'Somalia', DJ: 'Djibouti', ER: 'Eritrea', SS: 'South Sudan',
  MG: 'Madagascar', MU: 'Mauritius', SC: 'Seychelles', KM: 'Comoros',
  SL: 'Sierra Leone', LR: 'Liberia', GN: 'Guinea', GW: 'Guinea-Bissau',
  GM: 'Gambia', CV: 'Cabo Verde', MR: 'Mauritania', BJ: 'Benin', TG: 'Togo',
  GA: 'Gabon', CG: 'Congo', CF: 'Central African Republic', GQ: 'Equatorial Guinea',
  ST: 'Sao Tome and Principe', LS: 'Lesotho', SZ: 'Eswatini',
};

export class FaostatService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly minio?: MinioStorage,
  ) {}

  /**
   * Import/reconcile denominators from FAOSTAT data.
   * Compares with existing denominators and flags discrepancies.
   */
  async createSync(
    dto: CreateFaostatSyncDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SyncRecordEntity>> {
    const record = await (this.prisma as any).syncRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'FAOSTAT',
        country_code: dto.countryCode,
        year: dto.year,
        status: 'IN_PROGRESS',
        source_url: dto.sourceUrl ?? null,
        synced_by: user.userId,
      },
    });

    try {
      const result = await this.reconcileDenominators(dto.records);

      const updated = await (this.prisma as any).syncRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          records_imported: result.imported,
          records_updated: result.updated,
          discrepancies: result.discrepancies.length,
          discrepancy_details: JSON.parse(JSON.stringify(result.discrepancies)),
          synced_at: new Date(),
        },
      });

      await this.publishSyncEvent(updated, user);

      return { data: this.toEntity(updated) };
    } catch (error) {
      const failed = await (this.prisma as any).syncRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      return { data: this.toEntity(failed) };
    }
  }

  /**
   * Export FAOSTAT-formatted CSV file.
   * Queries relevant tables based on indicator code, maps to FAOSTAT columns.
   */
  async exportFaostat(
    dto: FaostatExportDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ExportRecordEntity>> {
    const [yearStart, yearEnd] = dto.yearRange;
    const periodStart = new Date(yearStart, 0, 1);
    const periodEnd = new Date(yearEnd, 11, 31);

    const record = await (this.prisma as any).exportRecord.create({
      data: {
        tenant_id: user.tenantId,
        connector_type: 'FAOSTAT',
        country_code: dto.countryIso.join(','),
        period_start: periodStart,
        period_end: periodEnd,
        format: 'FAOSTAT_CSV',
        status: 'PENDING',
        exported_by: user.userId,
      },
    });

    try {
      const rows = await this.queryForFaostatExport(dto.indicatorCode, dto.countryIso, yearStart, yearEnd);

      const csvContent = buildFaostatCsv(rows);
      const csvBuffer = Buffer.from(csvContent, 'utf-8');

      let packageUrl = `/api/v1/interop/faostat/exports/${record.id}/download`;
      let packageSize = csvBuffer.length;

      if (this.minio) {
        const dateStr = new Date().toISOString().split('T')[0];
        const key = `faostat/${dto.indicatorCode}/${dateStr}/${record.id}.csv`;

        await this.minio.putObject({
          bucket: INTEROP_BUCKET,
          key,
          body: csvBuffer,
          contentType: 'text/csv; charset=utf-8',
          metadata: {
            exportId: record.id,
            indicatorCode: dto.indicatorCode,
            connectorType: 'FAOSTAT',
          },
        });

        packageUrl = await this.minio.getPresignedDownloadUrl({
          bucket: INTEROP_BUCKET,
          key,
          expiresIn: 3600,
        });
        packageSize = csvBuffer.length;
      }

      const updated = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          record_count: rows.length,
          package_url: packageUrl,
          package_size: packageSize,
          exported_at: new Date(),
        },
      });

      await this.publishExportEvent(TOPIC_AU_INTEROP_EXPORT_COMPLETED, {
        id: updated.id,
        exportType: 'FAOSTAT',
        country: dto.countryIso.join(','),
        status: 'COMPLETED',
        fileUrl: packageUrl,
      }, user);

      return { data: this.toExportEntity(updated) };
    } catch (error) {
      const failed = await (this.prisma as any).exportRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      await this.publishExportEvent(TOPIC_AU_INTEROP_EXPORT_FAILED, {
        id: failed.id,
        exportType: 'FAOSTAT',
        country: dto.countryIso.join(','),
        error: error instanceof Error ? error.message : String(error),
      }, user).catch(() => {});

      return { data: this.toExportEntity(failed) };
    }
  }

  /**
   * Query data for FAOSTAT export based on indicator code.
   * QCL = livestock populations, QL = production, TM = trade
   */
  private async queryForFaostatExport(
    indicatorCode: string,
    countryCodes: string[],
    yearStart: number,
    yearEnd: number,
  ): Promise<FaostatCsvRow[]> {
    const rows: FaostatCsvRow[] = [];

    try {
      switch (indicatorCode) {
        case 'QCL': {
          // Livestock populations from livestock_prod.livestock_census
          const censusData = await this.prisma.$queryRawUnsafe<Array<{
            country_code: string;
            species_name: string;
            year: number;
            population: number;
          }>>(
            `SELECT lc.country_code, lc.species_name, lc.year, lc.population
             FROM livestock_prod.livestock_census lc
             WHERE lc.country_code = ANY($1::text[])
               AND lc.year >= $2
               AND lc.year <= $3
             ORDER BY lc.country_code, lc.species_name, lc.year`,
            countryCodes, yearStart, yearEnd,
          );

          for (const row of censusData) {
            rows.push({
              area: COUNTRY_NAMES[row.country_code] ?? row.country_code,
              item: row.species_name,
              element: 'Stocks',
              unit: 'Head',
              year: row.year,
              value: row.population,
            });
          }
          break;
        }

        case 'QL': {
          // Production records from livestock_prod.production_records
          const prodData = await this.prisma.$queryRawUnsafe<Array<{
            country_code: string;
            product_name: string;
            year: number;
            quantity: number;
            unit: string;
          }>>(
            `SELECT pr.country_code, pr.product_name, pr.year, pr.quantity, pr.unit
             FROM livestock_prod.production_records pr
             WHERE pr.country_code = ANY($1::text[])
               AND pr.year >= $2
               AND pr.year <= $3
             ORDER BY pr.country_code, pr.product_name, pr.year`,
            countryCodes, yearStart, yearEnd,
          );

          for (const row of prodData) {
            rows.push({
              area: COUNTRY_NAMES[row.country_code] ?? row.country_code,
              item: row.product_name,
              element: 'Production',
              unit: row.unit ?? 'tonnes',
              year: row.year,
              value: row.quantity,
            });
          }
          break;
        }

        case 'TM': {
          // Trade flows from trade_sps.trade_flows
          const tradeData = await this.prisma.$queryRawUnsafe<Array<{
            country_code: string;
            commodity_name: string;
            flow_type: string;
            year: number;
            value: number;
          }>>(
            `SELECT tf.country_code, tf.commodity_name, tf.flow_type, tf.year, tf.value
             FROM trade_sps.trade_flows tf
             WHERE tf.country_code = ANY($1::text[])
               AND tf.year >= $2
               AND tf.year <= $3
             ORDER BY tf.country_code, tf.commodity_name, tf.year`,
            countryCodes, yearStart, yearEnd,
          );

          for (const row of tradeData) {
            rows.push({
              area: COUNTRY_NAMES[row.country_code] ?? row.country_code,
              item: row.commodity_name,
              element: row.flow_type === 'EXPORT' ? 'Export Quantity' : 'Import Quantity',
              unit: 'USD',
              year: row.year,
              value: row.value,
            });
          }
          break;
        }

        default:
          throw new HttpError(400, `Unknown indicator code: ${indicatorCode}. Valid: QCL, QL, TM`);
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // If tables don't exist yet, return empty
      return [];
    }

    return rows;
  }

  /**
   * Reconcile FAOSTAT denominator records against existing data.
   * Returns counts and discrepancy details.
   */
  async reconcileDenominators(
    records: FaostatDenominatorRow[],
  ): Promise<{
    imported: number;
    updated: number;
    discrepancies: FaostatDiscrepancy[];
  }> {
    let imported = 0;
    let updated = 0;
    const discrepancies: FaostatDiscrepancy[] = [];

    for (const row of records) {
      const existing = await this.findExistingDenominator(
        row.countryCode,
        row.speciesCode,
        row.year,
      );

      if (!existing) {
        imported++;
      } else {
        const percentDiff = existing.population > 0
          ? Math.abs((row.population - existing.population) / existing.population) * 100
          : row.population > 0 ? 100 : 0;

        if (percentDiff > DISCREPANCY_THRESHOLD) {
          discrepancies.push({
            countryCode: row.countryCode,
            speciesCode: row.speciesCode,
            year: row.year,
            existingValue: existing.population,
            faostatValue: row.population,
            percentDiff: Math.round(percentDiff * 100) / 100,
          });
        }
        updated++;
      }
    }

    return { imported, updated, discrepancies };
  }

  /**
   * Look up existing denominator. In production, queries master-data service.
   * Returns null if not found (mock implementation).
   */
  async findExistingDenominator(
    _countryCode: string,
    _speciesCode: string,
    _year: number,
  ): Promise<{ population: number } | null> {
    return null;
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SyncRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {
      connector_type: 'FAOSTAT' as const,
      ...this.buildTenantFilter(user),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).syncRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).syncRecord.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  // -- Entity mapping --

  toEntity(row: {
    id: string;
    tenant_id: string;
    connector_type: string;
    country_code: string;
    year: number;
    status: string;
    records_imported: number;
    records_updated: number;
    discrepancies: number;
    discrepancy_details: unknown;
    source_url: string | null;
    synced_by: string;
    synced_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): SyncRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      connectorType: row.connector_type as SyncRecordEntity['connectorType'],
      countryCode: row.country_code,
      year: row.year,
      status: row.status as SyncRecordEntity['status'],
      recordsImported: row.records_imported,
      recordsUpdated: row.records_updated,
      discrepancies: row.discrepancies,
      discrepancyDetails: row.discrepancy_details,
      sourceUrl: row.source_url,
      syncedBy: row.synced_by,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  toExportEntity(row: {
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

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return {};
    return { tenant_id: user.tenantId };
  }

  private async publishSyncEvent(
    record: { id: string; [key: string]: unknown },
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
      await this.kafka.send(TOPIC_AU_INTEROP_FAOSTAT_SYNCED, record.id as string, record, headers);
    } catch {
      // Log but don't fail for Kafka issues
    }
  }

  private async publishExportEvent(
    topic: string,
    record: { id: string; [key: string]: unknown },
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
      await this.kafka.send(topic, record.id as string, record, headers);
    } catch {
      // Log but don't fail for Kafka issues
    }
  }
}
