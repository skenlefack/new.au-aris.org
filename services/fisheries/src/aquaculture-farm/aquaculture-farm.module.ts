import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { AquacultureFarmController } from './aquaculture-farm.controller';
import { AquacultureFarmService } from './aquaculture-farm.service';

@Module({
  controllers: [AquacultureFarmController],
  providers: [PrismaService, AuditService, AquacultureFarmService],
  exports: [AquacultureFarmService],
})
export class AquacultureFarmModule {}
