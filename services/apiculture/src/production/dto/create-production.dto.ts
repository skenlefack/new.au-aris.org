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

export enum HoneyQuality {
  GRADE_A = 'GRADE_A',
  GRADE_B = 'GRADE_B',
  GRADE_C = 'GRADE_C',
}

export class CreateHoneyProductionDto {
  @IsUUID()
  apiaryId!: string;

  @IsDateString()
  harvestDate!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsEnum(HoneyQuality)
  quality!: HoneyQuality;

  @IsString()
  floralSource!: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
