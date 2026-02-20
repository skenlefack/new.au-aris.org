import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ELearningController } from './elearning.controller';
import { ELearningService } from './elearning.service';

@Module({
  controllers: [ELearningController],
  providers: [PrismaService, ELearningService],
  exports: [ELearningService],
})
export class ELearningModule {}
