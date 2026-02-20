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

export class CreateCaptureDto {
  @IsUUID()
  geoEntityId!: string;

  @IsUUID()
  speciesId!: string;

  @IsString()
  faoAreaCode!: string;

  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @IsDateString()
  captureDate!: string;

  @IsNumber()
  @Min(0)
  quantityKg!: number;

  @IsString()
  gearType!: string;

  @IsString()
  landingSite!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
