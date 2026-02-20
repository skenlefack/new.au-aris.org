import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { PvsEvaluationController } from './pvs-evaluation.controller';
import { PvsEvaluationService } from './pvs-evaluation.service';

@Module({
  controllers: [PvsEvaluationController],
  providers: [PrismaService, AuditService, PvsEvaluationService],
  exports: [PvsEvaluationService],
})
export class PvsEvaluationModule {}
