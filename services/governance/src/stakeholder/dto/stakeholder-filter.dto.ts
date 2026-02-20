import { IsOptional, IsEnum, IsString } from 'class-validator';
import { StakeholderType } from '../entities/stakeholder.entity';

export class StakeholderFilterDto {
  @IsOptional()
  @IsEnum(StakeholderType)
  type?: StakeholderType;

  @IsOptional()
  @IsString()
  domain?: string;
}
