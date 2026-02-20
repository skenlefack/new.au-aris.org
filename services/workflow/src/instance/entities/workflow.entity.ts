import type { WorkflowLevel, WorkflowStatus, UserRole } from '@aris/shared-types';

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
export const LEVEL_ORDER: readonly string[] = [
  'NATIONAL_TECHNICAL',
  'NATIONAL_OFFICIAL',
  'REC_HARMONIZATION',
  'CONTINENTAL_PUBLICATION',
];
