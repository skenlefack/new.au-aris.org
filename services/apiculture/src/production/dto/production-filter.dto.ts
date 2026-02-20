import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { HoneyQuality } from './create-production.dto';

export class ProductionFilterDto {
  @IsOptional()
  @IsUUID()
  apiaryId?: string;

  @IsOptional()
  @IsEnum(HoneyQuality)
  quality?: HoneyQuality;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
