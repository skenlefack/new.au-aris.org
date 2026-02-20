import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { DegradationLevel } from '../entities/rangeland.entity';

export class CreateRangelandDto {
  @IsUUID()
  geoEntityId!: string;

  @IsDateString()
  assessmentDate!: string;

  @IsNumber()
  @Min(-1)
  @Max(1)
  ndviIndex!: number;

  @IsNumber()
  @Min(0)
  biomassTonsPerHa!: number;

  @IsEnum(['NONE', 'LIGHT', 'MODERATE', 'SEVERE'] as const)
  degradationLevel!: DegradationLevel;

  @IsNumber()
  @Min(0)
  carryingCapacity!: number;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
