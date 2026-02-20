import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  DataClassification,
  UserRole,
  TenantLevel,
  TOPIC_SYS_DRIVE_FILE_UPLOADED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { FileService } from '../file.service';

// ── Mock factories ──

function mockPrismaService() {
  return {
    fileRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
}

function mockStorage() {
  return {
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockResolvedValue(Buffer.from('file-content')),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    getPresignedUploadUrl: vi.fn().mockResolvedValue('https://minio:9000/upload?signed'),
    getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://minio:9000/download?signed'),
  };
}

function mockScanner(clean = true) {
  return {
    scan: vi.fn().mockResolvedValue({
      clean,
      threat: clean ? undefined : 'EICAR-TEST-FILE',
    }),
  };
}

function mockThumbnailService(returnThumbnail = false) {
  return {
    isImage: vi.fn().mockReturnValue(returnThumbnail),
    generate: vi.fn().mockResolvedValue(
      returnThumbnail ? Buffer.from('thumb-data') : null,
    ),
  };
}

function callerUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-001',
    email: 'steward@ke.aris.africa',
    role: UserRole.DATA_STEWARD,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function fileRecordFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'file-001',
    tenantId: 'tenant-ke',
    bucket: 'aris-tenant-ke',
    key: 'abc123.pdf',
    originalFilename: 'outbreak-report.pdf',
    mimeType: 'application/pdf',
    size: BigInt(1024),
    classification: DataClassification.RESTRICTED,
    uploadedBy: 'user-001',
    scanStatus: 'CLEAN',
    scanResult: null,
    thumbnailKey: null,
    metadata: {},
    status: 'ACTIVE',
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function multerFile(overrides: Record<string, unknown> = {}) {
  return {
    originalname: 'outbreak-report.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('PDF-content'),
    size: 1024,
    ...overrides,
  };
}

// ── Tests ──

describe('FileService', () => {
  let service: FileService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let storage: ReturnType<typeof mockStorage>;
  let scanner: ReturnType<typeof mockScanner>;
  let thumbnail: ReturnType<typeof mockThumbnailService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    storage = mockStorage();
    scanner = mockScanner();
    thumbnail = mockThumbnailService();

    service = new FileService(
      prisma as never,
      kafka as never,
      storage as never,
      scanner as never,
      thumbnail as never,
    );
  });

  // ── upload() ──

  describe('upload', () => {
    it('should upload file to storage and create DB record', async () => {
      const record = fileRecordFixture();
      prisma.fileRecord.create.mockResolvedValue(record);

      const result = await service.upload(
        multerFile(),
        { classification: DataClassification.RESTRICTED },
        callerUser(),
      );

      expect(storage.ensureBucket).toHaveBeenCalledWith('aris-tenant-ke');
      expect(scanner.scan).toHaveBeenCalledWith(
        expect.any(Buffer),
        'outbreak-report.pdf',
      );
      expect(storage.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'aris-tenant-ke',
          contentType: 'application/pdf',
        }),
      );
      expect(prisma.fileRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-ke',
          originalFilename: 'outbreak-report.pdf',
          mimeType: 'application/pdf',
          classification: DataClassification.RESTRICTED,
          uploadedBy: 'user-001',
          scanStatus: 'CLEAN',
        }),
      });
      expect(result.data.id).toBe('file-001');
    });

    it('should reject infected files', async () => {
      scanner = mockScanner(false);
      service = new FileService(
        prisma as never,
        kafka as never,
        storage as never,
        scanner as never,
        thumbnail as never,
      );

      await expect(
        service.upload(
          multerFile(),
          { classification: DataClassification.RESTRICTED },
          callerUser(),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(storage.putObject).not.toHaveBeenCalled();
      expect(prisma.fileRecord.create).not.toHaveBeenCalled();
    });

    it('should reject empty files', async () => {
      await expect(
        service.upload(
          multerFile({ buffer: Buffer.alloc(0), size: 0 }),
          { classification: DataClassification.RESTRICTED },
          callerUser(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate thumbnail for images', async () => {
      thumbnail = mockThumbnailService(true);
      service = new FileService(
        prisma as never,
        kafka as never,
        storage as never,
        scanner as never,
        thumbnail as never,
      );

      const record = fileRecordFixture({ thumbnailKey: 'thumb/xyz.jpg' });
      prisma.fileRecord.create.mockResolvedValue(record);

      await service.upload(
        multerFile({ originalname: 'photo.jpg', mimetype: 'image/jpeg' }),
        { classification: DataClassification.PUBLIC },
        callerUser(),
      );

      // 2 puts: original + thumbnail
      expect(storage.putObject).toHaveBeenCalledTimes(2);
      expect(storage.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/jpeg' }),
      );
    });

    it('should publish UPLOADED Kafka event on success', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      await service.upload(
        multerFile(),
        { classification: DataClassification.RESTRICTED },
        callerUser(),
      );

      expect(kafka.send).toHaveBeenCalledWith(
        TOPIC_SYS_DRIVE_FILE_UPLOADED,
        'file-001',
        expect.objectContaining({
          fileId: 'file-001',
          tenantId: 'tenant-ke',
          filename: 'outbreak-report.pdf',
        }),
        expect.objectContaining({
          sourceService: 'drive-service',
          tenantId: 'tenant-ke',
        }),
      );
    });

    it('should not throw on Kafka publish failure', async () => {
      kafka.send.mockRejectedValue(new Error('Kafka down'));
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      const result = await service.upload(
        multerFile(),
        { classification: DataClassification.RESTRICTED },
        callerUser(),
      );

      expect(result.data).toBeDefined();
    });

    it('should include metadata in DB record', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      await service.upload(
        multerFile(),
        { classification: DataClassification.PUBLIC, metadata: { domain: 'health' } },
        callerUser(),
      );

      expect(prisma.fileRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { domain: 'health' },
        }),
      });
    });

    it('should preserve file extension in storage key', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      await service.upload(
        multerFile({ originalname: 'data.csv' }),
        { classification: DataClassification.PUBLIC },
        callerUser(),
      );

      const createCall = prisma.fileRecord.create.mock.calls[0][0];
      expect(createCall.data.key).toMatch(/\.csv$/);
    });
  });

  // ── presign() ──

  describe('presign', () => {
    it('should return presigned URL and create pending record', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      const result = await service.presign(
        {
          filename: 'big-file.zip',
          mimeType: 'application/zip',
          size: 50_000_000,
          classification: DataClassification.RESTRICTED,
        },
        callerUser(),
      );

      expect(storage.ensureBucket).toHaveBeenCalledWith('aris-tenant-ke');
      expect(storage.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'aris-tenant-ke',
          expiresIn: 3600,
        }),
      );
      expect(result.data.uploadUrl).toContain('signed');
      expect(result.data.fileId).toBe('file-001');
    });

    it('should use custom expiresIn when provided', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      await service.presign(
        {
          filename: 'file.bin',
          mimeType: 'application/octet-stream',
          size: 1024,
          classification: DataClassification.PUBLIC,
          expiresIn: 7200,
        },
        callerUser(),
      );

      expect(storage.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ expiresIn: 7200 }),
      );
    });

    it('should create record with PENDING scan status', async () => {
      prisma.fileRecord.create.mockResolvedValue(fileRecordFixture());

      await service.presign(
        {
          filename: 'file.bin',
          mimeType: 'application/octet-stream',
          size: 1024,
          classification: DataClassification.PUBLIC,
        },
        callerUser(),
      );

      expect(prisma.fileRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scanStatus: 'PENDING',
        }),
      });
    });
  });

  // ── findAll() ──

  describe('findAll', () => {
    it('should return paginated file list', async () => {
      const records = [fileRecordFixture(), fileRecordFixture({ id: 'file-002' })];
      prisma.fileRecord.findMany.mockResolvedValue(records);
      prisma.fileRecord.count.mockResolvedValue(2);

      const result = await service.findAll(callerUser(), {});

      expect(prisma.fileRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            tenantId: 'tenant-ke',
          }),
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
    });

    it('should not filter by tenantId for CONTINENTAL users', async () => {
      prisma.fileRecord.findMany.mockResolvedValue([]);
      prisma.fileRecord.count.mockResolvedValue(0);

      await service.findAll(
        callerUser({ tenantLevel: TenantLevel.CONTINENTAL }),
        {},
      );

      const where = prisma.fileRecord.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('tenantId');
    });

    it('should filter by mimeType and classification', async () => {
      prisma.fileRecord.findMany.mockResolvedValue([]);
      prisma.fileRecord.count.mockResolvedValue(0);

      await service.findAll(callerUser(), {
        mimeType: 'application/pdf',
        classification: DataClassification.PUBLIC,
      });

      expect(prisma.fileRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mimeType: 'application/pdf',
            classification: DataClassification.PUBLIC,
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT', async () => {
      prisma.fileRecord.findMany.mockResolvedValue([]);
      prisma.fileRecord.count.mockResolvedValue(0);

      await service.findAll(callerUser(), { limit: 500 });

      expect(prisma.fileRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ── findOne() ──

  describe('findOne', () => {
    it('should return file metadata', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(fileRecordFixture());

      const result = await service.findOne('file-001', callerUser());

      expect(result.data.originalFilename).toBe('outbreak-report.pdf');
      expect(result.data.size).toBe('1024');
    });

    it('should throw NotFoundException for missing file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('file-999', callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ status: 'DELETED' }),
      );

      await expect(
        service.findOne('file-001', callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for another tenant', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.findOne('file-001', callerUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow CONTINENTAL user to access any tenant file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ tenantId: 'tenant-ng' }),
      );

      const result = await service.findOne(
        'file-001',
        callerUser({ tenantLevel: TenantLevel.CONTINENTAL }),
      );

      expect(result.data.id).toBe('file-001');
    });
  });

  // ── download() ──

  describe('download', () => {
    it('should return presigned download URL', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(fileRecordFixture());

      const result = await service.download('file-001', callerUser());

      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'aris-tenant-ke',
          key: 'abc123.pdf',
        }),
      );
      expect(result.data.downloadUrl).toContain('signed');
    });

    it('should throw NotFoundException for missing file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.download('file-999', callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong tenant', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.download('file-001', callerUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── softDelete() ──

  describe('softDelete', () => {
    it('should soft-delete the file record', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(fileRecordFixture());
      prisma.fileRecord.update.mockResolvedValue(
        fileRecordFixture({ status: 'DELETED', deletedAt: new Date() }),
      );

      const result = await service.softDelete('file-001', callerUser());

      expect(prisma.fileRecord.update).toHaveBeenCalledWith({
        where: { id: 'file-001' },
        data: expect.objectContaining({
          status: 'DELETED',
          deletedAt: expect.any(Date),
          deletedBy: 'user-001',
        }),
      });
      expect(result.data.message).toBe('File deleted');
    });

    it('should throw NotFoundException for missing file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.softDelete('file-999', callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for already deleted file', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ status: 'DELETED' }),
      );

      await expect(
        service.softDelete('file-001', callerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong tenant', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.softDelete('file-001', callerUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── serialize ──

  describe('serialize', () => {
    it('should convert bigint size to string', async () => {
      prisma.fileRecord.findUnique.mockResolvedValue(
        fileRecordFixture({ size: BigInt(999_999_999) }),
      );

      const result = await service.findOne('file-001', callerUser());

      expect(result.data.size).toBe('999999999');
      expect(typeof result.data.size).toBe('string');
    });
  });
});
