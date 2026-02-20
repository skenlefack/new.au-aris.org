import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ValidateController } from './validate.controller';
import { ValidateService } from './validate.service';

@Module({
  controllers: [ValidateController],
  providers: [PrismaService, ValidateService],
  exports: [ValidateService],
})
export class ValidateModule {}
