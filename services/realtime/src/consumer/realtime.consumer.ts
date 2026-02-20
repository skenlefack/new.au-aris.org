import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_MS_COLLECTE_FORM_SYNCED,
} from '@aris/shared-types';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { RoomManagerService } from '../gateway/room-manager.service';

@Injectable()
export class RealtimeConsumer implements OnModuleInit {
  private readonly logger = new Logger(RealtimeConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly gateway: RealtimeGateway,
    private readonly roomManager: RoomManagerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.subscribeHealthEventCreated(),
      this.subscribeHealthEventConfirmed(),
      this.subscribeOutbreakAlert(),
      this.subscribeWorkflowApproved(),
      this.subscribeWorkflowRejected(),
      this.subscribeNotificationSent(),
      this.subscribeFormSynced(),
    ]);
    this.logger.log('Realtime consumer subscribed to all Kafka topics');
  }

  // ── ms.health.event.created.v1 → outbreaks:{tenantId} ──

  private async subscribeHealthEventCreated(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_HEALTH_EVENT_CREATED, groupId: 'realtime-health-created' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;

          this.gateway.broadcastToRoom(
            `outbreaks:${tenantId}`,
            'outbreak:new',
            { tenantId, data: payload, timestamp: new Date().toISOString() },
          );

          this.logger.debug(
            `Broadcast outbreak:new to outbreaks:${tenantId}`,
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to health event created',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── ms.health.event.confirmed.v1 → outbreaks:{tenantId} ──

  private async subscribeHealthEventConfirmed(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_HEALTH_EVENT_CONFIRMED, groupId: 'realtime-health-confirmed' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;

          this.gateway.broadcastToRoom(
            `outbreaks:${tenantId}`,
            'outbreak:confirmed',
            { tenantId, data: payload, timestamp: new Date().toISOString() },
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to health event confirmed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── rec.health.outbreak.alert.v1 → broadcast to all connected clients ──

  private async subscribeOutbreakAlert(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_REC_HEALTH_OUTBREAK_ALERT, groupId: 'realtime-outbreak-alert' },
        async (payload, headers) => {
          // Continental alert: broadcast to all
          this.gateway.broadcastToAll('outbreak:alert', {
            tenantId: headers['tenantId'],
            data: payload,
            timestamp: new Date().toISOString(),
          });

          this.logger.debug('Broadcast outbreak:alert to all clients');
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to outbreak alert',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── au.workflow.validation.approved.v1 → workflow:{tenantId} ──

  private async subscribeWorkflowApproved(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: 'realtime-workflow-approved' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;

          this.gateway.broadcastToRoom(
            `workflow:${tenantId}`,
            'workflow:approved',
            { tenantId, data: payload, timestamp: new Date().toISOString() },
          );

          // Also emit generic workflow:updated
          this.gateway.broadcastToRoom(
            `workflow:${tenantId}`,
            'workflow:updated',
            { tenantId, action: 'approved', data: payload, timestamp: new Date().toISOString() },
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to workflow approved',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── au.workflow.validation.rejected.v1 → workflow:{tenantId} ──

  private async subscribeWorkflowRejected(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, groupId: 'realtime-workflow-rejected' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;

          this.gateway.broadcastToRoom(
            `workflow:${tenantId}`,
            'workflow:rejected',
            { tenantId, data: payload, timestamp: new Date().toISOString() },
          );

          this.gateway.broadcastToRoom(
            `workflow:${tenantId}`,
            'workflow:updated',
            { tenantId, action: 'rejected', data: payload, timestamp: new Date().toISOString() },
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to workflow rejected',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── sys.message.notification.sent.v1 → notifications:{userId} ──

  private async subscribeNotificationSent(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_SYS_MESSAGE_NOTIFICATION_SENT, groupId: 'realtime-notification-sent' },
        async (payload) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const userId = (data.userId ?? data.user_id) as string | undefined;
          if (!userId) return;

          this.gateway.broadcastToRoom(
            `notifications:${userId}`,
            'notification:new',
            { userId, data: payload, timestamp: new Date().toISOString() },
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to notification sent',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── ms.collecte.form.synced.v1 → sync-status:{tenantId} ──

  private async subscribeFormSynced(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_COLLECTE_FORM_SYNCED, groupId: 'realtime-sync-status' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;

          this.gateway.broadcastToRoom(
            `sync-status:${tenantId}`,
            'sync:completed',
            { tenantId, data: payload, timestamp: new Date().toISOString() },
          );
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to form synced',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
