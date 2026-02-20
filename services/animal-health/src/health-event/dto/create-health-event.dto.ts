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
  ArrayMinSize,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { EventType, ConfidenceLevel, ControlMeasure } from '../entities/health-event.entity';

export class CreateHealthEventDto {
  @IsUUID()
  diseaseId!: string;

  @IsEnum(['SUSPECT', 'CONFIRMED', 'RESOLVED'] as const)
  eventType!: EventType;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  speciesIds!: string[];

  @IsOptional()
  @IsDateString()
  dateOnset?: string;

  @IsDateString()
  dateSuspicion!: string;

  @IsOptional()
  @IsDateString()
  dateConfirmation?: string;

  @IsOptional()
  @IsDateString()
  dateClosure?: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsNumber()
  @Min(0)
  holdingsAffected!: number;

  @IsNumber()
  @Min(0)
  susceptible!: number;

  @IsNumber()
  @Min(0)
  cases!: number;

  @IsNumber()
  @Min(0)
  deaths!: number;

  @IsNumber()
  @Min(0)
  killed!: number;

  @IsNumber()
  @Min(0)
  slaughtered!: number;

  @IsOptional()
  @IsArray()
  @IsEnum(['QUARANTINE', 'MOVEMENT_CONTROL', 'VACCINATION', 'STAMPING_OUT'] as const, { each: true })
  controlMeasures?: ControlMeasure[];

  @IsEnum(['RUMOR', 'VERIFIED', 'CONFIRMED'] as const)
  confidenceLevel!: ConfidenceLevel;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
