import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateClimateDataDto {
  @IsUUID()
  geoEntityId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rainfall?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  humidity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  windSpeed?: number;

  @IsString()
  source!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
