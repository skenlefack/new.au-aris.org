import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { RangelandController } from './rangeland.controller';
import { RangelandService } from './rangeland.service';

@Module({
  controllers: [RangelandController],
  providers: [PrismaService, AuditService, RangelandService],
  exports: [RangelandService],
})
export class RangelandModule {}
