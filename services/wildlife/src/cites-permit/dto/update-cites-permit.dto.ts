import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateCitesPermitDto {
  @IsOptional()
  @IsString()
  permitNumber?: string;

  @IsOptional()
  @IsString()
  permitType?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  applicant?: string;

  @IsOptional()
  @IsString()
  exportCountry?: string;

  @IsOptional()
  @IsString()
  importCountry?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
