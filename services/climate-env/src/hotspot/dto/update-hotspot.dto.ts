import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { HotspotType, HotspotSeverity } from '../entities/hotspot.entity';

export class UpdateHotspotDto {
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
  detectedDate?: string;

  @IsOptional()
  @IsString()
  satelliteSource?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedSpecies?: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
