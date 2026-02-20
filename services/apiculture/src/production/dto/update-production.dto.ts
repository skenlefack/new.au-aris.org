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
import { HoneyQuality } from './create-production.dto';

export class UpdateHoneyProductionDto {
  @IsOptional()
  @IsUUID()
  apiaryId?: string;

  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsEnum(HoneyQuality)
  quality?: HoneyQuality;

  @IsOptional()
  @IsString()
  floralSource?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
