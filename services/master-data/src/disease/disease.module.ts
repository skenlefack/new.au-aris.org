import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { DiseaseController } from './disease.controller';
import { DiseaseService } from './disease.service';

@Module({
  controllers: [DiseaseController],
  providers: [PrismaService, AuditService, DiseaseService],
  exports: [DiseaseService],
})
export class DiseaseModule {}
