import { Module } from '@nestjs/common';
import { EventConsumer } from '@aris/kafka-client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { HealthEventController } from './health-event.controller';
import { HealthEventService } from './health-event.service';
import { WorkflowFlagConsumer } from './workflow-flag.consumer';

@Module({
  controllers: [HealthEventController],
  providers: [PrismaService, AuditService, EventConsumer, HealthEventService, WorkflowFlagConsumer],
  exports: [HealthEventService],
})
export class HealthEventModule {}
