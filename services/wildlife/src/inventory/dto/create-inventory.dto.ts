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

export class CreateInventoryDto {
  @IsUUID()
  speciesId!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsUUID()
  protectedAreaId?: string;

  @IsDateString()
  surveyDate!: string;

  @IsNumber()
  @Min(0)
  populationEstimate!: number;

  @IsString()
  methodology!: string;

  @IsOptional()
  @IsString()
  confidenceInterval?: string;

  @IsString()
  conservationStatus!: string;

  @IsString()
  threatLevel!: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
