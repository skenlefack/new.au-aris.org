import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import { FileAnalyzerService, type AnalysisResult } from './file-analyzer.service';
import { DynamicTableService } from './dynamic-table.service';

const SERVICE_NAME = 'datalake-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateDatasetDto {
  name: string;
  description?: string;
  domain: string;
  tags?: string[];
}

export interface UpdateDatasetDto {
  name?: string;
  description?: string;
  domain?: string;
  tags?: string[];
}

export interface ListDatasetsDto {
  page?: number;
  limit?: number;
  domain?: string;
  status?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface QueryDataDto {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, string>;
  search?: string;
  searchColumns?: string[];
}

export interface AggregateDto {
  column: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distribution';
  groupBy?: string;
}

export interface TimeSeriesDto {
  dateColumn: string;
  valueColumn: string;
  interval: 'day' | 'week' | 'month' | 'year';
  operation?: 'count' | 'sum' | 'avg';
}

export interface CreateAnalysisDto {
  type: string;
  title: string;
  description?: string;
  config: Record<string, unknown>;
}

/**
 * Main service for managing historical datasets.
 */
export class HistoricalDataService {
  private readonly fileAnalyzer: FileAnalyzerService;
  private readonly dynamicTable: DynamicTableService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {
    this.fileAnalyzer = new FileAnalyzerService();
    this.dynamicTable = new DynamicTableService(prisma);
  }

  /* ------------------------------------------------------------------ */
  /*  Upload & Analyze                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Analyzes a file without persisting. Returns column schema and preview.
   */
  async analyzeFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<AnalysisResult> {
    return this.fileAnalyzer.analyzeBuffer(buffer, fileName);
  }

