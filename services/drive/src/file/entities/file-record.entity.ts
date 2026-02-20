export interface FileRecordEntity {
  id: string;
  tenantId: string;
  bucket: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  size: string;
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
}
