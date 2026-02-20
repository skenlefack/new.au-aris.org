import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CaptureController } from './capture.controller';
import { CaptureService } from './capture.service';

@Module({
  controllers: [CaptureController],
  providers: [PrismaService, AuditService, CaptureService],
  exports: [CaptureService],
})
export class CaptureModule {}
