import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

const LanguageCode = ['EN', 'FR'] as const;

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string;

  @IsOptional()
  @IsEnum(LanguageCode)
  language?: (typeof LanguageCode)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
