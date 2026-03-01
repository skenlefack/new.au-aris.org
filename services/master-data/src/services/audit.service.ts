import type { PrismaClient } from '@prisma/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';

interface AuditUser {
  userId: string;
  role: string;
  tenantId: string;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    user: AuditUser;
    reason?: string;
    previousVersion?: object;
    newVersion?: object;
    dataClassification?: string;
  }): Promise<void> {
    try {
      await (this.prisma as any).masterDataAudit.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          actorUserId: params.user.userId,
          actorRole: params.user.role,
          actorTenantId: params.user.tenantId,
          reason: params.reason ?? null,
          previousVersion: params.previousVersion ?? undefined,
          newVersion: params.newVersion ?? undefined,
          dataClassification: params.dataClassification ?? 'RESTRICTED',
        },
      });
    } catch (error) {
      // Audit logging should not break the main operation
      console.error(
        `Failed to log audit: ${params.entityType}/${params.entityId}/${params.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findByEntity(entityType: string, entityId: string) {
    return (this.prisma as any).masterDataAudit.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
