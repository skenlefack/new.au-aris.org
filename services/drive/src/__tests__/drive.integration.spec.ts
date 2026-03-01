/**
 * Integration test for the Drive service.
 *
 * Uses Testcontainers to spin up real PostgreSQL and MinIO containers.
 * Tests the full flow: upload file → store in MinIO → verify metadata in PG.
 */
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as Minio from 'minio';

let pgContainer: StartedTestContainer;
let minioContainer: StartedTestContainer;
let prisma: PrismaClient;
let minioClient: Minio.Client;
let databaseUrl: string;
let minioHost: string;
let minioPort: number;

beforeAll(async () => {
  // Start PostgreSQL
  pgContainer = await new GenericContainer('postgres:16-alpine')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_USER: 'aris',
      POSTGRES_PASSWORD: 'aris',
      POSTGRES_DB: 'aris_test',
    })
    .withWaitStrategy(
      Wait.forLogMessage('database system is ready to accept connections'),
    )
    .start();

  const pgHost = pgContainer.getHost();
  const pgPort = pgContainer.getMappedPort(5432);
  databaseUrl = `postgresql://aris:aris@${pgHost}:${pgPort}/aris_test`;

  // Start MinIO
  minioContainer = await new GenericContainer('minio/minio:latest')
    .withExposedPorts(9000)
    .withEnvironment({
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
    })
    .withCommand(['server', '/data'])
    .withWaitStrategy(Wait.forLogMessage('API:'))
    .start();

  minioHost = minioContainer.getHost();
  minioPort = minioContainer.getMappedPort(9000);

  // Set env vars
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['MINIO_ENDPOINT'] = minioHost;
  process.env['MINIO_PORT'] = String(minioPort);
  process.env['MINIO_USE_SSL'] = 'false';
  process.env['MINIO_ACCESS_KEY'] = 'minioadmin';
  process.env['MINIO_SECRET_KEY'] = 'minioadmin';

  // Push Prisma schema
  const schemaPath = require
    .resolve('@aris/db-schemas/prisma/schema.prisma')
    .replace(/schema\.prisma$/, '');
  execSync(
    `npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`,
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  // Create MinIO client for verification
  minioClient = new Minio.Client({
    endPoint: minioHost,
    port: minioPort,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });

  // Seed a tenant
  await prisma.tenant.create({
    data: {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'African Union - IBAR',
      code: 'AU-IBAR',
      level: 'CONTINENTAL',
      domain: 'au-aris.org',
      config: {},
    },
  });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await pgContainer?.stop();
  await minioContainer?.stop();
}, 30_000);

