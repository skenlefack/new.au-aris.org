import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';

@Module({
  controllers: [SpeciesController],
  providers: [PrismaService, AuditService, SpeciesService],
  exports: [SpeciesService],
})
export class SpeciesModule {}
