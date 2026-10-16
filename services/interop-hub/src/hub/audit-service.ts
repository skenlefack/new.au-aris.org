/**
 * Lightweight audit logging service for hub operations.
 * Writes to interop.hub_audit_logs table.
 */
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export class HubAuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(
    user: AuthenticatedUser,
    entityType: string,
    entityId: string,
    action: string,
    details: Record<string, unknown> = {},
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.hubAuditLog.create({
        data: {
          tenant_id: user.tenantId,
          entity_type: entityType,
          entity_id: entityId,
          action,
          actor_id: user.userId,
          actor_role: user.role ?? 'UNKNOWN',
          details,
          ip_address: ipAddress ?? null,
        },
      });
    } catch (err) {
      // Never let audit logging failure crash a request
      console.error('[HubAuditService] Failed to write audit log:', err);
    }
  }
}
