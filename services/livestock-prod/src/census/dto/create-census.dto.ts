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

export class CreateCensusDto {
  @IsUUID()
  geoEntityId!: string;

  @IsUUID()
  speciesId!: string;

  @IsNumber()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(0)
  population!: number;

  @IsString()
  methodology!: string;

  @IsString()
  source!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
