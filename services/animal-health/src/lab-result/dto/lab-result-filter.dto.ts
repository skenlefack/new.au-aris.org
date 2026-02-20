import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { LabTestResult } from '../entities/lab-result.entity';

export class LabResultFilterDto {
  @IsOptional()
  @IsUUID()
  healthEventId?: string;

  @IsOptional()
  @IsUUID()
  labId?: string;

  @IsOptional()
  @IsEnum(['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'] as const)
  result?: LabTestResult;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
