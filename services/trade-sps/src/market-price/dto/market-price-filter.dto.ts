import { IsOptional, IsUUID, IsEnum, IsDateString, IsString } from 'class-validator';
import type { PriceType } from '../entities/market-price.entity';

export class MarketPriceFilterDto {
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  commodity?: string;

  @IsOptional()
  @IsEnum(['WHOLESALE', 'RETAIL', 'FARM_GATE', 'EXPORT'] as const)
  priceType?: PriceType;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
