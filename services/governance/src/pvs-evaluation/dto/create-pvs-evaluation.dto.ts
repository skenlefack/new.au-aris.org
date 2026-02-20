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

export class CreatePVSEvaluationDto {
  @IsEnum(PVSEvaluationType)
  evaluationType!: PVSEvaluationType;

  @IsDateString()
  evaluationDate!: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  overallScore!: number;

  @IsObject()
  criticalCompetencies!: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  recommendations!: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
