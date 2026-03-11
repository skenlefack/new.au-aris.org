import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import * as Minio from 'minio';

export interface PutObjectOptions {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  bucket: string;
  key: string;
  expiresIn?: number;
}

const DEFAULT_PRESIGN_EXPIRY = 3600;
const INTEROP_BUCKET = 'interop-exports';

export class MinioStorage {
  private readonly client: Minio.Client;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
      port: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
      useSSL: process.env['MINIO_USE_SSL'] === 'true',
      accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
      secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin',
    });
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  async putObject(options: PutObjectOptions): Promise<void> {
    const metaData: Record<string, string> = {
      'Content-Type': options.contentType,
      ...options.metadata,
    };
    await this.client.putObject(
      options.bucket,
      options.key,
      options.body,
      options.body.length,
      metaData,
    );
  }

  async getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string> {
    const expiry = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    return this.client.presignedGetObject(options.bucket, options.key, expiry);
  }
}

export default fp(
  async (app: FastifyInstance) => {
    const minio = new MinioStorage();

    try {
      await minio.ensureBucket(INTEROP_BUCKET);
      app.log.info(`MinIO bucket "${INTEROP_BUCKET}" ensured`);
    } catch (err) {
      app.log.warn(`MinIO bucket setup failed (exports will fail): ${err}`);
    }

    app.decorate('minio', minio);
  },
  { name: 'minio' },
);
