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

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
