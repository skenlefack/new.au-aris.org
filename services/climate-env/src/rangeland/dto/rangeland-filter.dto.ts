import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { DegradationLevel } from '../entities/rangeland.entity';

export class RangelandFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsEnum(['NONE', 'LIGHT', 'MODERATE', 'SEVERE'] as const)
  degradationLevel?: DegradationLevel;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
