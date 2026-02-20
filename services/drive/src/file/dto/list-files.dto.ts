import { IsOptional, IsString, IsIn, IsEnum } from 'class-validator';
import { DataClassification } from '@aris/shared-types';
import type { PaginationQuery } from '@aris/shared-types';

export class ListFilesDto implements PaginationQuery {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsIn(['createdAt', 'originalFilename', 'size'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsEnum(DataClassification)
  classification?: DataClassification;
}
