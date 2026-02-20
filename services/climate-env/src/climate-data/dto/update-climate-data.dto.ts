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

export class UpdateClimateDataDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

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

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
