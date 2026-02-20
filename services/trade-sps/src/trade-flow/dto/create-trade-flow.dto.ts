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

export class CreateTradeFlowDto {
  @IsUUID()
  exportCountryId!: string;

  @IsUUID()
  importCountryId!: string;

  @IsUUID()
  speciesId!: string;

  @IsString()
  commodity!: string;

  @IsEnum(['IMPORT', 'EXPORT', 'TRANSIT'] as const)
  flowDirection!: FlowDirection;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valueFob?: number;

  @IsString()
  currency!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

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
