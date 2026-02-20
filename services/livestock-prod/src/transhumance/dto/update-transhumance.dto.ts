import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateTranshumanceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  route?: object;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  seasonality?: string;

  @IsOptional()
  @IsBoolean()
  crossBorder?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
