import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  IsObject,
  IsArray,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { PVSEvaluationType } from '../entities/pvs-evaluation.entity';

export class UpdatePVSEvaluationDto {
  @IsOptional()
  @IsEnum(PVSEvaluationType)
  evaluationType?: PVSEvaluationType;

  @IsOptional()
  @IsDateString()
  evaluationDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  overallScore?: number;

  @IsOptional()
  @IsObject()
  criticalCompetencies?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendations?: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
