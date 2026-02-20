import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { HiveType } from './create-apiary.dto';

export class UpdateApiaryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hiveCount?: number;

  @IsOptional()
  @IsEnum(HiveType)
  hiveType?: HiveType;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
