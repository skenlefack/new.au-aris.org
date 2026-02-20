import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_DRIVE_FILE_UPLOADED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TenantLevel,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import type { StorageAdapter } from '../storage/storage.interface';
import { STORAGE_ADAPTER } from '../storage/storage.interface';
import type { ScannerAdapter } from '../scanner/scanner.interface';
import { SCANNER_ADAPTER } from '../scanner/scanner.interface';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import type { UploadFileDto } from './dto/upload-file.dto';
import type { PresignDto } from './dto/presign.dto';
import type { ListFilesDto } from './dto/list-files.dto';
import type { FileRecordEntity } from './entities/file-record.entity';

const SERVICE_NAME = 'drive-service';
const BUCKET_PREFIX = 'aris-';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(SCANNER_ADAPTER) private readonly scanner: ScannerAdapter,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  async upload(
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    dto: UploadFileDto,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<FileRecordEntity>> {
    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('File is empty');
    }

    const bucket = this.tenantBucket(caller.tenantId);
    await this.storage.ensureBucket(bucket);

    // Virus scan
    const scanResult = await this.scanner.scan(file.buffer, file.originalname);
    if (!scanResult.clean) {
      throw new BadRequestException(
        `File rejected by virus scan: ${scanResult.threat ?? 'unknown threat'}`,
      );
    }

    // Generate unique key
    const ext = this.extractExtension(file.originalname);
    const key = `${randomUUID()}${ext}`;

    // Upload to storage
    await this.storage.putObject({
      bucket,
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Generate thumbnail for images
    let thumbnailKey: string | null = null;
    const thumbnail = await this.thumbnailService.generate(
      file.buffer,
      file.mimetype,
    );
    if (thumbnail) {
      thumbnailKey = `thumb/${randomUUID()}.jpg`;
      await this.storage.putObject({
        bucket,
        key: thumbnailKey,
        body: thumbnail,
        contentType: 'image/jpeg',
      });
    }

    // Store metadata in DB
    const record = await this.prisma.fileRecord.create({
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

    // Publish Kafka event
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

    this.logger.log(
      `File uploaded: ${file.originalname} → ${bucket}/${key} (${file.size} bytes)`,
    );
    return { data: entity };
  }

  async presign(
    dto: PresignDto,
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

    // Create a pending record
    const record = await this.prisma.fileRecord.create({
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

    return {
      data: {
        uploadUrl,
        fileId: record.id,
        key,
      },
    };
  }

  async findAll(
    caller: AuthenticatedUser,
    query: ListFilesDto,
  ): Promise<PaginatedResponse<FileRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = {
      [query.sort ?? 'createdAt']: query.order ?? 'desc',
    };

    const where = this.buildWhere(caller, query);

    const [data, total] = await Promise.all([
      this.prisma.fileRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.fileRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => this.serialize(r)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<FileRecordEntity>> {
    const record = await this.prisma.fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new NotFoundException(`File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);

    return { data: this.serialize(record) };
  }

  async download(
    id: string,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    const record = await this.prisma.fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new NotFoundException(`File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);

    const downloadUrl = await this.storage.getPresignedDownloadUrl({
      bucket: record.bucket,
      key: record.key,
      expiresIn: 3600,
    });

    return { data: { downloadUrl } };
  }

  async softDelete(
    id: string,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<{ message: string }>> {
    const record = await this.prisma.fileRecord.findUnique({ where: { id } });

    if (!record || record.status === 'DELETED') {
      throw new NotFoundException(`File ${id} not found`);
    }

    this.verifyTenantAccess(caller, record.tenantId);

    await this.prisma.fileRecord.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: caller.userId,
      },
    });

    this.logger.log(`File soft-deleted: ${record.originalFilename} (${id})`);
    return { data: { message: 'File deleted' } };
  }

  // ── Private helpers ──

  private tenantBucket(tenantId: string): string {
    return `${BUCKET_PREFIX}${tenantId}`;
  }

  private extractExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex >= 0 ? filename.substring(dotIndex) : '';
  }

  private buildWhere(
    caller: AuthenticatedUser,
    query: ListFilesDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {
      status: 'ACTIVE',
    };

    // Tenant isolation
    switch (caller.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        break; // See all
      case TenantLevel.REC:
        // In a full implementation, resolve child tenant IDs.
        // For now, filter to own tenantId.
        where['tenantId'] = caller.tenantId;
        break;
      case TenantLevel.MEMBER_STATE:
        where['tenantId'] = caller.tenantId;
        break;
    }

    if (query.mimeType) {
      where['mimeType'] = query.mimeType;
    }
    if (query.classification) {
      where['classification'] = query.classification;
    }

    return where;
  }

  private verifyTenantAccess(
    caller: AuthenticatedUser,
    fileTenantId: string,
  ): void {
    if (caller.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (caller.tenantId !== fileTenantId) {
      throw new ForbiddenException('Cannot access files from another tenant');
    }
  }

  private serialize(record: {
    id: string;
    tenantId: string;
    bucket: string;
    key: string;
    originalFilename: string;
    mimeType: string;
    size: bigint;
    classification: string;
    uploadedBy: string;
    scanStatus: string;
    scanResult: string | null;
    thumbnailKey: string | null;
    metadata: unknown;
    status: string;
    deletedAt: Date | null;
    deletedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FileRecordEntity {
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

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    caller: AuthenticatedUser,
  ): Promise<void> {
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
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
