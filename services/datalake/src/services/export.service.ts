import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import { QueryEngineService, type AnalyticalQueryParams } from './query-engine.service';
import { MinioStorage } from './minio.storage';

const SERVICE_NAME = 'datalake-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateExportDto {
  name: string;
  query: AnalyticalQueryParams;
  format: 'CSV' | 'XLSX' | 'JSON' | 'PARQUET';
}

export class ExportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queryEngine: QueryEngineService,
    private readonly minio: MinioStorage,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  /**
   * Create an async export request. Returns 202 immediately, processes in background.
   */
  async createExport(
    dto: CreateExportDto,
    tenantId: string,
    userId: string,
    tenantLevel: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const exportRecord = await this.prisma.dataExport.create({
      data: {
        name: dto.name,
        query: dto.query as any,
        format: dto.format as any,
        status: 'PENDING',
        requested_by: userId,
        tenant_id: tenantId,
      },
    });

    // Process async
    setImmediate(() => {
      this.processExport(exportRecord.id, tenantId, tenantLevel, userId).catch((err) => {
        console.error(`[ExportService] Background export failed for ${exportRecord.id}: ${err}`);
      });
    });

    return { data: this.serialize(exportRecord) };
  }

  /**
   * Process an export: query data, convert format, upload to MinIO.
   */
  async processExport(
    exportId: string,
    tenantId: string,
    tenantLevel: string,
    userId: string,
  ): Promise<void> {
    // Update status to PROCESSING
    await this.prisma.dataExport.update({
      where: { id: exportId },
      data: { status: 'PROCESSING' },
    });

    try {
      const exportRecord = await this.prisma.dataExport.findUnique({ where: { id: exportId } });
      if (!exportRecord) throw new Error('Export not found');

      const queryParams = exportRecord.query as unknown as AnalyticalQueryParams;

      // Execute query with large limit
      const largeQuery = { ...queryParams, page: 1, limit: 100000 };
      const result = await this.queryEngine.query(largeQuery, tenantId, tenantLevel);

      // Convert to requested format
      const format = exportRecord.format as string;
      const { buffer, contentType, extension } = this.convertToFormat(result.data, format);

      // Upload to MinIO
      const key = `exports/${tenantId}/${exportId}.${extension}`;
      await this.minio.ensureBucket();
      await this.minio.putObject({
        bucket: this.minio.defaultBucket,
        key,
        body: buffer,
        contentType,
        metadata: {
          'x-export-id': exportId,
          'x-tenant-id': tenantId,
          'x-requested-by': userId,
        },
      });

      // Update record
      await this.prisma.dataExport.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          file_path: key,
          file_size: BigInt(buffer.length),
          row_count: result.data.length,
          completed_at: new Date(),
        },
      });

      // Publish completion event
      await this.publishEvent('sys.datalake.export.completed.v1', exportId, {
        exportId,
        name: exportRecord.name,
        format,
        rowCount: result.data.length,
        fileSize: buffer.length,
      }, tenantId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.prisma.dataExport.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          error_message: errorMessage,
        },
      });

      await this.publishEvent('sys.datalake.export.failed.v1', exportId, {
        exportId,
        error: errorMessage,
      }, tenantId, userId);
    }
  }

  /**
   * Get export status and download URL if completed.
   */
  async getExport(
    id: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const exportRecord = await this.prisma.dataExport.findUnique({ where: { id } });
    if (!exportRecord) throw new HttpError(404, 'Export not found');
    if (tenantLevel !== 'CONTINENTAL' && exportRecord.tenant_id !== tenantId) {
      throw new HttpError(403, 'Access denied');
    }

    const result = this.serialize(exportRecord);

    // Add download URL if completed
    if (exportRecord.status === 'COMPLETED' && exportRecord.file_path) {
      try {
        result['downloadUrl'] = await this.minio.getPresignedDownloadUrl({
          bucket: this.minio.defaultBucket,
          key: exportRecord.file_path,
          expiresIn: 3600,
        });
      } catch {
        // MinIO unavailable
      }
    }

    return { data: result };
  }

  /**
   * List exports with pagination.
   */
  async listExports(
    tenantId: string,
    tenantLevel: string,
    query: { page?: number; limit?: number; status?: string },
  ): Promise<{ data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number } }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (tenantLevel !== 'CONTINENTAL') {
      where['tenant_id'] = tenantId;
    }
    if (query.status) {
      where['status'] = query.status;
    }

    const [exports, total] = await Promise.all([
      this.prisma.dataExport.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dataExport.count({ where }),
    ]);

    return {
      data: exports.map((e: any) => this.serialize(e)),
      meta: { total, page, limit },
    };
  }

  /**
   * Convert query results to the specified format.
   */
  convertToFormat(
    data: unknown[],
    format: string,
  ): { buffer: Buffer; contentType: string; extension: string } {
    switch (format) {
      case 'CSV':
        return this.toCSV(data);
      case 'JSON':
        return this.toJSON(data);
      case 'XLSX':
        return this.toXLSX(data);
      case 'PARQUET':
        // Fallback to JSON for PARQUET (no native support)
        return this.toJSON(data);
      default:
        return this.toJSON(data);
    }
  }

  private toCSV(data: unknown[]): { buffer: Buffer; contentType: string; extension: string } {
    if (data.length === 0) {
      return { buffer: Buffer.from(''), contentType: 'text/csv', extension: 'csv' };
    }

    const rows = data as Record<string, unknown>[];
    const headers = Object.keys(rows[0]!);

    const csvRows: string[] = [headers.join(',')];
    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    }

    return {
      buffer: Buffer.from(csvRows.join('\n'), 'utf-8'),
      contentType: 'text/csv',
      extension: 'csv',
    };
  }

  private toJSON(data: unknown[]): { buffer: Buffer; contentType: string; extension: string } {
    return {
      buffer: Buffer.from(JSON.stringify(data, null, 2), 'utf-8'),
      contentType: 'application/json',
      extension: 'json',
    };
  }

  private toXLSX(data: unknown[]): { buffer: Buffer; contentType: string; extension: string } {
    // Use xlsx package already in deps
    try {
      const XLSX = require('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return {
        buffer: buf,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    } catch {
      // Fallback to CSV if xlsx unavailable
      return this.toCSV(data);
    }
  }

  private serialize(record: any): Record<string, unknown> {
    return {
      ...record,
      file_size: record.file_size ? Number(record.file_size) : null,
    };
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafka.send(topic, entityId, payload, headers);
    } catch { /* non-blocking */ }
  }
}
