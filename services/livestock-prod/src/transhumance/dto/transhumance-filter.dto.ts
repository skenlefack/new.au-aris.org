import { IsOptional, IsUUID, IsBoolean, IsString } from 'class-validator';

export class TranshumanceFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsBoolean()
  crossBorder?: boolean;

  @IsOptional()
  @IsString()
  seasonality?: string;
}
