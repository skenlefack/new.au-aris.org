import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

@Module({
  controllers: [ImportExportController],
  providers: [PrismaService, AuditService, ImportExportService],
  exports: [ImportExportService],
})
export class ImportExportModule {}
