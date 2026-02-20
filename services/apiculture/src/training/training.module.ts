import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  controllers: [TrainingController],
  providers: [PrismaService, AuditService, TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
