import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';

@Module({
  controllers: [UnitController],
  providers: [PrismaService, AuditService, UnitService],
  exports: [UnitService],
})
export class UnitModule {}
