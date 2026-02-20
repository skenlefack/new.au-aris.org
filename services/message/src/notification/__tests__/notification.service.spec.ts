import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  UserRole,
  TenantLevel,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { NotificationService } from '../notification.service';

// ── Mock factories ──

function mockPrismaService() {
  return {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
}

function mockChannel(success = true) {
  return {
    send: vi.fn().mockResolvedValue({
      success,
      messageId: success ? 'msg-001' : undefined,
      error: success ? undefined : 'Channel failure',
    }),
  };
}

function callerUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'admin-001',
    email: 'admin@aris.africa',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function notificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-001',
    tenantId: 'tenant-ke',
    userId: 'user-001',
    channel: NotificationChannel.EMAIL,
    subject: 'Test Notification',
    body: 'Test body',
    status: NotificationStatus.PENDING,
    metadata: {},
    readAt: null,
    sentAt: null,
    failedAt: null,
    failReason: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;
  let emailCh: ReturnType<typeof mockChannel>;
  let smsCh: ReturnType<typeof mockChannel>;
  let pushCh: ReturnType<typeof mockChannel>;
  let inAppCh: ReturnType<typeof mockChannel>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    emailCh = mockChannel();
    smsCh = mockChannel();
    pushCh = mockChannel();
    inAppCh = mockChannel();

    service = new NotificationService(
      prisma as never,
      kafka as never,
      emailCh as never,
      smsCh as never,
      pushCh as never,
      inAppCh as never,
    );
  });

  // ── send() ──

  describe('send', () => {
    it('should route EMAIL to email channel', async () => {
      const created = notificationFixture();
      const sent = notificationFixture({ status: NotificationStatus.SENT, sentAt: new Date() });
      prisma.notification.create.mockResolvedValue(created);
      prisma.notification.update.mockResolvedValue(sent);

      const result = await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(emailCh.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user-001', subject: 'Test' }),
      );
      expect(smsCh.send).not.toHaveBeenCalled();
      expect(result.data.status).toBe(NotificationStatus.SENT);
    });

    it('should route SMS to sms channel', async () => {
      const created = notificationFixture({ channel: NotificationChannel.SMS });
      prisma.notification.create.mockResolvedValue(created);
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.SMS,
          subject: 'Test SMS',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(smsCh.send).toHaveBeenCalled();
      expect(emailCh.send).not.toHaveBeenCalled();
    });

    it('should route PUSH to push channel', async () => {
      const created = notificationFixture({ channel: NotificationChannel.PUSH });
      prisma.notification.create.mockResolvedValue(created);
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.PUSH,
          subject: 'Push Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(pushCh.send).toHaveBeenCalled();
    });

    it('should route IN_APP to in-app channel', async () => {
      const created = notificationFixture({ channel: NotificationChannel.IN_APP });
      prisma.notification.create.mockResolvedValue(created);
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.IN_APP,
          subject: 'In-App Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(inAppCh.send).toHaveBeenCalled();
    });

    it('should publish SENT event on success', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
        'actor-001',
      );

      expect(kafka.send).toHaveBeenCalledWith(
        TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
        'notif-001',
        expect.objectContaining({
          notificationId: 'notif-001',
          channel: NotificationChannel.EMAIL,
        }),
        expect.objectContaining({
          sourceService: 'message-service',
          tenantId: 'tenant-ke',
        }),
      );
    });

    it('should publish FAILED event on channel failure', async () => {
      emailCh = mockChannel(false);
      service = new NotificationService(
        prisma as never,
        kafka as never,
        emailCh as never,
        smsCh as never,
        pushCh as never,
        inAppCh as never,
      );

      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({
          status: NotificationStatus.FAILED,
          failReason: 'Channel failure',
        }),
      );

      const result = await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(result.data.status).toBe(NotificationStatus.FAILED);
      expect(kafka.send).toHaveBeenCalledWith(
        TOPIC_SYS_MESSAGE_NOTIFICATION_FAILED,
        'notif-001',
        expect.objectContaining({
          error: 'Channel failure',
        }),
        expect.any(Object),
      );
    });

    it('should set status to SENT with sentAt on success', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-001' },
        data: expect.objectContaining({
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should set status to FAILED with failedAt and failReason on failure', async () => {
      emailCh = mockChannel(false);
      service = new NotificationService(
        prisma as never,
        kafka as never,
        emailCh as never,
        smsCh as never,
        pushCh as never,
        inAppCh as never,
      );

      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.FAILED }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-001' },
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          failedAt: expect.any(Date),
          failReason: 'Channel failure',
        }),
      });
    });

    it('should not throw on Kafka publish failure', async () => {
      kafka.send.mockRejectedValue(new Error('Kafka down'));
      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      const result = await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
        },
        'tenant-ke',
      );

      expect(result.data).toBeDefined();
    });

    it('should include metadata in channel payload', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      await service.send(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Test',
          body: 'Body',
          metadata: { recordId: 'rec-001' },
        },
        'tenant-ke',
      );

      expect(emailCh.send).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { recordId: 'rec-001' } }),
      );
    });
  });

  // ── findAll() ──

  describe('findAll', () => {
    it('should return paginated notifications for the user', async () => {
      const notifs = [notificationFixture(), notificationFixture({ id: 'notif-002' })];
      prisma.notification.findMany.mockResolvedValue(notifs);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.findAll('user-001', 'tenant-ke', {});

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001', tenantId: 'tenant-ke' },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
    });

    it('should apply pagination params', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-001', 'tenant-ke', {
        page: 3,
        limit: 10,
        sort: 'createdAt',
        order: 'asc',
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('should cap limit at MAX_LIMIT', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-001', 'tenant-ke', { limit: 500 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter by channel', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-001', 'tenant-ke', {
        channel: NotificationChannel.EMAIL,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: NotificationChannel.EMAIL }),
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('user-001', 'tenant-ke', {
        status: NotificationStatus.SENT,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: NotificationStatus.SENT }),
        }),
      );
    });
  });

  // ── getUnreadCount() ──

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-001', 'tenant-ke');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-001', tenantId: 'tenant-ke', readAt: null },
      });
      expect(result.data.count).toBe(5);
    });

    it('should return zero for user with no notifications', async () => {
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount('user-002', 'tenant-ke');

      expect(result.data.count).toBe(0);
    });
  });

  // ── markAsRead() ──

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notif = notificationFixture();
      const updated = notificationFixture({ readAt: new Date() });
      prisma.notification.findUnique.mockResolvedValue(notif);
      prisma.notification.update.mockResolvedValue(updated);

      const result = await service.markAsRead('notif-001', 'user-001', 'tenant-ke');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-001' },
        data: { readAt: expect.any(Date) },
      });
      expect(result.data.readAt).toBeDefined();
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('notif-999', 'user-001', 'tenant-ke'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        notificationFixture({ userId: 'other-user' }),
      );

      await expect(
        service.markAsRead('notif-001', 'user-001', 'tenant-ke'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if notification belongs to another tenant', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        notificationFixture({ tenantId: 'other-tenant' }),
      );

      await expect(
        service.markAsRead('notif-001', 'user-001', 'tenant-ke'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return existing readAt if already read', async () => {
      const readDate = new Date('2024-06-01');
      const notif = notificationFixture({ readAt: readDate });
      prisma.notification.findUnique.mockResolvedValue(notif);

      const result = await service.markAsRead('notif-001', 'user-001', 'tenant-ke');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result.data.readAt).toBe(readDate);
    });
  });

  // ── sendManual() ──

  describe('sendManual', () => {
    it('should send notification with caller tenantId', async () => {
      prisma.notification.create.mockResolvedValue(notificationFixture());
      prisma.notification.update.mockResolvedValue(
        notificationFixture({ status: NotificationStatus.SENT }),
      );

      const caller = callerUser();
      await service.sendManual(
        {
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
          subject: 'Manual Send',
          body: 'Admin body',
        },
        caller,
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-au',
          userId: 'user-001',
        }),
      });
    });
  });

  // ── resolveChannel() ──

  describe('resolveChannel', () => {
    it('should resolve all 4 channel types', () => {
      expect(service.resolveChannel(NotificationChannel.EMAIL)).toBe(emailCh);
      expect(service.resolveChannel(NotificationChannel.SMS)).toBe(smsCh);
      expect(service.resolveChannel(NotificationChannel.PUSH)).toBe(pushCh);
      expect(service.resolveChannel(NotificationChannel.IN_APP)).toBe(inAppCh);
    });
  });
});
