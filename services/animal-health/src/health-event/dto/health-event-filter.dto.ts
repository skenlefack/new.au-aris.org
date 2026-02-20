import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { EventType } from '../entities/health-event.entity';

export class HealthEventFilterDto {
  @IsOptional()
  @IsUUID()
  diseaseId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsEnum(['SUSPECT', 'CONFIRMED', 'RESOLVED'] as const)
  status?: EventType;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
