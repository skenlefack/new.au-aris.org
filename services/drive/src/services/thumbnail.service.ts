const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
]);

const THUMBNAIL_WIDTH = 256;
const THUMBNAIL_HEIGHT = 256;

export class ThumbnailService {
  isImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  async generate(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
    if (!this.isImage(mimeType)) {
      return null;
    }

    try {
      const sharp = (await import('sharp')).default;
      const thumbnail = await sharp(buffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
      return thumbnail;
    } catch {
      return null;
    }
  }
}
