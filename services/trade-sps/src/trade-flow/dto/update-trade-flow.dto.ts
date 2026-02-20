import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { FlowDirection } from '../entities/trade-flow.entity';

export class UpdateTradeFlowDto {
  @IsOptional()
  @IsUUID()
  exportCountryId?: string;

  @IsOptional()
  @IsUUID()
  importCountryId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  commodity?: string;

  @IsOptional()
  @IsEnum(['IMPORT', 'EXPORT', 'TRANSIT'] as const)
  flowDirection?: FlowDirection;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valueFob?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  hsCode?: string;

  @IsOptional()
  @IsString()
  spsStatus?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
