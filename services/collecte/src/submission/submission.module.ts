import { Module } from '@nestjs/common';
import { DataQualityClient, WorkflowClient } from '@aris/service-clients';
import { PrismaService } from '../prisma.service';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';

@Module({
  controllers: [SubmissionController],
  providers: [
    PrismaService,
    {
      provide: DataQualityClient,
      useFactory: () => new DataQualityClient(),
    },
    {
      provide: WorkflowClient,
      useFactory: () => new WorkflowClient(),
    },
    SubmissionService,
  ],
  exports: [SubmissionService],
})
export class SubmissionModule {}
