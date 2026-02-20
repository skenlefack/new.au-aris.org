import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CensusController } from './census.controller';
import { CensusService } from './census.service';

@Module({
  controllers: [CensusController],
  providers: [PrismaService, AuditService, CensusService],
  exports: [CensusService],
})
export class CensusModule {}
