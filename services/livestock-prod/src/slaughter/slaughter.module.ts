import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { SlaughterController } from './slaughter.controller';
import { SlaughterService } from './slaughter.service';

@Module({
  controllers: [SlaughterController],
  providers: [PrismaService, AuditService, SlaughterService],
  exports: [SlaughterService],
})
export class SlaughterModule {}
