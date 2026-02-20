import {
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateCapacityDto {
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(0)
  epiStaff!: number;

  @IsNumber()
  @Min(0)
  labStaff!: number;

  @IsArray()
  @IsString({ each: true })
  labTestsAvailable!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  vaccineProductionCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  pvsScore?: number;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
