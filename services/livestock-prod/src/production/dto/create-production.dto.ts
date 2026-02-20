import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { ProductType } from '../entities/production.entity';

export class CreateProductionDto {
  @IsUUID()
  speciesId!: string;

  @IsEnum(['MEAT', 'MILK', 'EGGS', 'WOOL', 'HIDE'] as const)
  productType!: ProductType;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsUUID()
  geoEntityId!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
