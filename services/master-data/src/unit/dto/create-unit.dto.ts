import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UnitCategory } from '../entities/unit.entity';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameFr!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol!: string;

  @IsEnum(['COUNT', 'WEIGHT', 'VOLUME', 'AREA', 'LENGTH', 'DOSE', 'CURRENCY', 'PROPORTION', 'TIME'] as const)
  category!: UnitCategory;

  @IsOptional()
  @IsNumber()
  siConversion?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
