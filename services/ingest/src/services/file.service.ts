import { randomUUID, createHash } from 'crypto';
import { Readable, Transform, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { Client as MinioClient } from 'minio';
import type Redis from 'ioredis';

const SERVICE_NAME = 'ingest-service';
const BUCKET_PREFIX = 'aris-';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

interface UploadedFile {
  filename: string;
  mimetype: string;
  file: NodeJS.ReadableStream;
}

export class FileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly minio: MinioClient,
    private readonly redis: Redis,
  ) {}

  // ── Upload ──

  async upload(data: UploadedFile, user: AuthenticatedUser, requestedDomain?: string) {
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CONTINENTAL_ADMIN';
    const domainCodes = Object.keys(user.domains ?? {});

    // Resolve domain: from request param, JWT domains, or default for admins
    let domainCode = requestedDomain ?? domainCodes[0] ?? '';
    if (!domainCode && isAdmin) {
      domainCode = 'animal-health'; // Default for admins with no domain in JWT
    }
    if (!domainCode) {
      throw new HttpError(403, 'User has no domain access. Specify a domain query parameter.');
    }

    // Validate MIME type
    const allowedMimes = [
      'text/csv', 'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/json',
      'application/octet-stream',
    ];
    if (!allowedMimes.includes(data.mimetype) && !data.filename.match(/\.(csv|xlsx|xls|json)$/i)) {
      throw new HttpError(400, `Unsupported file type: ${data.mimetype}`);
    }

    // R5: Stream upload to MinIO without loading entire file in memory.
    // SHA-256 is computed via a passthrough transform during the stream.
    const bucket = `${BUCKET_PREFIX}${user.tenantId}`;
    const minioKey = `ingest/${domainCode}/${randomUUID()}/${data.filename}`;
    await this.ensureBucket(bucket);

    const hash = createHash('sha256');
    let fileSize = 0;
    const hashTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        fileSize += chunk.length;
        callback(null, chunk);
      },
    });

    // Pipe: file stream → hash transform → MinIO
    const source = data.file as unknown as Readable;
    const passthrough = new PassThrough();
    source.pipe(hashTransform).pipe(passthrough);

    await this.minio.putObject(bucket, minioKey, passthrough, undefined, {
      'Content-Type': data.mimetype,
      'x-amz-meta-uploaded-by': user.userId,
    });

    const sha256 = hash.digest('hex');

    // Check for duplicate file (after upload to avoid re-streaming)
    const existing = await (this.prisma as any).ingestFile.findFirst({
      where: { sha256, tenantId: user.tenantId, status: { not: 'CANCELLED' } },
    });
    if (existing) {
      // Duplicate found — remove the just-uploaded file
      try { await this.minio.removeObject(bucket, minioKey); } catch { /* best-effort */ }
      return { data: { ...existing, fileSize: Number(existing.fileSize) }, meta: { duplicate: true } };
    }

    // Create IngestFile record
    const file = await (this.prisma as any).ingestFile.create({
      data: {
        tenantId: user.tenantId,
        domainCode,
        filename: data.filename,
        mimeType: data.mimetype,
        fileSize: BigInt(fileSize),
        sha256,
        minioKey,
        minioBucket: bucket,
        status: 'QUARANTINE',
        uploadedBy: user.userId,
      },
    });

    // Publish Kafka event for async profiling
    await this.publishEvent('ingest.file.received.v1', {
      fileId: file.id,
      minioKey,
      minioBucket: bucket,
      tenantId: user.tenantId,
      domainCode,
      userId: user.userId,
      filename: data.filename,
      mimeType: data.mimetype,
      fileSize,
    }, user);

    return { data: { ...file, fileSize: Number(file.fileSize) } };
  }

  // ── List ──

  async list(user: AuthenticatedUser, query: { page: number; limit: number; status?: string }) {
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (query.status) where['status'] = query.status;

    const [data, total] = await Promise.all([
      (this.prisma as any).ingestFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      (this.prisma as any).ingestFile.count({ where }),
    ]);

    return {
      data: data.map((f: Record<string, unknown>) => ({ ...f, fileSize: Number(f.fileSize) })),
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  // ── Get by ID ──

  async getById(id: string, user: AuthenticatedUser) {
    const file = await (this.prisma as any).ingestFile.findUnique({
      where: { id },
      include: { profile: true, matchProposals: { orderBy: { rank: 'asc' } }, campaignResolution: true },
    });
    if (!file || file.tenantId !== user.tenantId) {
      throw new HttpError(404, `File ${id} not found`);
    }
    return { data: { ...file, fileSize: Number(file.fileSize) } };
  }

  // ── Profile ──

  async getProfile(id: string, user: AuthenticatedUser) {
    const file = await this.assertFileAccess(id, user);
    const profile = await (this.prisma as any).sourceProfile.findUnique({
      where: { fileId: id },
      include: { columns: { orderBy: { columnIndex: 'asc' } } },
    });
    if (!profile) {
      throw new HttpError(404, 'Profile not yet available — file is still being processed');
    }
    return { data: profile };
  }

  // ── Proposals ──

  async getProposals(id: string, user: AuthenticatedUser) {
    await this.assertFileAccess(id, user);
    const proposals = await (this.prisma as any).matchProposal.findMany({
      where: { fileId: id },
      include: { fieldMappings: true },
      orderBy: { rank: 'asc' },
    });
    return { data: proposals };
  }

  // ── Confirm Mapping ──

  async confirmMapping(id: string, body: Record<string, unknown>, user: AuthenticatedUser) {
    const file = await this.assertFileAccess(id, user);
    const proposalId = body.proposalId as string;
    const corrections = body.corrections as Array<{ sourceColumn: string; targetFieldCode: string; transformation?: unknown }> | undefined;

    // Accept the proposal
    await (this.prisma as any).matchProposal.update({
      where: { id: proposalId },
      data: { status: 'ACCEPTED' },
    });

    // Apply corrections if any
    if (corrections && corrections.length > 0) {
      for (const corr of corrections) {
        await (this.prisma as any).fieldMapping.updateMany({
          where: { proposalId, sourceColumn: corr.sourceColumn },
          data: {
            targetFieldCode: corr.targetFieldCode,
            transformation: corr.transformation as any ?? null,
            origin: 'CORRECTED',
          },
        });

        // Store correction for learning
        await (this.prisma as any).mappingCorrection.create({
          data: {
            tenantId: user.tenantId,
            domainCode: file.domainCode,
            sourceColumnName: corr.sourceColumn,
            correctedConcept: corr.targetFieldCode,
            targetFieldCode: corr.targetFieldCode,
            templateId: (await (this.prisma as any).matchProposal.findUnique({ where: { id: proposalId }, select: { templateId: true } }))?.templateId ?? '',
            correctedBy: user.userId,
          },
        });
      }
    }

    // Update file status
    await (this.prisma as any).ingestFile.update({
      where: { id },
      data: { status: 'MAPPED' },
    });

    return { data: { fileId: id, status: 'MAPPED', proposalId } };
  }

  // ── Campaign Resolution ──

  async resolveCampaign(id: string, body: Record<string, unknown>, user: AuthenticatedUser) {
    await this.assertFileAccess(id, user);
    const campaignId = body.campaignId as string | undefined;
    const isNewCampaign = body.isNewCampaign as boolean ?? false;

    const resolution = await (this.prisma as any).campaignResolution.upsert({
      where: { fileId: id },
      create: {
        fileId: id,
        campaignId: campaignId ?? null,
        isNewCampaign,
        derivedParams: body.derivedParams as any ?? null,
        status: 'CONFIRMED',
      },
      update: {
        campaignId: campaignId ?? null,
        isNewCampaign,
        derivedParams: body.derivedParams as any ?? null,
        status: 'CONFIRMED',
      },
    });

    return { data: resolution };
  }

  // ── Dry Run ──

  async dryRun(id: string, user: AuthenticatedUser) {
    const file = await this.assertFileAccess(id, user);
    if (file.status !== 'MAPPED') {
      throw new HttpError(400, 'File must be in MAPPED status to run dry-run');
    }

    await (this.prisma as any).ingestFile.update({
      where: { id },
      data: { status: 'DRY_RUN' },
    });

    // Publish event for async dry-run processing
    await this.publishEvent('ingest.mapping.confirmed.v1', {
      fileId: id,
      dryRun: true,
      tenantId: user.tenantId,
      domainCode: file.domainCode,
    }, user);

    return { data: { fileId: id, status: 'DRY_RUN', message: 'Dry-run started. Check quality report when ready.' } };
  }

  // ── Quality Report ──

  async getQualityReport(id: string, user: AuthenticatedUser) {
    await this.assertFileAccess(id, user);
    const run = await (this.prisma as any).ingestRun.findFirst({
      where: { fileId: id, type: 'DRY_RUN' },
      orderBy: { createdAt: 'desc' },
      include: {
        rowOutcomes: {
          orderBy: { rowIndex: 'asc' },
          take: 500,
        },
      },
    });
    if (!run) {
      throw new HttpError(404, 'No dry-run report available yet');
    }
    return { data: run };
  }

  // ── Commit (R3: requires prior dry-run) ──

  async commit(id: string, user: AuthenticatedUser) {
    const file = await this.assertFileAccess(id, user);

    // R3: Must have a successful dry-run before commit
    const dryRun = await (this.prisma as any).ingestRun.findFirst({
      where: { fileId: id, type: 'DRY_RUN', status: 'COMPLETED' },
    });
    if (!dryRun) {
      throw new HttpError(400, 'A successful dry-run is required before commit (R3)');
    }

    await (this.prisma as any).ingestFile.update({
      where: { id },
      data: { status: 'COMMITTED' },
    });

    // Publish event for async loading
    await this.publishEvent('ingest.mapping.confirmed.v1', {
      fileId: id,
      dryRun: false,
      tenantId: user.tenantId,
      domainCode: file.domainCode,
    }, user);

    return { data: { fileId: id, status: 'COMMITTED', message: 'Loading started.' } };
  }

  // ── Cancel ──

  async cancel(id: string, user: AuthenticatedUser) {
    const file = await this.assertFileAccess(id, user);

    // Purge from MinIO
    try {
      await this.minio.removeObject(file.minioBucket, file.minioKey);
    } catch { /* best-effort */ }

    await (this.prisma as any).ingestFile.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { data: { fileId: id, status: 'CANCELLED' } };
  }

  // ── Helpers ──

  private async assertFileAccess(id: string, user: AuthenticatedUser) {
    const file = await (this.prisma as any).ingestFile.findUnique({ where: { id } });
    if (!file || file.tenantId !== user.tenantId) {
      throw new HttpError(404, `File ${id} not found`);
    }
    return file;
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      const exists = await this.minio.bucketExists(bucket);
      if (!exists) await this.minio.makeBucket(bucket);
    } catch { /* best-effort */ }
  }

  private async publishEvent(topic: string, payload: Record<string, unknown>, user: AuthenticatedUser): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      const key = (payload.fileId as string) ?? randomUUID();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka send timeout')), 5000),
      );
      await Promise.race([this.kafka.send(topic, key, payload, headers), timeout]);
    } catch { /* non-blocking */ }
  }
}
