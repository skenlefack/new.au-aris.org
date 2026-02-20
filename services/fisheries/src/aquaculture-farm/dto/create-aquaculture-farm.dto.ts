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

export class CreateAquacultureFarmDto {
  @IsString()
  name!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number };

  @IsString()
  farmType!: string;

  @IsString()
  waterSource!: string;

  @IsNumber()
  @Min(0)
  areaHectares!: number;

  @IsArray()
  @IsUUID(undefined, { each: true })
  speciesIds!: string[];

  @IsNumber()
  @Min(0)
  productionCapacityTonnes!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
