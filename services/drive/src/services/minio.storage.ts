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
  contentType?: string;
}

export interface StorageAdapter {
  ensureBucket(bucket: string): Promise<void>;
  putObject(options: PutObjectOptions): Promise<void>;
  getObject(bucket: string, key: string): Promise<Buffer>;
  deleteObject(bucket: string, key: string): Promise<void>;
  getPresignedUploadUrl(options: PresignedUrlOptions): Promise<string>;
  getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string>;
}

const DEFAULT_PRESIGN_EXPIRY = 3600;

export class MinioStorage implements StorageAdapter {
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
    await this.client.putObject(options.bucket, options.key, options.body, options.body.length, metaData);
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async getPresignedUploadUrl(options: PresignedUrlOptions): Promise<string> {
    const expiry = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    return this.client.presignedPutObject(options.bucket, options.key, expiry);
  }

  async getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string> {
    const expiry = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    return this.client.presignedGetObject(options.bucket, options.key, expiry);
  }
}
