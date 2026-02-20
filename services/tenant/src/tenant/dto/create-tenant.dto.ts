import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { TenantLevel } from '@aris/shared-types';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsEnum(TenantLevel)
  level!: TenantLevel;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be ISO 3166-1 alpha-2 (e.g. KE, NG)' })
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recCode?: string;

  @IsString()
  @MaxLength(100)
  domain!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
