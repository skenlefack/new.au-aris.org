import type { WorkflowLevel, UserRole } from '@aris/shared-types';
import type { WfLevel } from '@prisma/client';

export type TransitionAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE';

export interface WorkflowTransitionEntity {
  id: string;
  instanceId: string;
  fromLevel: WorkflowLevel;
  toLevel: WorkflowLevel;
  fromStatus: string;
  toStatus: string;
  action: TransitionAction;
  actorUserId: string;
  actorRole: UserRole;
  comment: string | null;
  createdAt: Date;
}

export interface WorkflowInstanceEntity {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  domain: string;
  currentLevel: WorkflowLevel;
  status: string;
  dataContractId: string | null;
  qualityReportId: string | null;
  wahisReady: boolean;
  analyticsReady: boolean;
  slaDeadline: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  transitions?: WorkflowTransitionEntity[];
}

export interface DashboardMetrics {
  pendingByLevel: Record<string, number>;
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  totalEscalated: number;
  slaBreaches: number;
  wahisReadyCount: number;
  analyticsReadyCount: number;
}

// ── Workflow Definition (configuration) ──

export interface WorkflowStepEntity {
  id: string;
  definitionId: string;
  stepOrder: number;
  levelType: string;
  adminLevel: number | null;
  name: Record<string, string>;
  canEdit: boolean;
  canValidate: boolean;
  transmitDelayHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinitionEntity {
  id: string;
  tenantId: string;
  countryCode: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  startLevel: number;
  endLevel: number;
  defaultTransmitDelay: number;
  defaultValidationDelay: number;
  autoTransmitEnabled: boolean;
  autoValidateEnabled: boolean;
  requireComment: boolean;
  allowReject: boolean;
  allowReturn: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  steps?: WorkflowStepEntity[];
}

// ── Validation Chain ──

export interface ValidationChainUserInfo {
  displayName?: string;
  email: string;
}

export interface ValidationChainEntity {
  id: string;
  tenantId: string;
  userId: string;
  validatorId: string;
  backupValidatorId: string | null;
  levelType: string;
  priority: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  user?: ValidationChainUserInfo;
  validator?: ValidationChainUserInfo;
  backupValidator?: ValidationChainUserInfo;
}

/**
 * RBAC mapping: which roles can act at each workflow level.
 */
export const LEVEL_ROLES: Record<string, readonly UserRole[]> = {
  NATIONAL_TECHNICAL: ['DATA_STEWARD', 'NATIONAL_ADMIN'] as unknown as UserRole[],
  NATIONAL_OFFICIAL: ['NATIONAL_ADMIN', 'WAHIS_FOCAL_POINT'] as unknown as UserRole[],
  REC_HARMONIZATION: ['REC_ADMIN', 'DATA_STEWARD'] as unknown as UserRole[],
  CONTINENTAL_PUBLICATION: ['CONTINENTAL_ADMIN', 'SUPER_ADMIN'] as unknown as UserRole[],
};

/**
 * Ordered levels for determining next level after approval.
 */
export const LEVEL_ORDER: readonly WfLevel[] = [
  'NATIONAL_TECHNICAL',
  'NATIONAL_OFFICIAL',
  'REC_HARMONIZATION',
  'CONTINENTAL_PUBLICATION',
];
