import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateCapacityDto {
  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  staffCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  pvsSelfAssessmentScore?: number;

  @IsOptional()
  @IsString()
  oieStatus?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
