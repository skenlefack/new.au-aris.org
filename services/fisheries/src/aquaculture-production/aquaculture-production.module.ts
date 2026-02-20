import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { AquacultureProductionController } from './aquaculture-production.controller';
import { AquacultureProductionService } from './aquaculture-production.service';

@Module({
  controllers: [AquacultureProductionController],
  providers: [PrismaService, AuditService, AquacultureProductionService],
  exports: [AquacultureProductionService],
})
export class AquacultureProductionModule {}
