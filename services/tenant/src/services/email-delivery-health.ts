/**
 * Email delivery health — the checks behind the "Email delivery" card of the
 * Kafka Consumer Health page.
 *
 * An email (welcome, password reset, new-device login) goes through:
 *   producer (tenant / credential) → Kafka topic → message-service consumer
 *   → provider (Postmark or SMTP).
 * Each step has a check. The pure `evaluateEmailDelivery()` turns the raw
 * observations into statuses so it can be unit-tested.
 */
import type { HealthStatus, ConsumerGroupHealth } from './kafka-health.service';
import type { PublishFailure } from './kafka-publish-tracker';

export const EMAIL_CONSUMER_GROUPS = ['message-service-welcome', 'message-service-transactional'] as const;

export interface EmailCheck {
  key: 'message-service' | 'provider' | 'delivery' | 'consumers' | 'topics' | 'publishing';
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface EmailDeliveryHealth {
  status: HealthStatus;
  checks: EmailCheck[];
  provider: string | null;
  sentLastHour: number | null;
  failedLastHour: number | null;
  checkedAt: string;
}

/** What GET /health/email of the message service returns. */
export interface MessageEmailHealth {
  provider: { ok: boolean; detail: string; provider: string; checkedAt: string };
  delivery: {
    windowMinutes: number;
    sent: number;
    failed: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastError: string | null;
  };
}

export interface EmailObservations {
  /** null when the message service could not be reached. */
  message: MessageEmailHealth | null;
  messageError?: string;
  consumers: ConsumerGroupHealth[];
  /** groupId → epoch ms since when the group has had a lag > 0. */
  lagSince: Map<string, number>;
  /** Email-trigger topics that do not exist in Kafka. */
  missingEmailTopics: string[];
  /** Other ARIS topics that do not exist in Kafka (null if not checked). */
  missingOtherTopics: string[] | null;
  publishFailures: PublishFailure[];
  emailTopics: readonly string[];
  now: number;
}

const LAG_WARNING_MS = 3 * 60 * 1000;
const LAG_CRITICAL_MS = 15 * 60 * 1000;
const RANK: Record<HealthStatus, number> = { healthy: 0, warning: 1, critical: 2 };

export function worst(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>((acc, s) => (RANK[s] > RANK[acc] ? s : acc), 'healthy');
}

function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m <= 1 ? '1 minute' : `${m} minutes`;
}

function list(items: string[], max = 5): string {
  return items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
}

