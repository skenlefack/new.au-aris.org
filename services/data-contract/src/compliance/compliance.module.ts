import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ComplianceService } from './compliance.service';
import { ComplianceConsumer } from './compliance.consumer';

@Module({
  providers: [PrismaService, ComplianceService, ComplianceConsumer],
  exports: [ComplianceService],
})
export class ComplianceModule {}
