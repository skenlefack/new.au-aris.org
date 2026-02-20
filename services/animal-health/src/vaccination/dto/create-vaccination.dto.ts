import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { IsEnum } from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateVaccinationDto {
  @IsUUID()
  diseaseId!: string;

  @IsUUID()
  speciesId!: string;

  @IsString()
  @MaxLength(200)
  vaccineType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vaccineBatch?: string;

  @IsNumber()
  @Min(0)
  dosesDelivered!: number;

  @IsNumber()
  @Min(0)
  dosesUsed!: number;

  @IsNumber()
  @Min(0)
  targetPopulation!: number;

  @IsBoolean()
  pveSerologyDone!: boolean;

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
