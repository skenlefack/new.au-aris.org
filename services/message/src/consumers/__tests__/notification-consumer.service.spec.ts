import {
  NotificationChannel,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
  TOPIC_AU_QUALITY_CORRECTION_OVERDUE,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
} from '@aris/shared-types';
import { NotificationConsumer } from '../notification.consumer';

// ── Mock factories ──

function mockKafkaConsumer() {
  return {
    subscribe: vi.fn().mockResolvedValue({}),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
  };
}

function mockNotificationService() {
  return {
    send: vi.fn().mockResolvedValue({ data: { id: 'notif-001' } }),
  };
}

function mockTemplateEngine() {
  return {
    renderEmail: vi.fn().mockReturnValue({ subject: '[ARIS] Approved', html: '<p>approved</p>' }),
    renderSms: vi.fn().mockReturnValue('ARIS: approved'),
    renderSubject: vi.fn().mockReturnValue('Submission Approved'),
  };
}

function mockPreferencesService() {
  return {
    getChannelsForEvent: vi.fn().mockResolvedValue({
      email: true,
      sms: false,
      push: false,
      inApp: true,
    }),
  };
}

type SubscribeCall = [
  { topic: string; groupId: string },
  (payload: unknown, headers: Record<string, string | undefined>) => Promise<void>,
];

function getHandler(
  kafkaConsumer: ReturnType<typeof mockKafkaConsumer>,
  topic: string,
): (payload: unknown) => Promise<void> {
  const call = kafkaConsumer.subscribe.mock.calls.find(
    (c: SubscribeCall) => c[0].topic === topic,
  ) as SubscribeCall | undefined;
  if (!call) throw new Error(`No subscription found for topic ${topic}`);
  return call[1];
}

// ── Tests ──

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let kafkaConsumer: ReturnType<typeof mockKafkaConsumer>;
  let notificationService: ReturnType<typeof mockNotificationService>;
  let templateEngine: ReturnType<typeof mockTemplateEngine>;
  let preferencesService: ReturnType<typeof mockPreferencesService>;

  beforeEach(async () => {
    kafkaConsumer = mockKafkaConsumer();
    notificationService = mockNotificationService();
    templateEngine = mockTemplateEngine();
    preferencesService = mockPreferencesService();

    consumer = new NotificationConsumer(
      kafkaConsumer as never,
      notificationService as never,
      templateEngine as never,
      preferencesService as never,
    );

    // Trigger subscriptions
    await consumer.start();
  });

  it('should subscribe to all 5 topics', () => {
    expect(kafkaConsumer.subscribe).toHaveBeenCalledTimes(5);

    const topics = kafkaConsumer.subscribe.mock.calls.map(
      (c: SubscribeCall) => c[0].topic,
    );
    expect(topics).toContain(TOPIC_AU_WORKFLOW_VALIDATION_APPROVED);
    expect(topics).toContain(TOPIC_AU_WORKFLOW_VALIDATION_REJECTED);
    expect(topics).toContain(TOPIC_AU_QUALITY_RECORD_REJECTED);
    expect(topics).toContain(TOPIC_AU_QUALITY_CORRECTION_OVERDUE);
    expect(topics).toContain(TOPIC_MS_COLLECTE_FORM_SUBMITTED);
  });

  it('should use consistent group ID for all subscriptions', () => {
    const groupIds = kafkaConsumer.subscribe.mock.calls.map(
      (c: SubscribeCall) => c[0].groupId,
    );
    const unique = [...new Set(groupIds)];
    expect(unique).toHaveLength(1);
    expect(unique[0]).toBe('message-service-notifications');
  });

  describe('workflow approved', () => {
    it('should send notifications to submitter based on preferences', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_AU_WORKFLOW_VALIDATION_APPROVED);

      await handler({
        recordId: 'rec-001',
        entityType: 'Outbreak',
        submittedBy: 'user-001',
        tenantId: 'tenant-ke',
        level: 2,
      });

      // email + inApp = 2 sends (preferences have email=true, inApp=true)
      expect(notificationService.send).toHaveBeenCalledTimes(2);

      // IN_APP
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          channel: NotificationChannel.IN_APP,
        }),
        'tenant-ke',
      );

      // EMAIL
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          channel: NotificationChannel.EMAIL,
        }),
        'tenant-ke',
      );
    });
  });

  describe('workflow rejected', () => {
    it('should send rejection notification with reason', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_AU_WORKFLOW_VALIDATION_REJECTED);

      await handler({
        recordId: 'rec-002',
        entityType: 'Census',
        submittedBy: 'user-002',
        tenantId: 'tenant-ke',
        level: 1,
        reason: 'Missing geographic data',
      });

      expect(notificationService.send).toHaveBeenCalledTimes(2);

      // Verify rejection reason in body
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-002',
          channel: NotificationChannel.IN_APP,
          body: expect.stringContaining('Missing geographic data'),
        }),
        'tenant-ke',
      );
    });
  });

  describe('quality rejected', () => {
    it('should notify data steward with violation details', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_AU_QUALITY_RECORD_REJECTED);

      await handler({
        recordId: 'rec-003',
        entityType: 'HealthEvent',
        dataStewardId: 'steward-001',
        tenantId: 'tenant-ke',
        violations: ['COMPLETENESS', 'GEOGRAPHIC_CONSISTENCY'],
      });

      expect(notificationService.send).toHaveBeenCalledTimes(2);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'steward-001',
          channel: NotificationChannel.IN_APP,
          body: expect.stringContaining('COMPLETENESS'),
        }),
        'tenant-ke',
      );
    });
  });

  describe('correction overdue', () => {
    it('should escalate to data steward', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_AU_QUALITY_CORRECTION_OVERDUE);

      await handler({
        recordId: 'rec-004',
        entityType: 'Vaccination',
        dataStewardId: 'steward-001',
        tenantId: 'tenant-ke',
        daysOverdue: 7,
      });

      // 2 calls: IN_APP + EMAIL to data steward (no supervisor)
      expect(notificationService.send).toHaveBeenCalledTimes(2);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'steward-001',
          body: expect.stringContaining('7 days overdue'),
        }),
        'tenant-ke',
      );
    });

    it('should also notify supervisor when provided', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_AU_QUALITY_CORRECTION_OVERDUE);

      await handler({
        recordId: 'rec-005',
        entityType: 'Vaccination',
        dataStewardId: 'steward-001',
        supervisorId: 'supervisor-001',
        tenantId: 'tenant-ke',
        daysOverdue: 14,
      });

      // 4 calls: EMAIL + IN_APP to steward + EMAIL + IN_APP to supervisor
      expect(notificationService.send).toHaveBeenCalledTimes(4);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'supervisor-001',
          channel: NotificationChannel.EMAIL,
        }),
        'tenant-ke',
      );
    });
  });

  describe('form submitted', () => {
    it('should notify supervisor about new submission', async () => {
      const handler = getHandler(kafkaConsumer, TOPIC_MS_COLLECTE_FORM_SUBMITTED);

      await handler({
        formId: 'form-001',
        templateId: 'tpl-001',
        submittedBy: 'agent-001',
        supervisorId: 'supervisor-001',
        tenantId: 'tenant-ke',
        templateName: 'Monthly Disease Report',
      });

      expect(notificationService.send).toHaveBeenCalledTimes(2);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'supervisor-001',
          channel: NotificationChannel.IN_APP,
          body: expect.stringContaining('Monthly Disease Report'),
        }),
        'tenant-ke',
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'supervisor-001',
          channel: NotificationChannel.EMAIL,
        }),
        'tenant-ke',
      );
    });
  });
});
