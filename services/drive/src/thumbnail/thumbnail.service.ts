import { Injectable, Logger } from '@nestjs/common';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
]);

const THUMBNAIL_WIDTH = 256;
const THUMBNAIL_HEIGHT = 256;

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  isImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  async generate(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
    if (!this.isImage(mimeType)) {
      return null;
    }

    try {
      // Dynamic import to avoid hard crash if sharp is not available
      const sharp = (await import('sharp')).default;
      const thumbnail = await sharp(buffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      this.logger.debug(
        `Thumbnail generated: ${buffer.length} → ${thumbnail.length} bytes`,
      );
      return thumbnail;
    } catch (error) {
      this.logger.warn(
        `Thumbnail generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
