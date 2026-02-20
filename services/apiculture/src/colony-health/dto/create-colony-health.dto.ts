import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';

export enum ColonyStrength {
  STRONG = 'STRONG',
  MEDIUM = 'MEDIUM',
  WEAK = 'WEAK',
  DEAD = 'DEAD',
}

export enum BeeDisease {
  VARROA = 'VARROA',
  AFB = 'AFB',
  EFB = 'EFB',
  NOSEMA = 'NOSEMA',
  NONE = 'NONE',
}

export class CreateColonyHealthDto {
  @IsUUID()
  apiaryId!: string;

  @IsDateString()
  inspectionDate!: string;

  @IsEnum(ColonyStrength)
  colonyStrength!: ColonyStrength;

  @IsArray()
  @IsEnum(BeeDisease, { each: true })
  diseases!: BeeDisease[];

  @IsArray()
  @IsString({ each: true })
  treatments!: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
