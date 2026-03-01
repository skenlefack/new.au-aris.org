import type { Server } from 'socket.io';
import type { StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_MS_COLLECTE_FORM_SYNCED,
} from '@aris/shared-types';
import type { RoomManagerService } from '../services/room-manager.service';

export class RealtimeConsumer {
  constructor(
    private readonly kafkaConsumer: StandaloneKafkaConsumer,
    private readonly io: Server,
    private readonly roomManager: RoomManagerService,
  ) {}

  async start(): Promise<void> {
    await Promise.all([
      this.subscribeHealthEventCreated(),
      this.subscribeHealthEventConfirmed(),
      this.subscribeOutbreakAlert(),
      this.subscribeWorkflowApproved(),
      this.subscribeWorkflowRejected(),
      this.subscribeNotificationSent(),
      this.subscribeFormSynced(),
    ]);
    console.log('[RealtimeConsumer] Subscribed to all Kafka topics');
  }

  async stop(): Promise<void> {
    await this.kafkaConsumer.disconnectAll();
  }

  private broadcastToRoom(room: string, event: string, payload: unknown): void {
    this.io.to(room).emit(event, payload);
    this.roomManager.incrementMessageCount();
  }

  private broadcastToAll(event: string, payload: unknown): void {
    this.io.emit(event, payload);
    this.roomManager.incrementMessageCount();
  }

  private async subscribeHealthEventCreated(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_HEALTH_EVENT_CREATED, groupId: 'realtime-health-created' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;
          this.broadcastToRoom(`outbreaks:${tenantId}`, 'outbreak:new', {
            tenantId, data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to health event created', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeHealthEventConfirmed(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_HEALTH_EVENT_CONFIRMED, groupId: 'realtime-health-confirmed' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;
          this.broadcastToRoom(`outbreaks:${tenantId}`, 'outbreak:confirmed', {
            tenantId, data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to health event confirmed', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeOutbreakAlert(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_REC_HEALTH_OUTBREAK_ALERT, groupId: 'realtime-outbreak-alert' },
        async (payload, headers) => {
          this.broadcastToAll('outbreak:alert', {
            tenantId: headers['tenantId'], data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to outbreak alert', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeWorkflowApproved(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: 'realtime-workflow-approved' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;
          this.broadcastToRoom(`workflow:${tenantId}`, 'workflow:approved', {
            tenantId, data: payload, timestamp: new Date().toISOString(),
          });
          this.broadcastToRoom(`workflow:${tenantId}`, 'workflow:updated', {
            tenantId, action: 'approved', data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to workflow approved', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeWorkflowRejected(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, groupId: 'realtime-workflow-rejected' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;
          this.broadcastToRoom(`workflow:${tenantId}`, 'workflow:rejected', {
            tenantId, data: payload, timestamp: new Date().toISOString(),
          });
          this.broadcastToRoom(`workflow:${tenantId}`, 'workflow:updated', {
            tenantId, action: 'rejected', data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to workflow rejected', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeNotificationSent(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_SYS_MESSAGE_NOTIFICATION_SENT, groupId: 'realtime-notification-sent' },
        async (payload) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;
          const userId = (data.userId ?? data.user_id) as string | undefined;
          if (!userId) return;
          this.broadcastToRoom(`notifications:${userId}`, 'notification:new', {
            userId, data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to notification sent', error instanceof Error ? error.stack : String(error));
    }
  }

  private async subscribeFormSynced(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_MS_COLLECTE_FORM_SYNCED, groupId: 'realtime-sync-status' },
        async (payload, headers) => {
          const tenantId = headers['tenantId'];
          if (!tenantId) return;
          this.broadcastToRoom(`sync-status:${tenantId}`, 'sync:completed', {
            tenantId, data: payload, timestamp: new Date().toISOString(),
          });
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to form synced', error instanceof Error ? error.stack : String(error));
    }
  }
}
