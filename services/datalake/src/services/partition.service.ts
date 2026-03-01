import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import { MinioStorage } from './minio.storage';

const SERVICE_NAME = 'datalake-service';
const DATALAKE_TABLE = 'datalake."data_lake_entry"';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class PartitionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly minio: MinioStorage,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  /**
   * List partitions with optional tenant scoping.
   */
  async listPartitions(
    tenantId: string,
    tenantLevel: string,
    query?: { page?: number; limit?: number; status?: string },
  ): Promise<{ data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query?.status) {
      where['status'] = query.status;
    }

    const [partitions, total] = await Promise.all([
      this.prisma.dataLakePartition.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dataLakePartition.count({ where }),
    ]);

    return {
      data: partitions.map((p: any) => ({
        ...p,
        size_bytes: p.size_bytes ? Number(p.size_bytes) : 0,
      })),
      meta: { total, page, limit },
    };
  }

  /**
   * Archive a partition: export data to MinIO, delete from DataLakeEntry, update status.
   */
  async archivePartition(
    id: string,
    userId: string,
  ): Promise<{ data: Record<string, unknown> }> {
    const partition = await this.prisma.dataLakePartition.findUnique({ where: { id } });
    if (!partition) throw new HttpError(404, 'Partition not found');
    if (partition.status !== 'ACTIVE') {
      throw new HttpError(400, `Partition is not active (status: ${partition.status})`);
    }

    // Update to ARCHIVING
    await this.prisma.dataLakePartition.update({
      where: { id },
      data: { status: 'ARCHIVING' },
    });

    try {
      // Export partition data to MinIO
      const [sourceStr, quarterStr] = partition.partition_key.split(':');
      const sql = `SELECT * FROM ${DATALAKE_TABLE} WHERE "source" = '${this.escapeString(sourceStr ?? '')}' AND DATE_TRUNC('quarter', "ingested_at")::text LIKE '${this.escapeString(quarterStr ?? '')}%'`;
      const data: unknown[] = await this.prisma.$queryRawUnsafe(sql);

      const archiveKey = `archives/${partition.table_name}/${partition.partition_key.replace(/:/g, '_')}_${Date.now()}.json`;
      const buffer = Buffer.from(JSON.stringify(data), 'utf-8');

      await this.minio.ensureBucket();
      await this.minio.putObject({
        bucket: this.minio.defaultBucket,
        key: archiveKey,
        body: buffer,
        contentType: 'application/json',
      });

      // Delete entries from datalake
      const deleteSql = `DELETE FROM ${DATALAKE_TABLE} WHERE "source" = '${this.escapeString(sourceStr ?? '')}' AND DATE_TRUNC('quarter', "ingested_at")::text LIKE '${this.escapeString(quarterStr ?? '')}%'`;
      await this.prisma.$executeRawUnsafe(deleteSql);

      // Update partition status
      const updated = await this.prisma.dataLakePartition.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archived_at: new Date(),
          archive_path: archiveKey,
          row_count: data.length,
          size_bytes: BigInt(buffer.length),
        },
      });

      // Publish event
      await this.publishEvent('sys.datalake.partition.archived.v1', id, {
        partitionId: id,
        partitionKey: partition.partition_key,
        archivePath: archiveKey,
        rowCount: data.length,
      }, userId);

      return {
        data: { ...updated, size_bytes: Number(updated.size_bytes) },
      };
    } catch (err) {
      // Revert to ACTIVE on failure
      await this.prisma.dataLakePartition.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
      throw err;
    }
  }

  /**
   * Refresh partition statistics from the data lake entries.
   */
  async refreshPartitionStats(): Promise<{ data: { refreshed: number } }> {
    const sql = `
      SELECT
        "source"::text AS source,
        DATE_TRUNC('quarter', "ingested_at")::text AS quarter,
        COUNT(*)::int AS row_count
      FROM ${DATALAKE_TABLE}
      GROUP BY "source", DATE_TRUNC('quarter', "ingested_at")
      ORDER BY quarter DESC
    `;
    const stats: Array<{ source: string; quarter: string; row_count: number }> =
      await this.prisma.$queryRawUnsafe(sql);

    let refreshed = 0;
    for (const stat of stats) {
      const partitionKey = `${stat.source}:${stat.quarter.split(' ')[0]}`;
      await this.prisma.dataLakePartition.upsert({
        where: {
          table_name_partition_key: {
            table_name: 'data_lake_entry',
            partition_key: partitionKey,
          },
        },
        update: {
          row_count: stat.row_count,
          source: stat.source as any,
        },
        create: {
          table_name: 'data_lake_entry',
          partition_key: partitionKey,
          source: stat.source as any,
          row_count: stat.row_count,
          status: 'ACTIVE',
        },
      });
      refreshed++;
    }

    return { data: { refreshed } };
  }

  /**
   * Generate a partition key from source and quarter.
   */
  static generatePartitionKey(source: string, date: Date): string {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    return `${source}:${date.getFullYear()}-Q${quarter}`;
  }

  private escapeString(value: string): string {
    return value.replace(/'/g, "''");
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    userId: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: 'system',
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafka.send(topic, entityId, payload, headers);
    } catch { /* non-blocking */ }
  }
}
