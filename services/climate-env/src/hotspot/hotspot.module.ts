import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { HotspotController } from './hotspot.controller';
import { HotspotService } from './hotspot.service';

@Module({
  controllers: [HotspotController],
  providers: [PrismaService, AuditService, HotspotService],
  exports: [HotspotService],
})
export class HotspotModule {}
