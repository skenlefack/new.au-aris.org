import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';

const GATE_NAMES = [
  'COMPLETENESS',
  'TEMPORAL_CONSISTENCY',
  'GEOGRAPHIC_CONSISTENCY',
  'CODES_VOCABULARIES',
  'UNITS',
  'DEDUPLICATION',
  'AUDITABILITY',
  'CONFIDENCE_SCORE',
] as const;

export class CreateRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  domain!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(GATE_NAMES)
  gate!: (typeof GATE_NAMES)[number];

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
