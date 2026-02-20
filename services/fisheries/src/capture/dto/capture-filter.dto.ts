import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';

export class CaptureFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsString()
  faoAreaCode?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
