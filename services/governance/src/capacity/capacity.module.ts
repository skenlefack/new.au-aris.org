import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';

@Module({
  controllers: [CapacityController],
  providers: [PrismaService, AuditService, CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
