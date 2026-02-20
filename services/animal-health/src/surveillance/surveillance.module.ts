import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { SurveillanceController } from './surveillance.controller';
import { SurveillanceService } from './surveillance.service';

@Module({
  controllers: [SurveillanceController],
  providers: [PrismaService, AuditService, SurveillanceService],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
