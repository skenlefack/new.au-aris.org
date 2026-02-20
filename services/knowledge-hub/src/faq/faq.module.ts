import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';

@Module({
  controllers: [FaqController],
  providers: [PrismaService, FaqService],
  exports: [FaqService],
})
export class FaqModule {}
