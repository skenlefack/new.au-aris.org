import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import type { GeoLevel } from '../entities/geo-entity.entity';

export class CreateGeoEntityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameFr!: string;

  @IsEnum(['COUNTRY', 'ADMIN1', 'ADMIN2', 'ADMIN3', 'SPECIAL_ZONE'] as const)
  level!: GeoLevel;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{2,3}$/, { message: 'countryCode must be ISO 3166 alpha-2 or alpha-3' })
  countryCode!: string;

  @IsOptional()
  @IsNumber()
  centroidLat?: number;

  @IsOptional()
  @IsNumber()
  centroidLng?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
