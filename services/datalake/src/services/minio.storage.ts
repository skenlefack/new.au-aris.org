import * as Minio from 'minio';

const DEFAULT_PRESIGN_EXPIRY = 3600;
const EXPORT_BUCKET = 'aris-datalake-exports';

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

  get defaultBucket(): string {
    return EXPORT_BUCKET;
  }

  async ensureBucket(bucket: string = EXPORT_BUCKET): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  async putObject(options: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
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

  async getPresignedDownloadUrl(options: {
    bucket: string;
    key: string;
    expiresIn?: number;
  }): Promise<string> {
    const expiry = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    return this.client.presignedGetObject(options.bucket, options.key, expiry);
  }
}
