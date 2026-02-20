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

export class CreateAquacultureProductionDto {
  @IsUUID()
  farmId!: string;

  @IsUUID()
  speciesId!: string;

  @IsDateString()
  harvestDate!: string;

  @IsNumber()
  @Min(0)
  quantityKg!: number;

  @IsString()
  methodOfCulture!: string;

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
