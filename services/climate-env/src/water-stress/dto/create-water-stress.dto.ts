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

export class CreateWaterStressDto {
  @IsUUID()
  geoEntityId!: string;

  @IsString()
  period!: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  index!: number;

  @IsString()
  waterAvailability!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  irrigatedAreaPct!: number;

  @IsString()
  source!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
