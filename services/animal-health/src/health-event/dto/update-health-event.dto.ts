import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { EventType, ConfidenceLevel, ControlMeasure } from '../entities/health-event.entity';

export class UpdateHealthEventDto {
  @IsOptional()
  @IsEnum(['SUSPECT', 'CONFIRMED', 'RESOLVED'] as const)
  eventType?: EventType;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsDateString()
  dateOnset?: string;

  @IsOptional()
  @IsDateString()
  dateConfirmation?: string;

  @IsOptional()
  @IsDateString()
  dateClosure?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  holdingsAffected?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  susceptible?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cases?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deaths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  killed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slaughtered?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(['QUARANTINE', 'MOVEMENT_CONTROL', 'VACCINATION', 'STAMPING_OUT'] as const, { each: true })
  controlMeasures?: ControlMeasure[];

  @IsOptional()
  @IsEnum(['RUMOR', 'VERIFIED', 'CONFIRMED'] as const)
  confidenceLevel?: ConfidenceLevel;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
