import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDiseaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nameFr!: string;

  @IsOptional()
  @IsBoolean()
  isWoahListed?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedSpecies?: string[];

  @IsOptional()
  @IsBoolean()
  isNotifiable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  wahisCategory?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
