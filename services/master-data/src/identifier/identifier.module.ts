import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentifierController } from './identifier.controller';
import { IdentifierService } from './identifier.service';

@Module({
  controllers: [IdentifierController],
  providers: [PrismaService, AuditService, IdentifierService],
  exports: [IdentifierService],
})
export class IdentifierModule {}
