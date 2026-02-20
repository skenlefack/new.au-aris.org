import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { StakeholderController } from './stakeholder.controller';
import { StakeholderService } from './stakeholder.service';

@Module({
  controllers: [StakeholderController],
  providers: [PrismaService, AuditService, StakeholderService],
  exports: [StakeholderService],
})
export class StakeholderModule {}
