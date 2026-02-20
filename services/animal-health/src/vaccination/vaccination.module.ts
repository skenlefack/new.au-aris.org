import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { VaccinationController } from './vaccination.controller';
import { VaccinationService } from './vaccination.service';

@Module({
  controllers: [VaccinationController],
  providers: [PrismaService, AuditService, VaccinationService],
  exports: [VaccinationService],
})
export class VaccinationModule {}
