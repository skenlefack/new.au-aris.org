/**
 * ARIS 4.0 — Data Sharing Module DTOs
 * Shared between services/data-sharing (backend) and apps/web (frontend)
 */

export const SHARE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

export const SHARE_ACCESS_ACTIONS = [
  'CONSULT',
  'EXPORT',
  'MODIFY',
  'DOWNLOAD',
] as const;
export type ShareAccessAction = (typeof SHARE_ACCESS_ACTIONS)[number];

/** Flexible scope describing what data the agreement covers. */
export interface DataShareScope {
  /** Which entities/tables to expose (e.g. ['outbreaks', 'lab_results']) */
  entities: string[];
  /** Optional field allow-list per entity. Empty/undefined means all fields. */
  fields?: Record<string, string[]>;
  /** Free-form filter expression evaluated by the source domain service. */
  filters?: Record<string, unknown>;
  /** Geographic restriction (admin codes, bbox, etc.) */
  geoFilter?: {
    countries?: string[];
    admin1?: string[];
    bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  };
  /** Temporal restriction (independent of agreement validity window) */
  timeRange?: {
    from?: string; // ISO date
    to?: string;   // ISO date
  };
}

export interface DataShareAgreementDto {
  id: string;
  reference: string;
  title: string;
  description?: string | null;

  ownerTenantId: string;
  ownerUserId: string;
  recipientTenantId: string;
  recipientUserId?: string | null;

  dataDomain: string;
  dataScope: DataShareScope;
  dataClassification: string;

  purpose: string;
  legalBasis?: string | null;

  validFrom: string;
  validUntil?: string | null;

  // Permissions
  canConsult: boolean;
  canExport: boolean;
  canModify: boolean;
  canRedistribute: boolean;

  // Limits
  maxRecordsPerQuery?: number | null;
  maxExportsPerMonth?: number | null;
  requireMfa: boolean;
  allowedIpRanges: string[];

  // Workflow
  status: ShareStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  expiredAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateDataShareAgreementDto {
  title: string;
  description?: string;
  /** Source tenant. Only continental users may set this; defaults to caller's tenantId. */
  ownerTenantId?: string;
  recipientTenantId: string;
  dataDomain: string;
  dataScope: DataShareScope;
  dataClassification?: string;
  purpose: string;
  legalBasis?: string;
  validFrom: string;
  validUntil?: string;
  canConsult?: boolean;
  canExport?: boolean;
  canModify?: boolean;
  canRedistribute?: boolean;
  maxRecordsPerQuery?: number;
  maxExportsPerMonth?: number;
  requireMfa?: boolean;
  allowedIpRanges?: string[];
}

export type UpdateDataShareAgreementDto = Partial<
  Omit<CreateDataShareAgreementDto, 'recipientTenantId' | 'dataDomain'>
>;

export interface RejectAgreementDto {
  rejectionReason: string;
}

export interface RevokeAgreementDto {
  revocationReason: string;
}

export interface DataShareAccessLogDto {
  id: string;
  agreementId: string;
  userId: string;
  tenantId: string;
  action: ShareAccessAction;
  recordCount?: number | null;
  queryFilters?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt: string;
}

export interface DataShareDashboardStats {
  totalAgreements: number;
  byStatus: Record<ShareStatus, number>;
  byDomain: Record<string, number>;
  activeAgreements: number;
  expiringWithin30Days: number;
  totalAccessesLast30Days: number;
  totalExportsLast30Days: number;
  topOwners: Array<{ tenantId: string; count: number }>;
  topRecipients: Array<{ tenantId: string; count: number }>;
}
