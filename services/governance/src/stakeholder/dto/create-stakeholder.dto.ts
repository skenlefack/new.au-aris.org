import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsArray,
} from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import { StakeholderType } from '../entities/stakeholder.entity';

export class CreateStakeholderDto {
  @IsString()
  name!: string;

  @IsEnum(StakeholderType)
  type!: StakeholderType;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  domains!: string[];

  @IsOptional()
  @IsEnum(DataClassification)
  dataClassification?: DataClassification;
}
