import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeConsumer } from './realtime.consumer';
import type { RealtimeGateway } from '../gateway/realtime.gateway';
import type { RoomManagerService } from '../gateway/room-manager.service';

// Capture all subscriptions so we can invoke handlers in tests
type SubscribeCall = {
  options: { topic: string; groupId: string };
  handler: (
    payload: unknown,
    headers: Record<string, string | undefined>,
  ) => Promise<void>;
};

describe('RealtimeConsumer', () => {
  let consumer: RealtimeConsumer;
  let gateway: {
    broadcastToRoom: ReturnType<typeof vi.fn>;
    broadcastToAll: ReturnType<typeof vi.fn>;
  };
  let roomManager: Partial<RoomManagerService>;
  let subscriptions: SubscribeCall[];

  beforeEach(async () => {
    subscriptions = [];

    const kafkaConsumer = {
      subscribe: vi.fn(async (options: { topic: string; groupId: string }, handler: SubscribeCall['handler']) => {
        subscriptions.push({ options, handler });
        return {} as never; // Mock Consumer return
      }),
    };

    gateway = {
      broadcastToRoom: vi.fn(),
      broadcastToAll: vi.fn(),
    };

    roomManager = {};

    consumer = new RealtimeConsumer(
      kafkaConsumer as never,
      gateway as unknown as RealtimeGateway,
      roomManager as RoomManagerService,
    );

    await consumer.onModuleInit();
  });

  function findHandler(topicSubstring: string): SubscribeCall | undefined {
    return subscriptions.find((s) =>
      s.options.topic.includes(topicSubstring),
    );
  }

  it('should subscribe to all 7 Kafka topics on init', () => {
    expect(subscriptions).toHaveLength(7);

    const topics = subscriptions.map((s) => s.options.topic);
    expect(topics).toContain('ms.health.event.created.v1');
    expect(topics).toContain('ms.health.event.confirmed.v1');
    expect(topics).toContain('rec.health.outbreak.alert.v1');
    expect(topics).toContain('au.workflow.validation.approved.v1');
    expect(topics).toContain('au.workflow.validation.rejected.v1');
    expect(topics).toContain('sys.message.notification.sent.v1');
    expect(topics).toContain('ms.collecte.form.synced.v1');
  });

  it('should use unique group IDs per subscription', () => {
    const groupIds = subscriptions.map((s) => s.options.groupId);
    const unique = new Set(groupIds);
    expect(unique.size).toBe(groupIds.length);
  });

  // ── Event Routing Tests ──

  describe('ms.health.event.created.v1 → outbreak:new', () => {
    it('should broadcast outbreak:new to outbreaks:{tenantId}', async () => {
      const sub = findHandler('health.event.created')!;
      await sub.handler(
        { eventId: 'evt-1', disease: 'FMD' },
        { tenantId: 'tenant-ke' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'outbreaks:tenant-ke',
        'outbreak:new',
        expect.objectContaining({
          tenantId: 'tenant-ke',
          data: { eventId: 'evt-1', disease: 'FMD' },
        }),
      );
    });

    it('should skip if no tenantId in headers', async () => {
      const sub = findHandler('health.event.created')!;
      await sub.handler({ eventId: 'evt-1' }, {});

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe('ms.health.event.confirmed.v1 → outbreak:confirmed', () => {
    it('should broadcast outbreak:confirmed to outbreaks:{tenantId}', async () => {
      const sub = findHandler('health.event.confirmed')!;
      await sub.handler(
        { eventId: 'evt-2' },
        { tenantId: 'tenant-ng' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'outbreaks:tenant-ng',
        'outbreak:confirmed',
        expect.objectContaining({
          tenantId: 'tenant-ng',
          data: { eventId: 'evt-2' },
        }),
      );
    });
  });

  describe('rec.health.outbreak.alert.v1 → outbreak:alert', () => {
    it('should broadcast outbreak:alert to ALL clients', async () => {
      const sub = findHandler('outbreak.alert')!;
      await sub.handler(
        { alertId: 'alert-1', severity: 'HIGH' },
        { tenantId: 'rec-igad' },
      );

      expect(gateway.broadcastToAll).toHaveBeenCalledWith(
        'outbreak:alert',
        expect.objectContaining({
          tenantId: 'rec-igad',
          data: { alertId: 'alert-1', severity: 'HIGH' },
        }),
      );
    });
  });

  describe('au.workflow.validation.approved.v1 → workflow:approved + workflow:updated', () => {
    it('should broadcast both workflow events', async () => {
      const sub = findHandler('workflow.validation.approved')!;
      await sub.handler(
        { recordId: 'rec-1', level: 2 },
        { tenantId: 'tenant-ke' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'workflow:tenant-ke',
        'workflow:approved',
        expect.objectContaining({ tenantId: 'tenant-ke' }),
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'workflow:tenant-ke',
        'workflow:updated',
        expect.objectContaining({
          tenantId: 'tenant-ke',
          action: 'approved',
        }),
      );
    });
  });

  describe('au.workflow.validation.rejected.v1 → workflow:rejected + workflow:updated', () => {
    it('should broadcast both workflow events', async () => {
      const sub = findHandler('workflow.validation.rejected')!;
      await sub.handler(
        { recordId: 'rec-2', reason: 'Incomplete' },
        { tenantId: 'tenant-et' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'workflow:tenant-et',
        'workflow:rejected',
        expect.objectContaining({ tenantId: 'tenant-et' }),
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'workflow:tenant-et',
        'workflow:updated',
        expect.objectContaining({
          tenantId: 'tenant-et',
          action: 'rejected',
        }),
      );
    });
  });

  describe('sys.message.notification.sent.v1 → notification:new', () => {
    it('should broadcast to notifications:{userId}', async () => {
      const sub = findHandler('notification.sent')!;
      await sub.handler(
        { userId: 'user-42', subject: 'Outbreak alert' },
        { tenantId: 'tenant-ke' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'notifications:user-42',
        'notification:new',
        expect.objectContaining({ userId: 'user-42' }),
      );
    });

    it('should handle snake_case user_id', async () => {
      const sub = findHandler('notification.sent')!;
      await sub.handler(
        { user_id: 'user-99', subject: 'Alert' },
        {},
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'notifications:user-99',
        'notification:new',
        expect.objectContaining({ userId: 'user-99' }),
      );
    });

    it('should skip if no userId in payload', async () => {
      const sub = findHandler('notification.sent')!;
      await sub.handler({ subject: 'No user' }, {});

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe('ms.collecte.form.synced.v1 → sync:completed', () => {
    it('should broadcast sync:completed to sync-status:{tenantId}', async () => {
      const sub = findHandler('form.synced')!;
      await sub.handler(
        { formId: 'form-1', agentId: 'agent-1' },
        { tenantId: 'tenant-ke' },
      );

      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'sync-status:tenant-ke',
        'sync:completed',
        expect.objectContaining({
          tenantId: 'tenant-ke',
          data: { formId: 'form-1', agentId: 'agent-1' },
        }),
      );
    });
  });
});
