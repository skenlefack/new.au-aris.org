import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  controllers: [TemplateController],
  providers: [PrismaService, TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
