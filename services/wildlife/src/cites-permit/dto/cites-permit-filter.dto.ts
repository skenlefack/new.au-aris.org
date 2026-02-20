import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';

export class CitesPermitFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  permitType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  exportCountry?: string;

  @IsOptional()
  @IsString()
  importCountry?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
