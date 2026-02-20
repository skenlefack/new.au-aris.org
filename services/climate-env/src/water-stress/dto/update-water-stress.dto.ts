import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateWaterStressDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  index?: number;

  @IsOptional()
  @IsString()
  waterAvailability?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  irrigatedAreaPct?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
