import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsObject,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateInventoryDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsUUID()
  protectedAreaId?: string;

  @IsOptional()
  @IsDateString()
  surveyDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  populationEstimate?: number;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsString()
  confidenceInterval?: string;

  @IsOptional()
  @IsString()
  conservationStatus?: string;

  @IsOptional()
  @IsString()
  threatLevel?: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
