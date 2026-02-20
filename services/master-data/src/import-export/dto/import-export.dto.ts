import { IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';

export enum ReferentialType {
  COUNTRIES = 'countries',
  GEO_ENTITIES = 'geo_entities',
  SPECIES = 'species',
  DISEASES = 'diseases',
  UNITS = 'units',
  IDENTIFIERS = 'identifiers',
  DENOMINATORS = 'denominators',
}

export class CsvImportDto {
  @IsEnum(ReferentialType)
  type!: ReferentialType;

  @IsString()
  csvContent!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class FaostatImportDto {
  @IsString()
  csvContent!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export interface ImportReportRow {
  row: number;
  code: string;
  action: 'created' | 'updated' | 'skipped';
  error?: string;
}

export interface ImportReport {
  type: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  details: ImportReportRow[];
}
