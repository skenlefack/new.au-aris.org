import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { DenominatorController } from './denominator.controller';
import { DenominatorService } from './denominator.service';

@Module({
  controllers: [DenominatorController],
  providers: [PrismaService, AuditService, DenominatorService],
  exports: [DenominatorService],
})
export class DenominatorModule {}
