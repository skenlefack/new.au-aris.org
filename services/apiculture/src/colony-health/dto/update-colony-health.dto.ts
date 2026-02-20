import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { ColonyStrength, BeeDisease } from './create-colony-health.dto';

export class UpdateColonyHealthDto {
  @IsOptional()
  @IsUUID()
  apiaryId?: string;

  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsEnum(ColonyStrength)
  colonyStrength?: ColonyStrength;

  @IsOptional()
  @IsArray()
  @IsEnum(BeeDisease, { each: true })
  diseases?: BeeDisease[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  treatments?: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
