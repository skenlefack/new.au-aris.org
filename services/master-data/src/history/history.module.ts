import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

@Module({
  controllers: [HistoryController],
  providers: [PrismaService, AuditService, HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
