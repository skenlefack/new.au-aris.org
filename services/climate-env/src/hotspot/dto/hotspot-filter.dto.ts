import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { HotspotType, HotspotSeverity } from '../entities/hotspot.entity';

export class HotspotFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsEnum(['DEFORESTATION', 'DESERTIFICATION', 'FLOODING', 'DROUGHT', 'POLLUTION'] as const)
  type?: HotspotType;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  severity?: HotspotSeverity;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
