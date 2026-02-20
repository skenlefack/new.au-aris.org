import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { VesselController } from './vessel.controller';
import { VesselService } from './vessel.service';

@Module({
  controllers: [VesselController],
  providers: [PrismaService, AuditService, VesselService],
  exports: [VesselService],
})
export class VesselModule {}
