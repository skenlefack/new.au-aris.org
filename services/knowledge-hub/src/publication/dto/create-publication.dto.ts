import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

const PublicationType = ['BRIEF', 'REPORT', 'GUIDELINE', 'BULLETIN'] as const;
const LanguageCode = ['EN', 'FR'] as const;

export class CreatePublicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsArray()
  @IsString({ each: true })
  authors!: string[];

  @IsString()
  @MaxLength(100)
  domain!: string;

  @IsEnum(PublicationType)
  type!: (typeof PublicationType)[number];

  @IsOptional()
  @IsUUID()
  fileId?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(LanguageCode)
  language?: (typeof LanguageCode)[number];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
