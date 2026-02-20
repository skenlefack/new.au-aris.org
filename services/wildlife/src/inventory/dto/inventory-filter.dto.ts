import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';

export class InventoryFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsUUID()
  protectedAreaId?: string;

  @IsOptional()
  @IsString()
  conservationStatus?: string;

  @IsOptional()
  @IsString()
  threatLevel?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
