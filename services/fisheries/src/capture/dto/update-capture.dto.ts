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

export class UpdateCaptureDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  faoAreaCode?: string;

  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @IsOptional()
  @IsDateString()
  captureDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityKg?: number;

  @IsOptional()
  @IsString()
  gearType?: string;

  @IsOptional()
  @IsString()
  landingSite?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
