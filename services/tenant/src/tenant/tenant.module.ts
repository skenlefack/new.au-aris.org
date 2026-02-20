import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController],
  providers: [PrismaService, TenantService],
  exports: [TenantService],
})
export class TenantModule {}
