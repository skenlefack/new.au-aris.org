import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export class UpdateBeekeeperTrainingDto {
  @IsOptional()
  @IsString()
  beekeeperId?: string;

  @IsOptional()
  @IsString()
  trainingType?: string;

  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  certificationNumber?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
