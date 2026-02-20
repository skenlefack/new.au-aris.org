import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { TranshumanceController } from './transhumance.controller';
import { TranshumanceService } from './transhumance.service';

@Module({
  controllers: [TranshumanceController],
  providers: [PrismaService, AuditService, TranshumanceService],
  exports: [TranshumanceService],
})
export class TranshumanceModule {}
