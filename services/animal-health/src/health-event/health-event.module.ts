import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { HealthEventController } from './health-event.controller';
import { HealthEventService } from './health-event.service';

@Module({
  controllers: [HealthEventController],
  providers: [PrismaService, AuditService, HealthEventService],
  exports: [HealthEventService],
})
export class HealthEventModule {}
