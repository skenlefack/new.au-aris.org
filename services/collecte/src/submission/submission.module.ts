import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';

@Module({
  controllers: [SubmissionController],
  providers: [PrismaService, SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
