import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsArray,
  IsObject,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateCrimeDto {
  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsOptional()
  @IsString()
  crimeType?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  suspectsCount?: number;

  @IsOptional()
  @IsString()
  seizureDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  seizureQuantity?: number;

  @IsOptional()
  @IsString()
  seizureUnit?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  reportingAgency?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
