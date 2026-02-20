import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { TradeFlowController } from './trade-flow.controller';
import { TradeFlowService } from './trade-flow.service';

@Module({
  controllers: [TradeFlowController],
  providers: [PrismaService, AuditService, TradeFlowService],
  exports: [TradeFlowService],
})
export class TradeFlowModule {}
