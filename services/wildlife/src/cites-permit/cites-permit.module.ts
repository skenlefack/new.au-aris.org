import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CitesPermitController } from './cites-permit.controller';
import { CitesPermitService } from './cites-permit.service';

@Module({
  controllers: [CitesPermitController],
  providers: [PrismaService, AuditService, CitesPermitService],
  exports: [CitesPermitService],
})
export class CitesPermitModule {}
