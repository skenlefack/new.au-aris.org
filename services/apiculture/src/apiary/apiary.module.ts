import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { ApiaryController } from './apiary.controller';
import { ApiaryService } from './apiary.service';

@Module({
  controllers: [ApiaryController],
  providers: [PrismaService, AuditService, ApiaryService],
  exports: [ApiaryService],
})
export class ApiaryModule {}
