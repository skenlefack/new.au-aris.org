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

export class UpdateAquacultureProductionDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityKg?: number;

  @IsOptional()
  @IsString()
  methodOfCulture?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feedUsedKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fcr?: number;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
