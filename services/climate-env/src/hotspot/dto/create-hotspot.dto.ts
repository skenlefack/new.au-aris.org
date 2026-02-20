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

export class CreateHotspotDto {
  @IsUUID()
  geoEntityId!: string;

  @IsEnum(['DEFORESTATION', 'DESERTIFICATION', 'FLOODING', 'DROUGHT', 'POLLUTION'] as const)
  type!: HotspotType;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  severity!: HotspotSeverity;

  @IsDateString()
  detectedDate!: string;

  @IsOptional()
  @IsString()
  satelliteSource?: string;

  @IsArray()
  @IsString({ each: true })
  affectedSpecies!: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
