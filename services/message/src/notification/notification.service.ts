import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
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
import { PrismaService } from '../prisma.service';
import type {
  MessageChannel,
  ChannelResult,
} from '../channels/channel.interface';
import {
  EMAIL_CHANNEL,
  SMS_CHANNEL,
  PUSH_CHANNEL,
  IN_APP_CHANNEL,
} from '../channels/channel.interface';
import type { SendNotificationDto } from './dto/send-notification.dto';
import type { ListNotificationsDto } from './dto/list-notifications.dto';
import type { NotificationEntity } from './entities/notification.entity';

const SERVICE_NAME = 'message-service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: MessageChannel,
    @Inject(SMS_CHANNEL) private readonly smsChannel: MessageChannel,
    @Inject(PUSH_CHANNEL) private readonly pushChannel: MessageChannel,
    @Inject(IN_APP_CHANNEL) private readonly inAppChannel: MessageChannel,
  ) {}

  async send(
    dto: SendNotificationDto,
    tenantId: string,
    actorId?: string,
  ): Promise<ApiResponse<NotificationEntity>> {
    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId: dto.userId,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Route to channel
    const channel = this.resolveChannel(dto.channel);
    const result = await channel.send({
      to: dto.userId,
      subject: dto.subject,
      body: dto.body,
      metadata: dto.metadata,
    });

    // Update status based on result
    const updated = await this.updateStatus(notification.id, result);

    // Publish Kafka event
    const topic = result.success
      ? TOPIC_SYS_MESSAGE_NOTIFICATION_SENT
      : TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED;

    await this.publishEvent(
      topic,
      notification.id,
      {
        notificationId: notification.id,
        userId: dto.userId,
        channel: dto.channel,
        subject: dto.subject,
        status: updated.status,
        ...(result.error ? { error: result.error } : {}),
      },
      tenantId,
      actorId,
    );

    return { data: updated as NotificationEntity };
  }

  async findAll(
    userId: string,
    tenantId: string,
    query: ListNotificationsDto,
  ): Promise<PaginatedResponse<NotificationEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = {
      [query.sort ?? 'createdAt']: query.order ?? 'desc',
    };

    const where: Record<string, unknown> = {
      userId,
      tenantId,
    };

    if (query.channel) {
      where['channel'] = query.channel;
    }
    if (query.status) {
      where['status'] = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: data as NotificationEntity[],
      meta: { total, page, limit },
    };
  }

  async getUnreadCount(
    userId: string,
    tenantId: string,
  ): Promise<ApiResponse<{ count: number }>> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        tenantId,
        readAt: null,
      },
    });

    return { data: { count } };
  }

  async markAsRead(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<ApiResponse<NotificationEntity>> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (notification.userId !== userId || notification.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot access this notification');
    }

    if (notification.readAt) {
      return { data: notification as NotificationEntity };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return { data: updated as NotificationEntity };
  }

  async sendManual(
    dto: SendNotificationDto,
    caller: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationEntity>> {
    return this.send(dto, caller.tenantId, caller.userId);
  }

  // ── Internal helpers ──

  resolveChannel(channel: NotificationChannel): MessageChannel {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.emailChannel;
      case NotificationChannel.SMS:
        return this.smsChannel;
      case NotificationChannel.PUSH:
        return this.pushChannel;
      case NotificationChannel.IN_APP:
        return this.inAppChannel;
      default:
        throw new Error(`Unknown notification channel: ${String(channel)}`);
    }
  }

  private async updateStatus(
    id: string,
    result: ChannelResult,
  ): Promise<NotificationEntity> {
    if (result.success) {
      const updated = await this.prisma.notification.update({
        where: { id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
      return updated as NotificationEntity;
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        failReason: result.error ?? 'Unknown error',
      },
    });
    return updated as NotificationEntity;
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId: userId ?? 'system',
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafkaProducer.send(topic, entityId, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
