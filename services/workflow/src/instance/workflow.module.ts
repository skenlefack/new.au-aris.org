import { Module } from '@nestjs/common';
import { AnimalHealthClient } from '@aris/service-clients';
import { PrismaService } from '../prisma.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { QualityEventConsumer } from './quality-event.consumer';
import { EscalationService } from '../escalation/escalation.service';

@Module({
  controllers: [WorkflowController],
  providers: [
    PrismaService,
    {
      provide: AnimalHealthClient,
      useFactory: () => new AnimalHealthClient(),
    },
    WorkflowService,
    QualityEventConsumer,
    EscalationService,
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
