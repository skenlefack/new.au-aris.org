import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { TemporalityController } from './temporality.controller';
import { TemporalityService } from './temporality.service';

@Module({
  controllers: [TemporalityController],
  providers: [PrismaService, AuditService, TemporalityService],
  exports: [TemporalityService],
})
export class TemporalityModule {}
