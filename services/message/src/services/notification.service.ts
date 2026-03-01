import { randomUUID } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  NotificationChannel,
  NotificationStatus,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { MessageChannel, ChannelResult } from './channel.interface';
import type { NotificationEntity } from '../notification/entities/notification.entity';

const SERVICE_NAME = 'message-service';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly channels: {
      email: MessageChannel;
      sms: MessageChannel;
      push: MessageChannel;
      inApp: MessageChannel;
    },
  ) {}

  async send(
    dto: { userId: string; channel: string; subject: string; body: string; metadata?: Record<string, unknown> },
    tenantId: string,
    actorId?: string,
  ): Promise<ApiResponse<NotificationEntity>> {
    const notification = await (this.prisma as any).notification.create({
      data: {
        tenantId,
        userId: dto.userId,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const channel = this.resolveChannel(dto.channel as NotificationChannel);
    const result = await channel.send({
      to: dto.userId,
      subject: dto.subject,
      body: dto.body,
      metadata: dto.metadata,
    });

    const updated = await this.updateStatus(notification.id, result);

    const topic = result.success
      ? TOPIC_SYS_MESSAGE_NOTIFICATION_SENT
      : TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED;

    await this.publishEvent(topic, notification.id, {
      notificationId: notification.id,
      userId: dto.userId,
      channel: dto.channel,
      subject: dto.subject,
      status: updated.status,
      ...(result.error ? { error: result.error } : {}),
    }, tenantId, actorId);

    return { data: updated as NotificationEntity };
  }

  async findAll(
    userId: string,
    tenantId: string,
    query: { page?: number; limit?: number; sort?: string; order?: string; channel?: string; status?: string },
  ): Promise<PaginatedResponse<NotificationEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where: Record<string, unknown> = { userId, tenantId };
    if (query.channel) where['channel'] = query.channel;
    if (query.status) where['status'] = query.status;

    const [data, total] = await Promise.all([
      (this.prisma as any).notification.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).notification.count({ where }),
    ]);

    return { data: data as NotificationEntity[], meta: { total, page, limit } };
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<ApiResponse<{ count: number }>> {
    const count = await (this.prisma as any).notification.count({
      where: { userId, tenantId, readAt: null },
    });
    return { data: { count } };
  }

  async markAsRead(id: string, userId: string, tenantId: string): Promise<ApiResponse<NotificationEntity>> {
    const notification = await (this.prisma as any).notification.findUnique({ where: { id } });

    if (!notification) throw new HttpError(404, `Notification ${id} not found`);
    if (notification.userId !== userId || notification.tenantId !== tenantId) {
      throw new HttpError(403, 'Cannot access this notification');
    }
    if (notification.readAt) return { data: notification as NotificationEntity };

    const updated = await (this.prisma as any).notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { data: updated as NotificationEntity };
  }

  async sendManual(
    dto: { userId: string; channel: string; subject: string; body: string; metadata?: Record<string, unknown> },
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationEntity>> {
    return this.send(dto, caller.tenantId, caller.userId);
  }

  resolveChannel(channel: NotificationChannel): MessageChannel {
    switch (channel) {
      case NotificationChannel.EMAIL: return this.channels.email;
      case NotificationChannel.SMS: return this.channels.sms;
      case NotificationChannel.PUSH: return this.channels.push;
      case NotificationChannel.IN_APP: return this.channels.inApp;
      default: throw new Error(`Unknown notification channel: ${String(channel)}`);
    }
  }

  private async updateStatus(id: string, result: ChannelResult): Promise<NotificationEntity> {
    if (result.success) {
      return (this.prisma as any).notification.update({
        where: { id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    }
    return (this.prisma as any).notification.update({
      where: { id },
      data: { status: NotificationStatus.FAILED, failedAt: new Date(), failReason: result.error ?? 'Unknown error' },
    });
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId?: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId: userId ?? 'system',
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch { /* best-effort */ }
  }
}
