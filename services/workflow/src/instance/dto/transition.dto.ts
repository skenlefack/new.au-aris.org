import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class RejectDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class ReturnDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
