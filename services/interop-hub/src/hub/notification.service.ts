// ═══════════════════════════════════════════════════════════════════
//  Notification Service — Hub notifications + message service relay
// ═══════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  HubNotification,
  HubNotificationType,
  HubNotificationSeverity,
  HubNotificationChannel,
  CreateNotificationDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';

/** Templates per notification type */
const NOTIFICATION_TEMPLATES: Partial<Record<HubNotificationType, { title: string; severity: HubNotificationSeverity }>> = {
  INBOUND_RECEIVED: { title: 'Inbound data received', severity: 'INFO' },
  INBOUND_AWAITING_REVIEW: { title: 'Inbound data awaiting review', severity: 'WARNING' },
  INBOUND_APPROVED: { title: 'Inbound data approved', severity: 'INFO' },
  INBOUND_REJECTED: { title: 'Inbound data rejected', severity: 'WARNING' },
  INBOUND_LOADED: { title: 'Inbound data loaded successfully', severity: 'INFO' },
  INBOUND_FAILED: { title: 'Inbound processing failed', severity: 'ERROR' },
  OUTBOUND_READY: { title: 'Outbound data ready for export', severity: 'INFO' },
  OUTBOUND_AWAITING_REVIEW: { title: 'Outbound data awaiting review', severity: 'WARNING' },
  OUTBOUND_SENT: { title: 'Outbound data delivered', severity: 'INFO' },
  OUTBOUND_FAILED: { title: 'Outbound delivery failed', severity: 'ERROR' },
  CONNECTION_HEALTH_DOWN: { title: 'Connection health check failed', severity: 'CRITICAL' },
  CONNECTION_HEALTH_RESTORED: { title: 'Connection health restored', severity: 'INFO' },
  SLA_BREACH: { title: 'SLA breach detected', severity: 'CRITICAL' },
  PIPELINE_ERROR: { title: 'Pipeline error', severity: 'ERROR' },
};

const MESSAGE_SERVICE_URL = process.env['MESSAGE_SERVICE_URL'] ?? 'http://localhost:3006';

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubNotification;
  }

  private throwHttp(statusCode: number, message: string): never {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }

  // ─── Create ─────────────────────────────────────────────────────

  async createNotification(dto: CreateNotificationDto): Promise<HubNotification> {
    const template = NOTIFICATION_TEMPLATES[dto.type];
    const severity = dto.severity ?? template?.severity ?? 'INFO';

    const notification = await this.db.create({
      data: {
        tenant_id: dto.tenant_id,
        transaction_id: dto.transaction_id ?? null,
        connection_id: dto.connection_id ?? null,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        severity,
        metadata: (dto.metadata ?? {}) as any,
        channels: dto.channels,
      },
    });

    // Relay to ARIS message service (best-effort, non-blocking)
    this.relayToMessageService(notification as HubNotification).catch(err => {
      this.logger.warn(`Failed to relay notification ${notification.id} to message service: ${err.message}`);
    });

    return notification as HubNotification;
  }

  // ─── Queries ────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    params: PaginationParams & { type?: HubNotificationType; unread_only?: boolean } = {},
  ): Promise<PaginatedResult<HubNotification>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (params.type) where.type = params.type;
    if (params.unread_only) where.read_at = null;

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubNotification[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async unreadCount(tenantId: string): Promise<number> {
    return this.db.count({
      where: { tenant_id: tenantId, read_at: null },
    });
  }

  // ─── Mark as Read ───────────────────────────────────────────────

  async markAsRead(id: string, tenantId: string, readBy: string): Promise<HubNotification> {
    const existing = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!existing) {
      this.throwHttp(404, `Notification ${id} not found`);
    }

    if (existing.read_at) {
      return existing as HubNotification; // Already read
    }

    const notification = await this.db.update({
      where: { id },
      data: {
        read_at: new Date(),
        read_by: readBy,
      },
    });

    return notification as HubNotification;
  }

  async markAllAsRead(tenantId: string, readBy: string): Promise<number> {
    const result = await this.db.updateMany({
      where: { tenant_id: tenantId, read_at: null },
      data: {
        read_at: new Date(),
        read_by: readBy,
      },
    });
    return result.count;
  }

  // ─── Message Service Integration ────────────────────────────────

  /**
   * Relay a notification to the ARIS message service (port 3006).
   * Sends via in_app + email channels.
   */
  private async relayToMessageService(notification: HubNotification): Promise<void> {
    const channels = notification.channels ?? ['in_app'];

    // Only relay if channels include email or push
    const shouldRelay = channels.some(ch => ch === 'email' || ch === 'push' || ch === 'sms');
    if (!shouldRelay) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);

      await fetch(`${MESSAGE_SERVICE_URL}/api/v1/message/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: notification.tenant_id,
          type: 'interop_notification',
          title: notification.title,
          body: notification.message,
          severity: notification.severity,
          channels,
          metadata: {
            notification_id: notification.id,
            notification_type: notification.type,
            transaction_id: notification.transaction_id,
            connection_id: notification.connection_id,
            ...((notification.metadata ?? {}) as Record<string, unknown>),
          },
          // Target INTEROP_MANAGER role users for this tenant
          target: {
            roles: ['INTEROP_MANAGER', 'SUPER_ADMIN', 'CONTINENTAL_ADMIN'],
            tenant_id: notification.tenant_id,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Update sent_at
      await this.db.update({
        where: { id: notification.id },
        data: { sent_at: new Date() },
      });
    } catch (err: any) {
      // Non-blocking — message service may be unavailable
      this.logger.warn(`Message service relay failed: ${err.message}`);
    }
  }
}
