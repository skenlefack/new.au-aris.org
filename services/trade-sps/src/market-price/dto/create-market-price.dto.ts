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
import type { PriceType } from '../entities/market-price.entity';

export class CreateMarketPriceDto {
  @IsUUID()
  marketId!: string;

  @IsUUID()
  speciesId!: string;

  @IsString()
  commodity!: string;

  @IsEnum(['WHOLESALE', 'RETAIL', 'FARM_GATE', 'EXPORT'] as const)
  priceType!: PriceType;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  currency!: string;

  @IsString()
  unit!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
