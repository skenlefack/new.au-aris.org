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

export class CreateProtectedAreaDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  wdpaId?: string;

  @IsString()
  iucnCategory!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsNumber()
  @Min(0)
  areaKm2!: number;

  @IsOptional()
  @IsDateString()
  designationDate?: string;

  @IsString()
  managingAuthority!: string;

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
