import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateCapacityDto {
  @IsNumber()
  @Min(1900)
  @Max(2100)
  year!: number;

  @IsString()
  organizationName!: string;

  @IsNumber()
  @Min(0)
  staffCount!: number;

  @IsNumber()
  @Min(0)
  budgetUsd!: number;

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