describe('Drive Service Integration', () => {
  const tenantId = '00000000-0000-4000-a000-000000000001';
  const bucket = `aris-${tenantId}`;

  it('should create bucket and upload file to MinIO', async () => {
    // Dynamically import to use env vars set above
    const { MinioStorage } = await import('../services/minio.storage');
    const storage = new MinioStorage();

    // Ensure bucket
    await storage.ensureBucket(bucket);

    // Verify bucket exists
    const exists = await minioClient.bucketExists(bucket);
    expect(exists).toBe(true);

    // Upload a file
    const content = Buffer.from('Test PDF content for ARIS outbreak report');
    const key = 'test-upload-001.pdf';

    await storage.putObject({
      bucket,
      key,
      body: content,
      contentType: 'application/pdf',
    });

    // Verify object exists by fetching it
    const downloaded = await storage.getObject(bucket, key);
    expect(downloaded.toString()).toBe('Test PDF content for ARIS outbreak report');
  });

  it('should generate presigned URLs', async () => {
    const { MinioStorage } = await import('../services/minio.storage');
    const storage = new MinioStorage();

    await storage.ensureBucket(bucket);

    // Upload URL
    const uploadUrl = await storage.getPresignedUploadUrl({
      bucket,
      key: 'presigned-upload.pdf',
      expiresIn: 3600,
    });
    expect(uploadUrl).toContain(bucket);
    expect(uploadUrl).toContain('presigned-upload.pdf');

    // Download URL (needs existing object)
    await storage.putObject({
      bucket,
      key: 'presigned-download.pdf',
      body: Buffer.from('content'),
      contentType: 'application/pdf',
    });

    const downloadUrl = await storage.getPresignedDownloadUrl({
      bucket,
      key: 'presigned-download.pdf',
      expiresIn: 3600,
    });
    expect(downloadUrl).toContain(bucket);
    expect(downloadUrl).toContain('presigned-download.pdf');
  });

  it('should store file metadata in PostgreSQL', async () => {
    const record = await prisma.fileRecord.create({
      data: {
        tenantId,
        bucket,
        key: 'integration-test-file.pdf',
        originalFilename: 'outbreak-report-2024.pdf',
        mimeType: 'application/pdf',
        size: BigInt(2048),
        classification: 'RESTRICTED',
        uploadedBy: '00000000-0000-4000-b000-000000000001',
        scanStatus: 'CLEAN',
      },
    });

    expect(record.id).toBeDefined();
    expect(record.originalFilename).toBe('outbreak-report-2024.pdf');
    expect(record.size).toBe(BigInt(2048));
    expect(record.status).toBe('ACTIVE');
  });

  it('should soft-delete a file record', async () => {
    const record = await prisma.fileRecord.create({
      data: {
        tenantId,
        bucket,
        key: 'to-delete.pdf',
        originalFilename: 'temp-file.pdf',
        mimeType: 'application/pdf',
        size: BigInt(512),
        classification: 'PUBLIC',
        uploadedBy: '00000000-0000-4000-b000-000000000001',
        scanStatus: 'CLEAN',
      },
    });

    // Soft delete
    const deleted = await prisma.fileRecord.update({
      where: { id: record.id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: '00000000-0000-4000-b000-000000000001',
      },
    });

    expect(deleted.status).toBe('DELETED');
    expect(deleted.deletedAt).toBeDefined();

    // Verify it doesn't appear in active list
    const activeFiles = await prisma.fileRecord.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const found = activeFiles.find((f) => f.id === record.id);
    expect(found).toBeUndefined();
  });

  it('should list files with pagination and filtering', async () => {
    // Create multiple files
    for (let i = 0; i < 5; i++) {
      await prisma.fileRecord.create({
        data: {
          tenantId,
          bucket,
          key: `paginated-${i}.csv`,
          originalFilename: `data-${i}.csv`,
          mimeType: 'text/csv',
          size: BigInt(100 * (i + 1)),
          classification: i < 3 ? 'PUBLIC' : 'RESTRICTED',
          uploadedBy: '00000000-0000-4000-b000-000000000001',
          scanStatus: 'CLEAN',
        },
      });
    }

    // Page 1, limit 3
    const page1 = await prisma.fileRecord.findMany({
      where: { tenantId, status: 'ACTIVE', mimeType: 'text/csv' },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    expect(page1).toHaveLength(3);

    // Filter by classification
    const publicFiles = await prisma.fileRecord.findMany({
      where: { tenantId, status: 'ACTIVE', mimeType: 'text/csv', classification: 'PUBLIC' },
    });
    expect(publicFiles).toHaveLength(3);

    const restrictedFiles = await prisma.fileRecord.findMany({
      where: { tenantId, status: 'ACTIVE', mimeType: 'text/csv', classification: 'RESTRICTED' },
    });
    expect(restrictedFiles).toHaveLength(2);
  });

  it('should delete object from MinIO', async () => {
    const { MinioStorage } = await import('../services/minio.storage');
    const storage = new MinioStorage();

    await storage.ensureBucket(bucket);

    // Upload then delete
    const key = 'to-remove-from-minio.txt';
    await storage.putObject({
      bucket,
      key,
      body: Buffer.from('ephemeral'),
      contentType: 'text/plain',
    });

    await storage.deleteObject(bucket, key);

    // Verify object is gone
    await expect(
      storage.getObject(bucket, key),
    ).rejects.toThrow();
  });
});
