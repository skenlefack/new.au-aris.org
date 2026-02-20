import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { LegalFrameworkController } from './legal-framework.controller';
import { LegalFrameworkService } from './legal-framework.service';

@Module({
  controllers: [LegalFrameworkController],
  providers: [PrismaService, AuditService, LegalFrameworkService],
  exports: [LegalFrameworkService],
})
export class LegalFrameworkModule {}
