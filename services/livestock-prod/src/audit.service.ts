import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  log(
    entityType: string,
    entityId: string,
    action: AuditAction,
    user: AuthenticatedUser,
    dataClassification: DataClassification,
    options?: {
      reason?: string;
      previousVersion?: object;
      newVersion?: object;
    },
  ): void {
    const entry: AuditEntry = {
      id: uuidv4(),
      entityType,
      entityId,
      action,
      actor: {
        userId: user.userId,
        role: user.role,
        tenantId: user.tenantId,
      },
      timestamp: new Date(),
      dataClassification,
      ...options,
    };

    this.logger.log(
      `AUDIT: ${action} ${entityType}/${entityId} by ${user.userId} [${user.role}] tenant=${user.tenantId}`,
    );

    // Phase 2: persist to audit table / Kafka audit topic
    void entry;
  }
}
