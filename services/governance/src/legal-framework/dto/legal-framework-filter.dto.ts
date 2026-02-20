import { IsOptional, IsEnum, IsString } from 'class-validator';
import { FrameworkType, FrameworkStatus } from '../entities/legal-framework.entity';

export class LegalFrameworkFilterDto {
  @IsOptional()
  @IsEnum(FrameworkType)
  type?: FrameworkType;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsEnum(FrameworkStatus)
  status?: FrameworkStatus;
}
