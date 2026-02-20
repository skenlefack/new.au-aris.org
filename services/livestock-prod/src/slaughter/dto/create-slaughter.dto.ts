import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateSlaughterDto {
  @IsUUID()
  speciesId!: string;

  @IsUUID()
  facilityId!: string;

  @IsNumber()
  @Min(0)
  count!: number;

  @IsNumber()
  @Min(0)
  condemnations!: number;

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