  /**
   * Full import flow: analyze → create dataset record → create PG table → load data.
   */
  async importDataset(
    buffer: Buffer,
    fileName: string,
    dto: CreateDatasetDto,
    tenantId: string,
    userId: string,
  ): Promise<{ data: Record<string, unknown> }> {
    // 1. Analyze the file
    const analysis = this.fileAnalyzer.analyzeBuffer(buffer, fileName);
    const fileType = this.getExtension(fileName);

    // 2. Generate a unique table name
    const tableName = this.generateTableName(dto.name, dto.domain);

    // 3. Create dataset record
    const dataset = await this.prisma.historicalDataset.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        domain: dto.domain,
        sourceFile: `uploads/${tableName}/${fileName}`,
        fileType,
        fileSizeBytes: BigInt(buffer.length),
        originalFileName: fileName,
        tableName,
        rowCount: analysis.rowCount,
        columnCount: analysis.columns.length,
        status: 'IMPORTING',
        tags: dto.tags ?? [],
        metadata: JSON.parse(JSON.stringify({ preview: analysis.preview.slice(0, 10) })),
        createdBy: userId,
      },
    });

    // 4. Create column records
    for (const col of analysis.columns) {
      await this.prisma.datasetColumn.create({
        data: {
          datasetId: dataset.id,
          name: col.name,
          originalName: col.originalName,
          dataType: col.dataType,
          pgColumnName: this.toPgColumnName(col.name),
          nullable: col.nullable,
          ordinal: col.ordinal,
          sampleValues: col.sampleValues as any,
          stats: col.stats as any,
        },
      });
    }

    // 5. Create the dynamic PostgreSQL table
    const colsWithPgNames = analysis.columns;

    try {
      await this.dynamicTable.createTable(tableName, colsWithPgNames);

      // 6. Load data
      const tableColumns = colsWithPgNames.map((c) => ({
        pgColumnName: c.pgColumnName,
        dataType: this.mapToPgType(c.dataType),
        nullable: c.nullable,
      }));

      const rowsInserted = await this.dynamicTable.loadData(
        tableName,
        buffer,
        fileName,
        tableColumns,
      );

      // 7. Update dataset status
      await this.prisma.historicalDataset.update({
        where: { id: dataset.id },
        data: {
          status: 'READY',
          rowCount: rowsInserted,
        },
      });

      // Publish event
      await this.publishEvent(
        'sys.datalake.dataset.imported.v1',
        dataset.id,
        {
          datasetId: dataset.id,
          name: dto.name,
          domain: dto.domain,
          rowCount: rowsInserted,
          columnCount: analysis.columns.length,
        },
        tenantId,
        userId,
      );

      const result = await this.prisma.historicalDataset.findUnique({
        where: { id: dataset.id },
        include: { columns: { orderBy: { ordinal: 'asc' } } },
      });

      return { data: this.serializeDataset(result!) };
    } catch (error) {
      // Mark as failed
      await this.prisma.historicalDataset.update({
        where: { id: dataset.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                                */
  /* ------------------------------------------------------------------ */

  async list(
    tenantId: string,
    tenantLevel: string,
    dto: ListDatasetsDto,
  ): Promise<{ data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number } }> {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    // Continental sees everything; others scoped to tenant
    if (tenantLevel !== 'CONTINENTAL') {
      where['tenantId'] = tenantId;
    }
    if (dto.domain) where['domain'] = dto.domain;
    if (dto.status) where['status'] = dto.status;
    if (dto.search) {
      where['OR'] = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [datasets, total] = await Promise.all([
      this.prisma.historicalDataset.findMany({
        where,
        include: { columns: { orderBy: { ordinal: 'asc' } } },
        orderBy: { [dto.sort ?? 'created_at']: dto.order ?? 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.historicalDataset.count({ where }),
    ]);

    return {
      data: datasets.map((d: any) => this.serializeDataset(d)),
      meta: { total, page, limit },
    };
  }

  async getById(
    id: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const dataset = await this.prisma.historicalDataset.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { ordinal: 'asc' } },
        analyses: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!dataset) throw new HttpError(404, 'Dataset not found');
    if (tenantLevel !== 'CONTINENTAL' && dataset.tenantId !== tenantId) {
      throw new HttpError(403, 'Access denied to this dataset');
    }

    return { data: this.serializeDataset(dataset) };
  }

  async update(
    id: string,
    dto: UpdateDatasetDto,
    tenantId: string,
    tenantLevel: string,
    userId: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const existing = await this.prisma.historicalDataset.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Dataset not found');
    if (tenantLevel !== 'CONTINENTAL' && existing.tenantId !== tenantId) {
      throw new HttpError(403, 'Access denied');
    }

    const dataset = await this.prisma.historicalDataset.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.domain && { domain: dto.domain }),
        ...(dto.tags && { tags: dto.tags }),
        updatedBy: userId,
      },
      include: { columns: { orderBy: { ordinal: 'asc' } } },
    });

    return { data: this.serializeDataset(dataset) };
  }

  async remove(
    id: string,
    tenantId: string,
    tenantLevel: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.historicalDataset.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Dataset not found');
    if (tenantLevel !== 'CONTINENTAL' && existing.tenantId !== tenantId) {
      throw new HttpError(403, 'Access denied');
    }

    // Drop the dynamic table
    await this.dynamicTable.dropTable(existing.tableName);

    // Delete the dataset record (cascades to columns + analyses)
    await this.prisma.historicalDataset.delete({ where: { id } });

    await this.publishEvent(
      'sys.datalake.dataset.deleted.v1',
      id,
      { datasetId: id, name: existing.name },
      tenantId,
      userId,
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Data Query & Analytics                                              */
  /* ------------------------------------------------------------------ */

  async queryData(
    datasetId: string,
    dto: QueryDataDto,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number } }> {
    const dataset = await this.getDatasetChecked(datasetId, tenantId, tenantLevel);
    return this.dynamicTable.queryTable(dataset.tableName, dto);
  }

  async aggregateData(
    datasetId: string,
    dto: AggregateDto,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[] }> {
    const dataset = await this.getDatasetChecked(datasetId, tenantId, tenantLevel);
    const data = await this.dynamicTable.aggregate(
      dataset.tableName,
      dto.column,
      dto.operation,
      dto.groupBy,
    );
    return { data };
  }

  async timeSeriesData(
    datasetId: string,
    dto: TimeSeriesDto,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: unknown[] }> {
    const dataset = await this.getDatasetChecked(datasetId, tenantId, tenantLevel);
    const data = await this.dynamicTable.timeSeries(
      dataset.tableName,
      dto.dateColumn,
      dto.valueColumn,
      dto.interval,
      dto.operation,
    );
    return { data };
  }

  /* ------------------------------------------------------------------ */
  /*  Analyses (saved queries / charts)                                   */
  /* ------------------------------------------------------------------ */

  async createAnalysis(
    datasetId: string,
    dto: CreateAnalysisDto,
    tenantId: string,
    tenantLevel: string,
    userId: string,
  ): Promise<{ data: Record<string, unknown> }> {
    await this.getDatasetChecked(datasetId, tenantId, tenantLevel);

    const analysis = await this.prisma.datasetAnalysis.create({
      data: {
        datasetId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        config: dto.config as any,
        createdBy: userId,
      },
    });

    return { data: analysis as unknown as Record<string, unknown> };
  }

  async listAnalyses(
    datasetId: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    await this.getDatasetChecked(datasetId, tenantId, tenantLevel);

    const analyses = await this.prisma.datasetAnalysis.findMany({
      where: { datasetId },
      orderBy: { created_at: 'desc' },
    });

    return { data: analyses as unknown as Record<string, unknown>[] };
  }

  async deleteAnalysis(
    datasetId: string,
    analysisId: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<void> {
    await this.getDatasetChecked(datasetId, tenantId, tenantLevel);

    const analysis = await this.prisma.datasetAnalysis.findUnique({
      where: { id: analysisId },
    });
    if (!analysis || analysis.datasetId !== datasetId) {
      throw new HttpError(404, 'Analysis not found');
    }

    await this.prisma.datasetAnalysis.delete({ where: { id: analysisId } });
  }

  /* ------------------------------------------------------------------ */
  /*  Stats                                                               */
  /* ------------------------------------------------------------------ */

  async getStats(
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const where: Record<string, unknown> = {};
    if (tenantLevel !== 'CONTINENTAL') {
      where['tenantId'] = tenantId;
    }

    const [total, byStatus, byDomain, totalRows] = await Promise.all([
      this.prisma.historicalDataset.count({ where }),
      this.prisma.historicalDataset.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.historicalDataset.groupBy({
        by: ['domain'],
        where,
        _count: { id: true },
      }),
      this.prisma.historicalDataset.aggregate({
        where: { ...where, status: 'READY' },
        _sum: { rowCount: true },
      }),
    ]);

    return {
      data: {
        totalDatasets: total,
        totalRows: totalRows._sum.rowCount ?? 0,
        byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count.id })),
        byDomain: byDomain.map((d: any) => ({ domain: d.domain, count: d._count.id })),
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private async getDatasetChecked(
    id: string,
    tenantId: string,
    tenantLevel: string,
  ): Promise<{ id: string; tableName: string; tenantId: string }> {
    const dataset = await this.prisma.historicalDataset.findUnique({
      where: { id },
      select: { id: true, tableName: true, tenantId: true, status: true },
    });
    if (!dataset) throw new HttpError(404, 'Dataset not found');
    if (tenantLevel !== 'CONTINENTAL' && dataset.tenantId !== tenantId) {
      throw new HttpError(403, 'Access denied');
    }
    if (dataset.status !== 'READY') {
      throw new HttpError(400, `Dataset is not ready (status: ${dataset.status})`);
    }
    return dataset;
  }

  private serializeDataset(dataset: any): Record<string, unknown> {
    return {
      ...dataset,
      fileSizeBytes: dataset.fileSizeBytes ? Number(dataset.fileSizeBytes) : 0,
    };
  }

  private generateTableName(name: string, domain: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
    const domainSlug = domain
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 15);
    const ts = Date.now().toString(36);
    return `hist_${domainSlug}_${slug}_${ts}`;
  }

  private toPgColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 63) || 'col';
  }

  private mapToPgType(dataType: string): string {
    switch (dataType) {
      case 'INTEGER': return 'BIGINT';
      case 'FLOAT': return 'DOUBLE PRECISION';
      case 'DATE': return 'TIMESTAMPTZ';
      case 'BOOLEAN': return 'BOOLEAN';
      case 'JSON': return 'JSONB';
      default: return 'TEXT';
    }
  }

  private getExtension(fileName: string): string {
    const parts = fileName.split('.');
    return (parts[parts.length - 1] ?? '').toLowerCase();
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
    } catch { /* Kafka unavailable — non-blocking */ }
  }
}
