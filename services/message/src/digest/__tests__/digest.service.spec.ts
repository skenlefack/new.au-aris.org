import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DigestService } from '../digest.service';

// ── Mocks ──

const mockPrisma = {
  workflowInstance: {
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  notification: {
    count: vi.fn(),
  },
};

const mockNotificationService = {
  send: vi.fn().mockResolvedValue(undefined),
};

const mockTemplateEngine = {
  renderEmail: vi.fn().mockReturnValue({
    subject: '[ARIS] Daily Summary — 21 February 2026',
    html: '<html>digest content</html>',
  }),
  renderSms: vi.fn().mockReturnValue('ARIS Daily: 3 pending, 1 overdue, 5 unread.'),
  renderSubject: vi.fn().mockReturnValue('Daily Digest'),
};

const mockPreferencesService = {
  getChannelsForEvent: vi.fn().mockResolvedValue({
    email: true,
    sms: false,
    push: false,
    inApp: true,
  }),
};

describe('DigestService', () => {
  let service: DigestService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new DigestService(
      mockPrisma as any,
      mockNotificationService as any,
      mockTemplateEngine as any,
      mockPreferencesService as any,
    );
  });

  // ── aggregatePendingActions ──

  describe('aggregatePendingActions', () => {
    it('should return correct counts for user with pending items', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 3 } },
        { current_level: 2, _count: { id: 2 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(1);
      mockPrisma.notification.count.mockResolvedValueOnce(8);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([
        {
          entity_type: 'Outbreak',
          entity_id: 'OB-1',
          current_level: 2,
          domain: 'health',
          created_at: new Date('2026-02-15'),
        },
      ]);

      const result = await service.aggregatePendingActions('user-123');

      expect(result.pendingApprovals).toBe(5); // 3 + 2
      expect(result.overdueCorrections).toBe(1);
      expect(result.unreadCount).toBe(8);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].entityType).toBe('Outbreak');
    });

    it('should return zeros when user has no pending items', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(0);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      const result = await service.aggregatePendingActions('user-456');

      expect(result.pendingApprovals).toBe(0);
      expect(result.overdueCorrections).toBe(0);
      expect(result.unreadCount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should limit items to top 5 ordered by creation date', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 7 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(0);

      const manyItems = Array.from({ length: 5 }, (_, i) => ({
        entity_type: 'Record',
        entity_id: `R-${i}`,
        current_level: 1,
        domain: 'health',
        created_at: new Date(`2026-02-${10 + i}`),
      }));
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce(manyItems);

      const result = await service.aggregatePendingActions('user-789');

      expect(result.items).toHaveLength(5);
      expect(mockPrisma.workflowInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ── sendDigestForUser ──

  describe('sendDigestForUser', () => {
    it('should send email and in-app when user has pending items', async () => {
      // Mock aggregatePendingActions via Prisma
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 3 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(1);
      mockPrisma.notification.count.mockResolvedValueOnce(5);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      await service.sendDigestForUser('user-001', 'tenant-abc');

      // Should check user preferences
      expect(mockPreferencesService.getChannelsForEvent).toHaveBeenCalledWith(
        'user-001',
        'tenant-abc',
        'DAILY_DIGEST',
      );

      // Should render email via template engine
      expect(mockTemplateEngine.renderEmail).toHaveBeenCalledWith(
        'DAILY_DIGEST',
        expect.objectContaining({
          pendingApprovals: 3,
          overdueCorrections: 1,
          unreadCount: 5,
        }),
      );

      // email + in-app = 2 sends (sms and push are false in default prefs)
      expect(mockNotificationService.send).toHaveBeenCalledTimes(2);
    });

    it('should skip digest when user has no pending or overdue items', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(3);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      await service.sendDigestForUser('user-002', 'tenant-abc');

      // Should NOT send anything
      expect(mockNotificationService.send).not.toHaveBeenCalled();
      expect(mockPreferencesService.getChannelsForEvent).not.toHaveBeenCalled();
    });

    it('should send SMS when user has sms preference enabled', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 2 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(0);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      mockPreferencesService.getChannelsForEvent.mockResolvedValueOnce({
        email: true,
        sms: true,
        push: false,
        inApp: false,
      });

      await service.sendDigestForUser('user-003', 'tenant-abc');

      // email + sms = 2 sends
      expect(mockNotificationService.send).toHaveBeenCalledTimes(2);
      expect(mockTemplateEngine.renderSms).toHaveBeenCalledWith(
        'DAILY_DIGEST',
        expect.objectContaining({ pendingApprovals: 2 }),
      );
    });

    it('should not throw when email send fails', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 1 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(0);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      mockNotificationService.send
        .mockRejectedValueOnce(new Error('SMTP connection refused'))
        .mockResolvedValueOnce(undefined); // in-app succeeds

      await expect(
        service.sendDigestForUser('user-004', 'tenant-abc'),
      ).resolves.not.toThrow();
    });
  });

  // ── sendDailyDigests (cron entry point) ──

  describe('sendDailyDigests', () => {
    it('should process all users with pending workflow instances', async () => {
      // First call: get distinct users
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { created_by: 'user-A' },
        { created_by: 'user-B' },
      ]);

      // For user-A: findFirst for tenantId
      mockPrisma.workflowInstance.findFirst.mockResolvedValueOnce({
        tenant_id: 'tenant-1',
      });

      // For user-A: aggregatePendingActions via Prisma
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 1, _count: { id: 2 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(0);
      mockPrisma.notification.count.mockResolvedValueOnce(0);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      // For user-B: findFirst for tenantId
      mockPrisma.workflowInstance.findFirst.mockResolvedValueOnce({
        tenant_id: 'tenant-2',
      });

      // For user-B: aggregatePendingActions via Prisma
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { current_level: 2, _count: { id: 1 } },
      ]);
      mockPrisma.workflowInstance.count.mockResolvedValueOnce(1);
      mockPrisma.notification.count.mockResolvedValueOnce(3);
      mockPrisma.workflowInstance.findMany.mockResolvedValueOnce([]);

      await service.sendDailyDigests();

      // Both users should have had their preferences checked
      expect(mockPreferencesService.getChannelsForEvent).toHaveBeenCalledTimes(2);
    });

    it('should not throw when one user digest fails', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([
        { created_by: 'user-fail' },
      ]);

      mockPrisma.workflowInstance.findFirst.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(service.sendDailyDigests()).resolves.not.toThrow();
    });

    it('should handle empty user list gracefully', async () => {
      mockPrisma.workflowInstance.groupBy.mockResolvedValueOnce([]);

      await service.sendDailyDigests();

      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });
  });
});
