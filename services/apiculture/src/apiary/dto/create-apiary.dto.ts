import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export enum HiveType {
  LANGSTROTH = 'LANGSTROTH',
  TOP_BAR = 'TOP_BAR',
  KENYAN_TOP_BAR = 'KENYAN_TOP_BAR',
  TRADITIONAL = 'TRADITIONAL',
}

export class CreateApiaryDto {
  @IsString()
  name!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsNumber()
  @Min(0)
  hiveCount!: number;

  @IsEnum(HiveType)
  hiveType!: HiveType;

  @IsString()
  ownerName!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
