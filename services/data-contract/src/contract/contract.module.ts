import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ComplianceModule } from '../compliance/compliance.module';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';

@Module({
  imports: [ComplianceModule],
  controllers: [ContractController],
  providers: [PrismaService, ContractService],
  exports: [ContractService],
})
export class ContractModule {}
