import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE' | 'REJECT' | 'EXPORT';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    user: AuthenticatedUser;
    reason?: string;
    previousVersion?: object;
    newVersion?: object;
    dataClassification?: string;
  }): Promise<void> {
    try {
      await this.prisma.masterDataAudit.create({
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
      this.logger.error(
        `Failed to log audit: ${params.entityType}/${params.entityId}/${params.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.masterDataAudit.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
