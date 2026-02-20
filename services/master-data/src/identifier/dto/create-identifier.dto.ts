import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { IdentifierType } from '../entities/identifier.entity';

export class CreateIdentifierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameFr!: string;

  @IsEnum(['LAB', 'MARKET', 'BORDER_POINT', 'PROTECTED_AREA', 'SLAUGHTERHOUSE', 'QUARANTINE_STATION'] as const)
  type!: IdentifierType;

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
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
