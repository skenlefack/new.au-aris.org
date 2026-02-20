import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateVesselDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  flagState?: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthMeters?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tonnageGt?: number;

  @IsOptional()
  @IsString()
  homePort?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
