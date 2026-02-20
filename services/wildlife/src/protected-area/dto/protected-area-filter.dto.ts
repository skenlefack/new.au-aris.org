import { IsOptional, IsUUID, IsString, IsBoolean } from 'class-validator';

export class ProtectedAreaFilterDto {
  @IsOptional()
  @IsUUID()
  geoEntityId?: string;

  @IsOptional()
  @IsString()
  iucnCategory?: string;

  @IsOptional()
  @IsString()
  managingAuthority?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
