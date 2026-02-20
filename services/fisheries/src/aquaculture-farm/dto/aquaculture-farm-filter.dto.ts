import { IsOptional, IsUUID, IsString, IsBoolean } from 'class-validator';

export class AquacultureFarmFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsString()
  farmType?: string;

  @IsOptional()
  @IsString()
  waterSource?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
