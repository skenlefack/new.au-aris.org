/**
 * DriveClient — HTTP wrapper for ARIS Drive service.
 * Downloads files for AI prompt enrichment.
 */

const DRIVE_URL = process.env.DRIVE_SERVICE_URL || 'http://localhost:3007';

export interface DriveFileMetadata {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: string;
  bucket: string;
  key: string;
}

export class DriveClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DRIVE_URL;
  }

  async getFileMetadata(fileId: string, token: string): Promise<DriveFileMetadata> {
    const resp = await fetch(`${this.baseUrl}/api/v1/drive/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`Drive metadata error: ${resp.status}`);
    const body = await resp.json() as { data: DriveFileMetadata };
    return body.data;
  }

  async downloadFile(fileId: string, token: string): Promise<Buffer> {
    const resp = await fetch(`${this.baseUrl}/api/v1/drive/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) throw new Error(`Drive download error: ${resp.status}`);

    // The endpoint may return a presigned URL or the file directly
    const contentType = resp.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Presigned URL response — follow the redirect
      const body = await resp.json() as { data: { url: string } };
      const fileResp = await fetch(body.data.url, { signal: AbortSignal.timeout(60_000) });
      return Buffer.from(await fileResp.arrayBuffer());
    }

    // Direct file response
    return Buffer.from(await resp.arrayBuffer());
  }
}
