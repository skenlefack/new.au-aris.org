import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CorrectionController } from './correction.controller';
import { CorrectionService } from './correction.service';

@Module({
  controllers: [CorrectionController],
  providers: [PrismaService, CorrectionService],
  exports: [CorrectionService],
})
export class CorrectionModule {}
