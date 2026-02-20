import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SpeciesCategory } from '../entities/species.entity';

export class CreateSpeciesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  scientificName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  commonNameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  commonNameFr!: string;

  @IsEnum(['DOMESTIC', 'WILDLIFE', 'AQUATIC', 'APICULTURE'] as const)
  category!: SpeciesCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productionCategories?: string[];

  @IsOptional()
  @IsBoolean()
  isWoahListed?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
