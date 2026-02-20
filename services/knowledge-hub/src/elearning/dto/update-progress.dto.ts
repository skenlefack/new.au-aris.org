import {
  IsArray,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateProgressDto {
  @IsArray()
  @IsString({ each: true })
  completedLessons!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}
