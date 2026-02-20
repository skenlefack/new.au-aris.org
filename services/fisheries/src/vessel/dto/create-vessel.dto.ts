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

export class CreateVesselDto {
  @IsString()
  name!: string;

  @IsString()
  registrationNumber!: string;

  @IsString()
  flagState!: string;

  @IsString()
  vesselType!: string;

  @IsNumber()
  @Min(0)
  lengthMeters!: number;

  @IsNumber()
  @Min(0)
  tonnageGt!: number;

  @IsString()
  homePort!: string;

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
