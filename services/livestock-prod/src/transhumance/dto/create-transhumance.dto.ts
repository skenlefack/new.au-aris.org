import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateTranshumanceDto {
  @IsString()
  name!: string;

  @IsObject()
  route!: object;

  @IsUUID()
  speciesId!: string;

  @IsString()
  seasonality!: string;

  @IsOptional()
  @IsBoolean()
  crossBorder?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
