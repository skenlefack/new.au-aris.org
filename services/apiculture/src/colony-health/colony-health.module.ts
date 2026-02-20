import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { ColonyHealthController } from './colony-health.controller';
import { ColonyHealthService } from './colony-health.service';

@Module({
  controllers: [ColonyHealthController],
  providers: [PrismaService, AuditService, ColonyHealthService],
  exports: [ColonyHealthService],
})
export class ColonyHealthModule {}
