import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { ClimateDataController } from './climate-data.controller';
import { ClimateDataService } from './climate-data.service';

@Module({
  controllers: [ClimateDataController],
  providers: [PrismaService, AuditService, ClimateDataService],
  exports: [ClimateDataService],
})
export class ClimateDataModule {}
