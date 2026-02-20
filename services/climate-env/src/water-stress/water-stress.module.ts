import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { WaterStressController } from './water-stress.controller';
import { WaterStressService } from './water-stress.service';

@Module({
  controllers: [WaterStressController],
  providers: [PrismaService, AuditService, WaterStressService],
  exports: [WaterStressService],
})
export class WaterStressModule {}
