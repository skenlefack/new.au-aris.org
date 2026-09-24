/**
 * KafkaHealthService — Monitors all Kafka consumer groups via the KafkaJS Admin API.
 *
 * - Polls every 60 s, classifies each consumer group as healthy / warning / critical
 * - Sends email alerts via Postmark (direct HTTP, NOT via Kafka) when a consumer
 *   transitions to an unhealthy state
 * - Exposes data to the admin UI (GET /admin/kafka/health)
 */
import { Kafka, Admin, GroupOverview } from 'kafkajs';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

// ── Types ──

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface PartitionLag {
  topic: string;
  partition: number;
  currentOffset: string;
  logEndOffset: string;
  lag: number;
}

export interface ConsumerGroupHealth {
  groupId: string;
  state: string;
  healthStatus: HealthStatus;
  members: number;
  totalLag: number;
  partitions: PartitionLag[];
  serviceName: string | null;
}

export interface KafkaHealthSummary {
  totalGroups: number;
  healthy: number;
  warning: number;
  critical: number;
  totalLag: number;
  consumers: ConsumerGroupHealth[];
  polledAt: string;
}

interface AlertState {
  status: HealthStatus;
  lastAlertAt: number; // epoch ms
}

// ── Consumer-group → Docker-service mapping ──

const GROUP_SERVICE_MAP: Record<string, string> = {
  // Message service (port 3006)
  'message-service-welcome': 'message',
  'message-service-notifications': 'message',
  'message-service-transactional': 'message',
  'message-service-support': 'message',
  // Realtime service (port 3008)
  'realtime-health-created': 'realtime',
  'realtime-health-confirmed': 'realtime',
  'realtime-outbreak-alert': 'realtime',
  'realtime-workflow-approved': 'realtime',
  'realtime-workflow-rejected': 'realtime',
  'realtime-workflow-returned': 'realtime',
  'realtime-notification-sent': 'realtime',
  'realtime-sync-status': 'realtime',
  'realtime-collecte-submitted': 'realtime',
  'realtime-master-geo': 'realtime',
  'realtime-master-species': 'realtime',
  'realtime-master-disease': 'realtime',
  // Workflow service (port 3012)
  'workflow-quality-consumer': 'workflow',
  'workflow-instance-request-consumer': 'workflow',
  // Analytics service (port 3030)
  'analytics-aggregator': 'analytics',
  'analytics-composite-recompute': 'analytics',
  'analytics-auto-from-kpi': 'analytics',
  'analytics-auto-from-form': 'analytics',
  'analytics-flash-detector': 'analytics',
  // Analytics-worker
  'analytics-worker-health': 'analytics-worker',
  'analytics-worker-collecte': 'analytics-worker',
  'analytics-worker-quality': 'analytics-worker',
  'analytics-worker-livestock': 'analytics-worker',
  'analytics-worker-trade': 'analytics-worker',
  // Data Quality (port 3004)
  'data-quality-validation-request-consumer': 'data-quality',
  // Data Contract (port 3005)
  'data-contract-compliance': 'data-contract',
  'data-contract-quality-validated': 'data-contract',
  'data-contract-quality-rejected': 'data-contract',
  // Animal Health (port 3020)
  'animal-health-wahis-ready-consumer': 'animal-health',
  'animal-health-analytics-ready-consumer': 'animal-health',
  // Interop Hub (port 3032)
  'interop-hub-wahis-ready': 'interop-hub',
  'interop-hub-analytics-ready': 'interop-hub',
  // Interop v2
  'interop-v2-form-consumer': 'interop',
  'interop-v2-health-consumer': 'interop',
  // Collecte (port 3011)
  'collecte-quality-validated-consumer': 'collecte',
  'collecte-quality-rejected-consumer': 'collecte',
  'collecte-workflow-created-consumer': 'collecte',
  // Datalake
  'datalake-service-indexer': 'datalake',
  'datalake-service-olap-ingester': 'datalake',
};

