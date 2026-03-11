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
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_SYS_MASTER_GEO_UPDATED,
  TOPIC_SYS_MASTER_SPECIES_UPDATED,
  TOPIC_SYS_MASTER_DISEASE_UPDATED,
} from '@aris/shared-types';
import { ROOM_PREFIX } from '../services/room-manager.service';

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

  /**
   * Broadcast a structured message to a hierarchical room.
   * Uses the { type, ... } envelope expected by hierarchical room clients.
   */
  function broadcastMessage(room: string, message: Record<string, unknown>): void {
    io.to(room).emit('message', message);
    roomManager.incrementMessageCount();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXISTING TOPIC SUBSCRIPTIONS (legacy room format)
  // ══════════════════════════════════════════════════════════════════════════

  // ── ms.health.event.created.v1 → outbreaks:{tenantId} ──

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

  // ── ms.health.event.confirmed.v1 → outbreaks:{tenantId} ──

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

  // ── rec.health.outbreak.alert.v1 → broadcast to ALL + hierarchical rooms ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_REC_HEALTH_OUTBREAK_ALERT, groupId: 'realtime-outbreak-alert' },
      async (payload, headers) => {
        const data = payload as Record<string, unknown> | null;
        const tenantId = headers['tenantId'];
        const ts = new Date().toISOString();

        // Legacy: broadcast to all clients
        broadcastToAll('outbreak:alert', {
          tenantId, data: payload, timestamp: ts,
        });

        // Hierarchical: broadcast to country + REC rooms
        const countryCode = data?.countryCode ?? data?.country_code ?? headers['countryCode'];
        const recId = data?.recId ?? data?.rec_id ?? headers['recId'];

        if (countryCode) {
          broadcastMessage(`${ROOM_PREFIX.COUNTRY}${countryCode}`, {
            type: 'ALERT',
            severity: data?.severity ?? 'HIGH',
            message: data?.message ?? 'Health alert',
            affectedArea: countryCode,
            data: payload,
            timestamp: ts,
          });
        }

        if (recId) {
          broadcastMessage(`${ROOM_PREFIX.REC}${recId}`, {
            type: 'ALERT',
            severity: data?.severity ?? 'HIGH',
            message: data?.message ?? 'Regional health alert',
            affectedArea: recId,
            data: payload,
            timestamp: ts,
          });
        }

        app.log.debug('Broadcast outbreak:alert to all + hierarchical rooms');
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to outbreak alert: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── au.workflow.validation.approved.v1 → workflow:{tenantId} + campaign room ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, groupId: 'realtime-workflow-approved' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;
        const ts = new Date().toISOString();
        const data = payload as Record<string, unknown> | null;

        // Legacy
        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:approved',
          { tenantId, data: payload, timestamp: ts },
        );
        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:updated',
          { tenantId, action: 'approved', data: payload, timestamp: ts },
        );

        // Hierarchical: broadcast to campaign room if campaignId present
        const campaignId = data?.campaignId ?? data?.campaign_id ?? headers['campaignId'];
        if (campaignId) {
          broadcastMessage(`${ROOM_PREFIX.CAMPAIGN}${campaignId}`, {
            type: 'DATA_UPDATE',
            entity: 'workflow',
            data: { action: 'approved', ...data },
            timestamp: ts,
          });
        }
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to workflow approved: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── au.workflow.validation.rejected.v1 → workflow:{tenantId} ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, groupId: 'realtime-workflow-rejected' },
      async (payload, headers) => {
        const tenantId = headers['tenantId'];
        if (!tenantId) return;
        const ts = new Date().toISOString();

        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:rejected',
          { tenantId, data: payload, timestamp: ts },
        );
        broadcastToRoom(
          `workflow:${tenantId}`,
          'workflow:updated',
          { tenantId, action: 'rejected', data: payload, timestamp: ts },
        );
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to workflow rejected: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── sys.message.notification.sent.v1 → notifications:{userId} ──

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

  // ── ms.collecte.form.synced.v1 → sync-status:{tenantId} ──

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

  // ══════════════════════════════════════════════════════════════════════════
  //  NEW HIERARCHICAL ROOM SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── ms.collecte.form.submitted.v1 → room:campaign:{campaignId} ──

  try {
    await kafkaConsumer.subscribe(
      { topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: 'realtime-collecte-submitted' },
      async (payload, headers) => {
        const data = payload as Record<string, unknown> | null;
        const campaignId = data?.campaignId ?? data?.campaign_id ?? headers['campaignId'];
        if (!campaignId) return;
        const ts = new Date().toISOString();

        broadcastMessage(`${ROOM_PREFIX.CAMPAIGN}${campaignId}`, {
          type: 'DATA_UPDATE',
          entity: 'submission',
          data: payload,
          timestamp: ts,
        });

        app.log.debug(`Broadcast DATA_UPDATE to ${ROOM_PREFIX.CAMPAIGN}${campaignId}`);
      },
    );
  } catch (error) {
    app.log.error(
      `Failed to subscribe to collecte form submitted: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }

  // ── sys.master.*.updated.v1 → room:continental ──

  for (const topic of [TOPIC_SYS_MASTER_GEO_UPDATED, TOPIC_SYS_MASTER_SPECIES_UPDATED, TOPIC_SYS_MASTER_DISEASE_UPDATED]) {
    const shortName = topic.replace('sys.master.', '').replace('.updated.v1', '');
    try {
      await kafkaConsumer.subscribe(
        { topic, groupId: `realtime-master-${shortName}` },
        async (payload) => {
          const ts = new Date().toISOString();

          broadcastMessage(ROOM_PREFIX.CONTINENTAL, {
            type: 'SYNC_REQUIRED',
            entityType: `master-data:${shortName}`,
            since: ts,
            data: payload,
            timestamp: ts,
          });

          app.log.debug(`Broadcast SYNC_REQUIRED (${shortName}) to ${ROOM_PREFIX.CONTINENTAL}`);
        },
      );
    } catch (error) {
      app.log.error(
        `Failed to subscribe to master ${shortName} updated: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }

  app.log.info('Realtime consumer subscribed to all Kafka topics (legacy + hierarchical)');

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await kafkaConsumer.disconnectAll();
  });
}, { name: 'kafka-consumers-plugin' });
