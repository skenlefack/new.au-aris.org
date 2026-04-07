// Lightweight drive-service client for the web app.
//
// Used by the Knowledge Hub editor (TinyMCE image upload) and the
// publication form's attachment picker. Talks to services/drive (port 3007)
// via the unified Next.js rewrite, so no CORS configuration is needed.

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_URL']) || '';

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function uploadFile(
  file: File,
  opts?: { classification?: 'PUBLIC' | 'PARTNER' | 'RESTRICTED' | 'CONFIDENTIAL'; metadata?: Record<string, unknown> },
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.classification) form.append('classification', opts.classification);
  if (opts?.metadata) form.append('metadata', JSON.stringify(opts.metadata));

  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/drive/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const data = json.data ?? json;
  return {
    id: data.id,
    filename: data.originalFilename ?? data.filename ?? file.name,
    mimeType: data.mimeType ?? file.type,
    size: data.size ?? file.size,
  };
}

export async function getDownloadUrl(fileId: string): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/drive/files/${fileId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to fetch download URL (${res.status})`);
  const json = await res.json();
  return json.data?.downloadUrl ?? json.downloadUrl;
}

/** Detects an attachment kind from a MIME type. */
export function detectAttachmentKind(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'ARCHIVE' | 'OTHER' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'ARCHIVE';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType.startsWith('text/')
  )
    return 'DOCUMENT';
  return 'OTHER';
}
