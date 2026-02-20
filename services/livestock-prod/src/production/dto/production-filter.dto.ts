import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { ProductType } from '../entities/production.entity';

export class ProductionFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsEnum(['MEAT', 'MILK', 'EGGS', 'WOOL', 'HIDE'] as const)
  productType?: ProductType;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
