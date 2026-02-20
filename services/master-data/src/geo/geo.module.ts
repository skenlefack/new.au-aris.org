import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  controllers: [GeoController],
  providers: [PrismaService, AuditService, GeoService],
  exports: [GeoService],
})
export class GeoModule {}
