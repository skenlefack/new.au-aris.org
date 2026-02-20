import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class VaccinationFilterDto {
  @IsOptional()
  @IsUUID()
  diseaseId?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
