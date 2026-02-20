import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';

export class AquacultureProductionFilterDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  methodOfCulture?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
