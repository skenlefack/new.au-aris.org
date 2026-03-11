import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { DataClassification } from '@aris/shared-types';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actor: { userId: string; role: string; tenantId: string };
  timestamp: Date;
  reason?: string;
  previousVersion?: object;
  newVersion?: object;
  dataClassification: DataClassification;
}

export class AuditService {
  log(
    entityType: string,
    entityId: string,
    action: AuditAction,
    user: AuthenticatedUser,
    dataClassification: DataClassification,
    options?: { reason?: string; previousVersion?: object; newVersion?: object },
  ): void {
    const entry: AuditEntry = {
      id: randomUUID(),
      entityType,
      entityId,
      action,
      actor: { userId: user.userId, role: user.role, tenantId: user.tenantId },
      timestamp: new Date(),
      dataClassification,
      ...options,
    };
    // Phase 2: persist to audit table / Kafka audit topic
    void entry;
  }
}
