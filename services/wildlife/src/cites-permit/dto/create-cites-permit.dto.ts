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

export class CreateCitesPermitDto {
  @IsString()
  permitNumber!: string;

  @IsString()
  permitType!: string;

  @IsUUID()
  speciesId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsString()
  purpose!: string;

  @IsString()
  applicant!: string;

  @IsString()
  exportCountry!: string;

  @IsString()
  importCountry!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  expiryDate!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
