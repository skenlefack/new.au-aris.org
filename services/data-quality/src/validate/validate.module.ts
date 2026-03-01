import { Module } from '@nestjs/common';
import { EventConsumer } from '@aris/kafka-client';
import { PrismaService } from '../prisma.service';
import { ValidateController } from './validate.controller';
import { ValidateService } from './validate.service';
import { ValidationRequestConsumer } from './validation-request.consumer';

@Module({
  controllers: [ValidateController],
  providers: [PrismaService, EventConsumer, ValidateService, ValidationRequestConsumer],
  exports: [ValidateService],
})
export class ValidateModule {}
