import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateAquacultureFarmDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsOptional()
  @IsString()
  farmType?: string;

  @IsOptional()
  @IsString()
  waterSource?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaHectares?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  productionCapacityTonnes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
