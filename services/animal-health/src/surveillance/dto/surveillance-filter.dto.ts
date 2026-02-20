import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { SurveillanceType } from '../entities/surveillance.entity';

export class SurveillanceFilterDto {
  @IsOptional()
  @IsEnum(['PASSIVE', 'ACTIVE', 'SENTINEL', 'EVENT_BASED'] as const)
  type?: SurveillanceType;

  @IsOptional()
  @IsUUID()
  diseaseId?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
