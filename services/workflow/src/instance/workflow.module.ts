import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { EscalationService } from '../escalation/escalation.service';

@Module({
  controllers: [WorkflowController],
  providers: [PrismaService, WorkflowService, EscalationService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
