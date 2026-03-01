import { randomUUID } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TOPIC_SYS_DRIVE_FILE_UPLOADED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TenantLevel,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { StorageAdapter } from './minio.storage';
import type { ScannerAdapter } from './mock.scanner';
import type { ThumbnailService } from './thumbnail.service';
import type { FileRecordEntity } from '../file/entities/file-record.entity';

const SERVICE_NAME = 'drive-service';
const BUCKET_PREFIX = 'aris-';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class FileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
    private readonly storage: StorageAdapter,
    private readonly scanner: ScannerAdapter,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  async upload(
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    dto: { classification: string; metadata?: Record<string, unknown> },
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<FileRecordEntity>> {
    if (!file.buffer || file.size === 0) {
      throw new HttpError(400, 'File is empty');
    }

    const bucket = this.tenantBucket(caller.tenantId);
    await this.storage.ensureBucket(bucket);

    const scanResult = await this.scanner.scan(file.buffer, file.originalname);
    if (!scanResult.clean) {
      throw new HttpError(400, `File rejected by virus scan: ${scanResult.threat ?? 'unknown threat'}`);
    }

    const ext = this.extractExtension(file.originalname);
    const key = `${randomUUID()}${ext}`;

    await this.storage.putObject({
      bucket,
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    let thumbnailKey: string | null = null;
    const thumbnail = await this.thumbnailService.generate(file.buffer, file.mimetype);
    if (thumbnail) {
      thumbnailKey = `thumb/${randomUUID()}.jpg`;
      await this.storage.putObject({
        bucket,
        key: thumbnailKey,
        body: thumbnail,
        contentType: 'image/jpeg',
      });
    }

    const record = await (this.prisma as any).fileRecord.create({
      data: {
        tenantId: caller.tenantId,
        bucket,
        key,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        classification: dto.classification,
        uploadedBy: caller.userId,
        scanStatus: 'CLEAN',
        scanResult: null,
        thumbnailKey,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const entity = this.serialize(record);

    await this.publishEvent(
      TOPIC_SYS_DRIVE_FILE_UPLOADED,
      record.id,
      {
        fileId: record.id,
        tenantId: caller.tenantId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        classification: dto.classification,
      },
      caller,
    );

    return { data: entity };
  }

  async presign(
    dto: { filename: string; mimeType: string; size: number; classification: string; expiresIn?: number },
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<{ uploadUrl: string; fileId: string; key: string }>> {
    const bucket = this.tenantBucket(caller.tenantId);
    await this.storage.ensureBucket(bucket);

    const ext = this.extractExtension(dto.filename);
    const key = `${randomUUID()}${ext}`;

    const uploadUrl = await this.storage.getPresignedUploadUrl({
      bucket,
      key,
      expiresIn: dto.expiresIn ?? 3600,
      contentType: dto.mimeType,
    });

    const record = await (this.prisma as any).fileRecord.create({
      data: {
        tenantId: caller.tenantId,
        bucket,
        key,
        originalFilename: dto.filename,
        mimeType: dto.mimeType,
        size: BigInt(dto.size),
        classification: dto.classification,
        uploadedBy: caller.userId,
        scanStatus: 'PENDING',
      },
    });

    return { data: { uploadUrl, fileId: record.id, key } };
  }

  async findAll(
    caller: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string; mimeType?: string; classification?: string },
  ): Promise<PaginatedResponse<FileRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where = this.buildWhere(caller, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).fileRecord.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).fileRecord.count({ where }),
    ]);

    return { data: data.map((r: any) => this.serialize(r)), meta: { total, page, limit } };
  }

  async findOne(id: string, caller: AuthenticatedUser): Promise<ApiResponse<FileRecordEntity>> {
    const record = await (this.prisma as any).fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new HttpError(404, `File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);
    return { data: this.serialize(record) };
  }

  async download(id: string, caller: AuthenticatedUser): Promise<ApiResponse<{ downloadUrl: string }>> {
    const record = await (this.prisma as any).fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new HttpError(404, `File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);

    const downloadUrl = await this.storage.getPresignedDownloadUrl({
      bucket: record.bucket,
      key: record.key,
      expiresIn: 3600,
    });

    return { data: { downloadUrl } };
  }

  async softDelete(id: string, caller: AuthenticatedUser): Promise<ApiResponse<{ message: string }>> {
    const record = await (this.prisma as any).fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new HttpError(404, `File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);

    await (this.prisma as any).fileRecord.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date(), deletedBy: caller.userId },
    });

    return { data: { message: 'File deleted' } };
  }

  private tenantBucket(tenantId: string): string {
    return `${BUCKET_PREFIX}${tenantId}`;
  }

  private extractExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex >= 0 ? filename.substring(dotIndex) : '';
  }

  private buildWhere(
    caller: AuthenticatedUser,
    query: { mimeType?: string; classification?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = { status: 'ACTIVE' };

    if (caller.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = caller.tenantId;
    }
    if (query.mimeType) where['mimeType'] = query.mimeType;
    if (query.classification) where['classification'] = query.classification;

    return where;
  }

  private verifyTenantAccess(caller: AuthenticatedUser, fileTenantId: string): void {
    if (caller.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (caller.tenantId !== fileTenantId) {
      throw new HttpError(403, 'Cannot access files from another tenant');
    }
  }

  private serialize(record: any): FileRecordEntity {
    return {
      id: record.id,
      tenantId: record.tenantId,
      bucket: record.bucket,
      key: record.key,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      size: record.size.toString(),
      classification: record.classification,
      uploadedBy: record.uploadedBy,
      scanStatus: record.scanStatus,
      scanResult: record.scanResult,
      thumbnailKey: record.thumbnailKey,
      metadata: record.metadata,
      status: record.status,
      deletedAt: record.deletedAt,
      deletedBy: record.deletedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, caller: AuthenticatedUser): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: caller.tenantId,
      userId: caller.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafkaProducer.send(topic, entityId, payload, headers);
    } catch { /* best-effort */ }
  }
}
