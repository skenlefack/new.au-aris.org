import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import type { InspectionResult, CertificateStatus } from '../entities/sps-certificate.entity';

export class SpsCertificateFilterDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  originCountryId?: string;

  @IsOptional()
  @IsUUID()
  destinationCountryId?: string;

  @IsOptional()
  @IsEnum(['PASS', 'FAIL', 'CONDITIONAL', 'PENDING'] as const)
  inspectionResult?: InspectionResult;

  @IsOptional()
  @IsEnum(['DRAFT', 'ISSUED', 'REVOKED', 'EXPIRED'] as const)
  status?: CertificateStatus;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
