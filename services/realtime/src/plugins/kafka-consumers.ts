import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
  TOPIC_REC_HEALTH_OUTBREAK_ALERT,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_SYS_MESSAGE_NOTIFICATION_SENT,
  TOPIC_MS_COLLECTE_FORM_SYNCED,
} from '@aris/shared-types';

declare module 'fastify' {
  interface FastifyInstance {
    kafkaConsumer: StandaloneKafkaConsumer;
  }
}

export default fp(async (app: FastifyInstance) => {
  const kafkaConsumer = new StandaloneKafkaConsumer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-realtime-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  app.decorate('kafkaConsumer', kafkaConsumer);

  const io = app.io;
  const roomManager = app.roomManager;

  function broadcastToRoom(room: string, event: string, payload: unknown): void {
    io.to(room).emit(event, payload);
    roomManager.incrementMessageCount();
  }

  function broadcastToAll(event: string, payload: unknown): void {
    io.emit(event, payload);
    roomManager.incrementMessageCount();
  }

  // ── ms.health.event.created.v1 → outbreaks:{tenantId}, event outbreak:new ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_MS_HEALTH_EVENT_CREATED, groupId: 'realtime-health-created' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;

        broadcastToRoom(
          `outbreaks:${tenantId}`,
          'outbreak:new',
          { tenantId, data: payload, timestamp: new Date().toISOString() },
        );

        app.log.debug(`Broadcast outbreak:new to outbreaks:${tenantId}`);
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to health event created: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── ms.health.event.confirmed.v1 → outbreaks:{tenantId}, event outbreak:confirmed ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_MS_HEALTH_EVENT_CONFIRMED, groupId: 'realtime-health-confirmed' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;

        broadcastToRoom(
          `outbreaks:${tenantId}`,
          'outbreak:confirmed',
          { tenantId, data: payload, timestamp: new Date().toISOString() },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to health event confirmed: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── rec.health.outbreak.alert.v1 → broadcast to ALL connected clients, event outbreak:alert ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_REC_HEALTH_OUTBREAK_ALERT, groupId: 'realtime-outbreak-alert' },
      async (payload, headers) => {
        broadcastToAll('outbreak:alert', {
          tenantId: headers['tenantId'],
          data: payload,
          timestamp: new Date().toISOString(),
        });

        app.log.debug('Broadcast outbreak:alert to all clients');
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to outbreak alert: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── au.workflow.validation.approved.v1 → workflow:{tenantId}, events workflow:approved + workflow:updated ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: 'realtime-workflow-approved' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;

        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:approved',
          { tenantId, data: payload, timestamp: new Date().toISOString() },
        );

        // Also emit generic workflow:updated
        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:updated',
          { tenantId, action: 'approved', data: payload, timestamp: new Date().toISOString() },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to workflow approved: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── au.workflow.validation.rejected.v1 → workflow:{tenantId}, events workflow:rejected + workflow:updated ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, groupId: 'realtime-workflow-rejected' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;

        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:rejected',
          { tenantId, data: payload, timestamp: new Date().toISOString() },
        );

        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:updated',
          { tenantId, action: 'rejected', data: payload, timestamp: new Date().toISOString() },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to workflow rejected: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── sys.message.notification.sent.v1 → notifications:{userId}, event notification:new ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_SYS_MESSAGE_NOTIFICATION_SENT, groupId: 'realtime-notification-sent' },
      async (payload) => {
        const data = payload as Record<string, unknown> | null;
        if (!data) return;

        const userId = (data.userId ?? data.user_id) as string | undefined;
        if (!userId) return;

        broadcastToRoom(
          `notifications:${userId}`,
          'notification:new',
          { userId, data: payload, timestamp: new Date().toISOString() },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to notification sent: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── ms.collecte.form.synced.v1 → sync-status:{tenantId}, event sync:completed ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_MS_COLLECTE_FORM_SYNCED, groupId: 'realtime-sync-status' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;

        broadcastToRoom(
          `sync-status:${tenantId}`,
          'sync:completed',
          { tenantId, data: payload, timestamp: new Date().toISOString() },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to form synced: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  app.log.info('Realtime consumer subscribed to all Kafka topics');

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await kafkaConsumer.disconnectAll();
  });
}, { name: 'kafka-consumers-plugin' });
