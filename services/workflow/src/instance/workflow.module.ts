import { Module } from '@nestjs/common';
import { EventPublisher, EventConsumer } from '@aris/kafka-client';
import { PrismaService } from '../prisma.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { QualityEventConsumer } from './quality-event.consumer';
import { WorkflowRequestConsumer } from './workflow-request.consumer';
import { EscalationService } from '../escalation/escalation.service';

@Module({
  controllers: [WorkflowController],
  providers: [
    PrismaService,
    EventPublisher,
    EventConsumer,
    WorkflowService,
    QualityEventConsumer,
    WorkflowRequestConsumer,
    EscalationService,
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
