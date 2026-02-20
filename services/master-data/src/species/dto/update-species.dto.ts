import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSpeciesDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  scientificName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  commonNameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  commonNameFr?: string;

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

  @IsOptional()
  @IsString()
  reason?: string;
}
