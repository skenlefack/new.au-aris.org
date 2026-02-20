import { IsOptional, IsString } from 'class-validator';

export class TrainingFilterDto {
  @IsOptional()
  @IsString()
  beekeeperId?: string;

  @IsOptional()
  @IsString()
  trainingType?: string;
}
