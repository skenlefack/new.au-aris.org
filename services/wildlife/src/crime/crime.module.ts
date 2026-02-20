import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CrimeController } from './crime.controller';
import { CrimeService } from './crime.service';

@Module({
  controllers: [CrimeController],
  providers: [PrismaService, AuditService, CrimeService],
  exports: [CrimeService],
})
export class CrimeModule {}
