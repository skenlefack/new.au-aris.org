import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PVSEvaluationType } from '../entities/pvs-evaluation.entity';

export class PVSEvaluationFilterDto {
  @IsOptional()
  @IsEnum(PVSEvaluationType)
  evaluationType?: PVSEvaluationType;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
