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

export class CreateCrimeDto {
  @IsDateString()
  incidentDate!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsString()
  crimeType!: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  speciesIds!: string[];

  @IsString()
  description!: string;

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

  @IsString()
  reportingAgency!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
