import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { SurveillanceType, DesignType } from '../entities/surveillance.entity';

export class CreateSurveillanceDto {
  @IsEnum(['PASSIVE', 'ACTIVE', 'SENTINEL', 'EVENT_BASED'] as const)
  type!: SurveillanceType;

  @IsUUID()
  diseaseId!: string;

  @IsOptional()
  @IsEnum(['CLUSTER', 'RISK_BASED', 'RANDOM'] as const)
  designType?: DesignType;

  @IsNumber()
  @Min(0)
  sampleSize!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positivityRate?: number;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsUUID()
  mapLayerId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