// Docker service → internal port (for restart)
const SERVICE_PORT_MAP: Record<string, number> = {
  tenant: 3001, credential: 3002, 'master-data': 3003, 'data-quality': 3004,
  'data-contract': 3005, message: 3006, drive: 3007, realtime: 3008,
  'form-builder': 3010, collecte: 3011, workflow: 3012,
  'animal-health': 3020, 'livestock-prod': 3021, fisheries: 3022,
  wildlife: 3023, apiculture: 3024, 'trade-sps': 3025, governance: 3026,
  'climate-env': 3027, analytics: 3030, 'geo-services': 3031, 'interop-hub': 3032,
  'analytics-worker': 3035, datalake: 3036, interop: 3037,
};

const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export class KafkaHealthService {
  private admin: Admin | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private alertStates = new Map<string, AlertState>();
  private lastSnapshot: KafkaHealthSummary | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {}

  // ── Public API ──

  async getHealth(): Promise<KafkaHealthSummary> {
    if (this.lastSnapshot && Date.now() - new Date(this.lastSnapshot.polledAt).getTime() < 10_000) {
      return this.lastSnapshot; // serve cached if < 10 s old
    }
    return this.poll();
  }

  async getAlertRecipients(): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ value: string }[]>(
        `SELECT value FROM governance.system_configs WHERE category = 'alerts' AND key = 'kafka_health.recipients' LIMIT 1`,
      );
      if (rows.length > 0) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        return Array.isArray(val) ? val : [];
      }
    } catch { /* table may not exist yet */ }
    return [];
  }

  async setAlertRecipients(recipients: string[]): Promise<void> {
    const value = JSON.stringify(recipients);
    // Upsert
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO governance.system_configs (id, category, key, value, label, type, is_editable, scope, created_at, updated_at)
       VALUES (gen_random_uuid(), 'alerts', 'kafka_health.recipients', $1::jsonb,
               '{"en":"Kafka Health Alert Recipients","fr":"Destinataires alertes Kafka"}'::jsonb,
               'json', true, 'global', NOW(), NOW())
       ON CONFLICT (category, key) WHERE tenant_id IS NULL
       DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      value,
    );
  }

  async restartService(serviceName: string): Promise<{ success: boolean; message: string }> {
    const port = SERVICE_PORT_MAP[serviceName];
    if (!port) {
      return { success: false, message: `Unknown service: ${serviceName}` };
    }
    const containerName = `aris-${serviceName}`;
    const url = `http://${containerName}:${port}/admin/force-restart`;
    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        this.logger.info(`Restart signal sent to ${containerName}`);
        return { success: true, message: `Restart signal sent to ${containerName}. Service will restart in ~5 seconds.` };
      }
      return { success: false, message: `Service responded with status ${res.status}` };
    } catch (err: any) {
      // ECONNREFUSED is expected if service is already down
      return { success: false, message: `Cannot reach ${containerName}: ${err.message}` };
    }
  }

  async sendTestAlert(): Promise<boolean> {
    const recipients = await this.getAlertRecipients();
    if (recipients.length === 0) return false;
    const html = this.buildAlertHtml([{
      groupId: 'test-consumer-group',
      state: 'Dead',
      healthStatus: 'critical',
      members: 0,
      totalLag: 999,
      partitions: [],
      serviceName: 'test-service',
    }], true);
    return this.sendEmail(recipients, 'ARIS Kafka Health — Test Alert', html);
  }

  // ── Scheduler ──

  startScheduler(): void {
    // Initial poll after 10 s (let other services start)
    setTimeout(() => {
      this.checkAndAlert().catch(err => this.logger.error(err, 'Kafka health check failed'));
    }, 10_000);
    this.intervalHandle = setInterval(() => {
      this.checkAndAlert().catch(err => this.logger.error(err, 'Kafka health check failed'));
    }, 60_000);
    this.logger.info('Kafka health scheduler started (60 s interval)');
  }

  stopScheduler(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.disconnectAdmin().catch(() => {});
  }

  // ── Internal ──

  private async getAdmin(): Promise<Admin> {
    if (!this.admin) {
      const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
      const kafka = new Kafka({
        clientId: 'aris-kafka-health-monitor',
        brokers,
        connectionTimeout: 10_000,
        requestTimeout: 15_000,
      });
      this.admin = kafka.admin();
      await this.admin.connect();
    }
    return this.admin;
  }

  private async disconnectAdmin(): Promise<void> {
    if (this.admin) {
      await this.admin.disconnect().catch(() => {});
      this.admin = null;
    }
  }

  private async poll(): Promise<KafkaHealthSummary> {
    const admin = await this.getAdmin();

    // 1. List all consumer groups
    const { groups: allGroups } = await admin.listGroups();
    // Filter to only ARIS consumer groups (protocolType = 'consumer')
    const arisGroups = allGroups.filter(
      (g: GroupOverview) => g.protocolType === 'consumer' || g.protocolType === '',
    );

    if (arisGroups.length === 0) {
      const empty: KafkaHealthSummary = {
        totalGroups: 0, healthy: 0, warning: 0, critical: 0,
        totalLag: 0, consumers: [], polledAt: new Date().toISOString(),
      };
      this.lastSnapshot = empty;
      return empty;
    }

    // 2. Describe groups (batched)
    const groupIds = arisGroups.map((g: GroupOverview) => g.groupId);
    const described = await admin.describeGroups(groupIds);

    // 3. Fetch offsets for each group + compute lag
    const consumers: ConsumerGroupHealth[] = await Promise.all(
      described.groups.map(async (desc) => {
        let partitions: PartitionLag[] = [];
        let totalLag = 0;
        try {
          const rawOffsets = await admin.fetchOffsets({ groupId: desc.groupId, resolveOffsets: true });
          // rawOffsets is Array<{ topic: string; partitions: { partition, offset, metadata }[] }>
          // Flatten into per-partition entries
          const flatOffsets: { topic: string; partition: number; offset: string }[] = [];
          for (const topicEntry of rawOffsets) {
            for (const part of topicEntry.partitions) {
              if (part.offset !== '-1') {
                flatOffsets.push({ topic: topicEntry.topic, partition: part.partition, offset: part.offset });
              }
            }
          }
          if (flatOffsets.length > 0) {
            const topicNames = [...new Set(flatOffsets.map(o => o.topic))];
            const endOffsets = await Promise.all(
              topicNames.map(t => admin.fetchTopicOffsets(t).then(parts => ({ topic: t, parts })))
            );
            const endMap = new Map<string, string>();
            for (const { topic, parts } of endOffsets) {
              for (const p of parts) {
                endMap.set(`${topic}:${p.partition}`, p.high);
              }
            }
            for (const o of flatOffsets) {
              const logEnd = endMap.get(`${o.topic}:${o.partition}`) ?? o.offset;
              const lag = Math.max(0, parseInt(logEnd) - parseInt(o.offset));
              totalLag += lag;
              partitions.push({
                topic: o.topic,
                partition: o.partition,
                currentOffset: o.offset,
                logEndOffset: logEnd,
                lag,
              });
            }
          }
        } catch {
          // Group may have no committed offsets yet
        }

        return {
          groupId: desc.groupId,
          state: desc.state,
          healthStatus: this.classify(desc.state, totalLag),
          members: desc.members.length,
          totalLag,
          partitions,
          serviceName: GROUP_SERVICE_MAP[desc.groupId] ?? null,
        };
      }),
    );

    const summary: KafkaHealthSummary = {
      totalGroups: consumers.length,
      healthy: consumers.filter(c => c.healthStatus === 'healthy').length,
      warning: consumers.filter(c => c.healthStatus === 'warning').length,
      critical: consumers.filter(c => c.healthStatus === 'critical').length,
      totalLag: consumers.reduce((sum, c) => sum + c.totalLag, 0),
      consumers: consumers.sort((a, b) => {
        const order: Record<HealthStatus, number> = { critical: 0, warning: 1, healthy: 2 };
        return (order[a.healthStatus] ?? 3) - (order[b.healthStatus] ?? 3);
      }),
      polledAt: new Date().toISOString(),
    };

    this.lastSnapshot = summary;
    return summary;
  }

  private classify(state: string, totalLag: number): HealthStatus {
    const s = state.toLowerCase();
    if (s === 'dead' || s === 'empty' || totalLag > 10_000) return 'critical';
    if (s === 'preparingrebalance' || s === 'completingrebalance' || totalLag > 1_000) return 'warning';
    return 'healthy';
  }

  private async checkAndAlert(): Promise<void> {
    let summary: KafkaHealthSummary;
    try {
      summary = await this.poll();
    } catch (err) {
      // Kafka unreachable — reconnect next time
      this.logger.warn(err, 'Kafka health poll failed, will retry');
      await this.disconnectAdmin();
      return;
    }

    const unhealthy: ConsumerGroupHealth[] = [];
    const now = Date.now();

    for (const consumer of summary.consumers) {
      const prev = this.alertStates.get(consumer.groupId);

      if (consumer.healthStatus === 'healthy') {
        // Clear alert state on recovery
        if (prev) {
          this.logger.info(`[KafkaHealth] ${consumer.groupId} recovered → healthy`);
          this.alertStates.delete(consumer.groupId);
        }
        continue;
      }

      // Unhealthy — should we alert?
      const shouldAlert =
        !prev || // first time unhealthy
        (prev.status === 'warning' && consumer.healthStatus === 'critical') || // escalation
        (now - prev.lastAlertAt > ALERT_COOLDOWN_MS); // cooldown expired

      if (shouldAlert) {
        unhealthy.push(consumer);
        this.alertStates.set(consumer.groupId, { status: consumer.healthStatus, lastAlertAt: now });
      }
    }

    if (unhealthy.length === 0) return;

    // Send alert email
    const recipients = await this.getAlertRecipients();
    if (recipients.length === 0) {
      this.logger.warn(`[KafkaHealth] ${unhealthy.length} unhealthy consumers but no alert recipients configured`);
      return;
    }

    const subject = `ARIS Kafka Alert — ${unhealthy.length} consumer(s) unhealthy`;
    const html = this.buildAlertHtml(unhealthy, false);
    const sent = await this.sendEmail(recipients, subject, html);
    if (sent) {
      this.logger.info(`[KafkaHealth] Alert sent to ${recipients.length} recipient(s) for ${unhealthy.length} consumer(s)`);
    }
  }

  // ── Email (direct Postmark, no Kafka dependency) ──

  private async sendEmail(recipients: string[], subject: string, html: string): Promise<boolean> {
    const token = process.env['POSTMARK_SERVER_TOKEN'];
    const from = process.env['POSTMARK_FROM'] ?? 'noreply@au-aris.org';
    if (!token) {
      this.logger.warn('[KafkaHealth] POSTMARK_SERVER_TOKEN not set, cannot send alert');
      return false;
    }

    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: from,
          To: recipients.join(','),
          Subject: subject,
          HtmlBody: html,
          MessageStream: 'outbound',
          Tag: 'kafka-health-alert',
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(err, '[KafkaHealth] Failed to send alert email');
      return false;
    }
  }

  private buildAlertHtml(consumers: ConsumerGroupHealth[], isTest: boolean): string {
    const rows = consumers.map(c => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.healthStatus === 'critical' ? '#dc2626' : '#f59e0b'};margin-right:8px;"></span>
          ${c.groupId}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.state}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.serviceName ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.members}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:${c.healthStatus === 'critical' ? '#dc2626' : '#f59e0b'};">
          ${c.totalLag.toLocaleString()}
        </td>
      </tr>`).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#f3f4f6;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:${isTest ? '#2563eb' : '#dc2626'};padding:20px 24px;">
      <h1 style="color:#fff;margin:0;font-size:18px;">
        ${isTest ? 'ARIS Kafka Health — Test Alert' : 'ARIS Kafka Consumer Health Alert'}
      </h1>
      <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;">
        ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
      </p>
    </div>
    <div style="padding:20px 24px;">
      ${isTest ? '<p style="color:#6b7280;font-size:14px;margin-bottom:16px;">This is a test alert. If you received this email, Kafka health alerting is configured correctly.</p>' : ''}
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;">Consumer Group</th>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;">State</th>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;">Service</th>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;">Members</th>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;">Lag</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px;">
        <a href="${process.env['PUBLIC_WEB_URL'] ?? 'https://au-aris.org'}/admin/kafka-health"
           style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
          View Kafka Health Dashboard
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">ARIS 4.0 — AU-IBAR Animal Resources Information System</p>
    </div>
  </div>
</body>
</html>`;
  }
}
