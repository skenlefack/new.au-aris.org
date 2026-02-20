import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsUUID,
  IsDateString,
  IsEnum,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateELearningModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string;

  @IsOptional()
  @IsArray()
  lessons?: object[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDuration?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  prerequisiteIds?: string[];

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
