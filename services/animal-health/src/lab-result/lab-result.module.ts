import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { LabResultController } from './lab-result.controller';
import { LabResultService } from './lab-result.service';

@Module({
  controllers: [LabResultController],
  providers: [PrismaService, AuditService, LabResultService],
  exports: [LabResultService],
})
export class LabResultModule {}
