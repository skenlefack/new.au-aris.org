import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { ProtectedAreaController } from './protected-area.controller';
import { ProtectedAreaService } from './protected-area.service';

@Module({
  controllers: [ProtectedAreaController],
  providers: [PrismaService, AuditService, ProtectedAreaService],
  exports: [ProtectedAreaService],
})
export class ProtectedAreaModule {}
