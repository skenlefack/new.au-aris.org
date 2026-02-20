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

export class UpdateRangelandDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsDateString()
  assessmentDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(1)
  ndviIndex?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  biomassTonsPerHa?: number;

  @IsOptional()
  @IsEnum(['NONE', 'LIGHT', 'MODERATE', 'SEVERE'] as const)
  degradationLevel?: DegradationLevel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carryingCapacity?: number;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
