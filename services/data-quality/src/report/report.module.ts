import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController],
  providers: [PrismaService, ReportService],
  exports: [ReportService],
})
export class ReportModule {}
