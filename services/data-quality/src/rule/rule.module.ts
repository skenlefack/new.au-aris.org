import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RuleController } from './rule.controller';
import { RuleService } from './rule.service';

@Module({
  controllers: [RuleController],
  providers: [PrismaService, RuleService],
  exports: [RuleService],
})
export class RuleModule {}