export function evaluateEmailDelivery(o: EmailObservations): EmailDeliveryHealth {
  const checks: EmailCheck[] = [];

  // 1. Message service
  checks.push(
    o.message
      ? { key: 'message-service', label: 'Message service', status: 'healthy', detail: 'Reachable' }
      : {
          key: 'message-service',
          label: 'Message service',
          status: 'critical',
          detail: `Unreachable: ${o.messageError ?? 'no response'}. No email can be sent.`,
        },
  );

  // 2. Provider (Postmark / SMTP)
  if (o.message) {
    const p = o.message.provider;
    checks.push({
      key: 'provider',
      label: `Email provider (${p.provider})`,
      status: p.ok ? 'healthy' : 'critical',
      detail: p.ok ? p.detail : `${p.detail}. Emails are rejected by the provider.`,
    });
  } else {
    checks.push({ key: 'provider', label: 'Email provider', status: 'warning', detail: 'Not checked (message service unreachable)' });
  }

  // 3. Recent deliveries
  if (o.message) {
    const d = o.message.delivery;
    let status: HealthStatus = 'healthy';
    let detail = d.sent + d.failed === 0
      ? `No email sent in the last ${d.windowMinutes} minutes`
      : `${d.sent} sent, ${d.failed} failed in the last ${d.windowMinutes} minutes`;
    if (d.failed > 0) {
      status = d.sent === 0 ? 'critical' : 'warning';
      detail += `. Last error: ${d.lastError ?? 'unknown'}`;
    }
    checks.push({ key: 'delivery', label: 'Recent deliveries', status, detail });
  }

  // 4. Email consumers (welcome, password reset, new-device login)
  const consumerProblems: string[] = [];
  let consumerStatus: HealthStatus = 'healthy';
  for (const groupId of EMAIL_CONSUMER_GROUPS) {
    const g = o.consumers.find((c) => c.groupId === groupId);
    if (!g) {
      consumerStatus = 'critical';
      consumerProblems.push(`${groupId} is not registered in Kafka (consumer never started)`);
      continue;
    }
    const state = g.state.toLowerCase();
    if (g.members === 0 || state === 'dead' || state === 'empty') {
      consumerStatus = 'critical';
      consumerProblems.push(`${groupId} has no active consumer (state ${g.state})`);
      continue;
    }
    const since = o.lagSince.get(groupId);
    if (g.totalLag > 0 && since !== undefined) {
      const age = o.now - since;
      if (age >= LAG_CRITICAL_MS) {
        consumerStatus = 'critical';
        consumerProblems.push(`${groupId}: ${g.totalLag} email(s) waiting for ${minutes(age)}`);
      } else if (age >= LAG_WARNING_MS) {
        consumerStatus = worst([consumerStatus, 'warning']);
        consumerProblems.push(`${groupId}: ${g.totalLag} email(s) waiting for ${minutes(age)}`);
      }
    }
  }
  checks.push({
    key: 'consumers',
    label: 'Email consumers',
    status: consumerStatus,
    detail: consumerProblems.length > 0 ? consumerProblems.join('; ') : 'Welcome and transactional consumers are active, nothing waiting',
  });

  // 5. Topics
  if (o.missingEmailTopics.length > 0) {
    checks.push({
      key: 'topics',
      label: 'Kafka topics',
      status: 'critical',
      detail: `Missing email topic(s): ${list(o.missingEmailTopics)}`,
    });
  } else if (o.missingOtherTopics && o.missingOtherTopics.length > 0) {
    checks.push({
      key: 'topics',
      label: 'Kafka topics',
      status: 'warning',
      detail: `${o.missingOtherTopics.length} ARIS topic(s) do not exist: ${list(o.missingOtherTopics)}. `
        + 'A missing topic can jam a service producer and stop its emails.',
    });
  } else {
    checks.push({
      key: 'topics',
      label: 'Kafka topics',
      status: o.missingOtherTopics ? 'healthy' : 'warning',
      detail: o.missingOtherTopics ? 'All ARIS topics exist' : 'Topic list not available',
    });
  }

  // 6. Event publishing (tenant service producer)
  const emailFailures = o.publishFailures.filter((f) => o.emailTopics.includes(f.topic));
  const otherFailures = o.publishFailures.filter((f) => !o.emailTopics.includes(f.topic));
  if (emailFailures.length > 0) {
    const last = emailFailures[emailFailures.length - 1];
    checks.push({
      key: 'publishing',
      label: 'Event publishing (Settings)',
      status: 'critical',
      detail: `${emailFailures.length} welcome-email event(s) could not be published. Last error: ${last.error}`,
    });
  } else if (otherFailures.length > 0) {
    const topics = [...new Set(otherFailures.map((f) => f.topic))];
    checks.push({
      key: 'publishing',
      label: 'Event publishing (Settings)',
      status: 'warning',
      detail: `${otherFailures.length} event(s) failed on ${list(topics)}. Last error: ${otherFailures[otherFailures.length - 1].error}`,
    });
  } else {
    checks.push({ key: 'publishing', label: 'Event publishing (Settings)', status: 'healthy', detail: 'No failure in the last 15 minutes' });
  }

  return {
    status: worst(checks.map((c) => c.status)),
    checks,
    provider: o.message?.provider.provider ?? null,
    sentLastHour: o.message?.delivery.sent ?? null,
    failedLastHour: o.message?.delivery.failed ?? null,
    checkedAt: new Date(o.now).toISOString(),
  };
}
