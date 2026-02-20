import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaService } from '../prisma.service';
import { MinioStorage } from '../storage/minio.storage';
import { MockScanner } from '../scanner/mock.scanner';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { STORAGE_ADAPTER } from '../storage/storage.interface';
import { SCANNER_ADAPTER } from '../scanner/scanner.interface';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // memory storage (buffer)
    }),
  ],
  controllers: [FileController],
  providers: [
    PrismaService,
    FileService,
    ThumbnailService,
    { provide: STORAGE_ADAPTER, useClass: MinioStorage },
    { provide: SCANNER_ADAPTER, useClass: MockScanner },
  ],
  exports: [FileService],
})
export class FileModule {}
