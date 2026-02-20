import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { LabTestResult } from '../entities/lab-result.entity';

export class CreateLabResultDto {
  @IsString()
  @MaxLength(100)
  sampleId!: string;

  @IsString()
  @MaxLength(100)
  sampleType!: string;

  @IsDateString()
  dateCollected!: string;

  @IsDateString()
  dateReceived!: string;

  @IsString()
  @MaxLength(100)
  testType!: string;

  @IsEnum(['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'] as const)
  result!: LabTestResult;

  @IsUUID()
  labId!: string;

  @IsNumber()
  @Min(0)
  turnaroundDays!: number;

  @IsBoolean()
  eqaFlag!: boolean;

  @IsOptional()
  @IsUUID()
  healthEventId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
