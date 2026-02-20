import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class VesselFilterDto {
  @IsOptional()
  @IsString()
  flagState?: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsString()
  homePort?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
