import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ColonyStrength, BeeDisease } from './create-colony-health.dto';

export class ColonyHealthFilterDto {
  @IsOptional()
  @IsUUID()
  apiaryId?: string;

  @IsOptional()
  @IsEnum(ColonyStrength)
  colonyStrength?: ColonyStrength;

  @IsOptional()
  @IsEnum(BeeDisease)
  disease?: BeeDisease;
}
