import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class CreateBeekeeperTrainingDto {
  @IsString()
  beekeeperId!: string;

  @IsString()
  trainingType!: string;

  @IsDateString()
  completedDate!: string;

  @IsOptional()
  @IsString()
  certificationNumber?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
