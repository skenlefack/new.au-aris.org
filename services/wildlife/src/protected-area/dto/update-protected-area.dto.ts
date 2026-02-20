import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateProtectedAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  wdpaId?: string;

  @IsOptional()
  @IsString()
  iucnCategory?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaKm2?: number;

  @IsOptional()
  @IsDateString()
  designationDate?: string;

  @IsOptional()
  @IsString()
  managingAuthority?: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
