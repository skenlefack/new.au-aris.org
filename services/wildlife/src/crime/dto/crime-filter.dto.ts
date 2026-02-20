import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';

export class CrimeFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsString()
  crimeType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  reportingAgency?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
