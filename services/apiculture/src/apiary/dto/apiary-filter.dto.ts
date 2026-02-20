import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { HiveType } from './create-apiary.dto';

export class ApiaryFilterDto {
  @IsOptional()
  @IsEnum(HiveType)
  hiveType?: HiveType;

  @IsOptional()
  @IsUUID()
  geoEntityId?: string;
}
