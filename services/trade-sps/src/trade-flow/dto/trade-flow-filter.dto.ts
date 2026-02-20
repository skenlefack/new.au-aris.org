import { IsOptional, IsUUID, IsEnum, IsDateString, IsString } from 'class-validator';
import type { FlowDirection } from '../entities/trade-flow.entity';

export class TradeFlowFilterDto {
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
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
