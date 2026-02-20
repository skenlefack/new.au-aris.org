import { IsOptional, IsUUID, IsString, IsNumber } from 'class-validator';

export class WaterStressFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsNumber()
  minIndex?: number;

  @IsOptional()
  @IsNumber()
  maxIndex?: number;
}
