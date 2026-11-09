import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateEmailDelivery, type EmailObservations, type MessageEmailHealth } from './email-delivery-health';
import type { ConsumerGroupHealth } from './kafka-health.service';
import { recordPublishFailure, recordPublishSuccess, recentPublishFailures, resetPublishTracker, trackedSend } from './kafka-publish-tracker';

const NOW = Date.parse('2026-11-09T14:00:00Z');
const EMAIL_TOPICS = ['sys.credential.user.created.v1', 'sys.credential.password.reset.v1'];

function group(groupId: string, over: Partial<ConsumerGroupHealth> = {}): ConsumerGroupHealth {
  return { groupId, state: 'Stable', healthStatus: 'healthy', members: 1, totalLag: 0, partitions: [], serviceName: 'message', ...over };
}

function message(over: Partial<MessageEmailHealth['delivery']> = {}, providerOk = true): MessageEmailHealth {
  return {
    provider: { ok: providerOk, detail: providerOk ? 'Postmark server "ARIS" accepts the token' : 'Postmark: Request does not contain a valid Server token', provider: 'postmark', checkedAt: '' },
    delivery: { windowMinutes: 60, sent: 3, failed: 0, lastSuccessAt: null, lastFailureAt: null, lastError: null, ...over },
  };
}

function obs(over: Partial<EmailObservations> = {}): EmailObservations {
  return {
    message: message(),
    consumers: [group('message-service-welcome'), group('message-service-transactional')],
    lagSince: new Map(),
    missingEmailTopics: [],
    missingOtherTopics: [],
    publishFailures: [],
    emailTopics: EMAIL_TOPICS,
    now: NOW,
    ...over,
  };
}

const check = (r: ReturnType<typeof evaluateEmailDelivery>, key: string) => r.checks.find((c) => c.key === key)!;

describe('evaluateEmailDelivery', () => {
  it('is healthy when every step works', () => {
    const r = evaluateEmailDelivery(obs());
    expect(r.status).toBe('healthy');
    expect(r.sentLastHour).toBe(3);
  });

  it('is critical when the message service is unreachable', () => {
    const r = evaluateEmailDelivery(obs({ message: null, messageError: 'ECONNREFUSED' }));
    expect(r.status).toBe('critical');
    expect(check(r, 'message-service').detail).toContain('ECONNREFUSED');
  });

  it('is critical when the provider rejects the credentials', () => {
    const r = evaluateEmailDelivery(obs({ message: message({}, false) }));
    expect(check(r, 'provider').status).toBe('critical');
  });

  it('is critical when every recent send failed, warning when only some did', () => {
    expect(check(evaluateEmailDelivery(obs({ message: message({ sent: 0, failed: 2, lastError: 'boom' }) })), 'delivery').status).toBe('critical');
    expect(check(evaluateEmailDelivery(obs({ message: message({ sent: 5, failed: 1, lastError: 'boom' }) })), 'delivery').status).toBe('warning');
  });

  it('is critical when the welcome consumer is missing or has no member', () => {
    expect(evaluateEmailDelivery(obs({ consumers: [group('message-service-transactional')] })).status).toBe('critical');
    expect(evaluateEmailDelivery(obs({ consumers: [group('message-service-welcome', { members: 0, state: 'Empty' }), group('message-service-transactional')] })).status).toBe('critical');
  });

  it('grades a waiting backlog by how long it has been waiting', () => {
    const lagging = [group('message-service-welcome', { totalLag: 2 }), group('message-service-transactional')];
    const at = (minutesAgo: number) => new Map([['message-service-welcome', NOW - minutesAgo * 60_000]]);
    expect(check(evaluateEmailDelivery(obs({ consumers: lagging, lagSince: at(1) })), 'consumers').status).toBe('healthy');
    expect(check(evaluateEmailDelivery(obs({ consumers: lagging, lagSince: at(5) })), 'consumers').status).toBe('warning');
    expect(check(evaluateEmailDelivery(obs({ consumers: lagging, lagSince: at(20) })), 'consumers').status).toBe('critical');
  });

  it('flags missing topics: critical for email topics, warning for the others', () => {
    expect(check(evaluateEmailDelivery(obs({ missingEmailTopics: ['sys.credential.user.created.v1'] })), 'topics').status).toBe('critical');
    const r = evaluateEmailDelivery(obs({ missingOtherTopics: ['sys.settings.user.updated.v1'] }));
    expect(check(r, 'topics').status).toBe('warning');
    expect(check(r, 'topics').detail).toContain('sys.settings.user.updated.v1');
  });

  it('reproduces the 2026-11-09 incident: jammed producer is critical', () => {
    const r = evaluateEmailDelivery(obs({
      publishFailures: [
        { topic: 'sys.settings.user.updated.v1', error: 'Kafka send timeout after 5000 ms', at: NOW - 60_000 },
        { topic: 'sys.credential.user.created.v1', error: 'Kafka send timeout after 5000 ms', at: NOW - 55_000 },
      ],
    }));
    expect(r.status).toBe('critical');
    expect(check(r, 'publishing').detail).toContain('welcome-email');
  });
});

describe('kafka publish tracker', () => {
  beforeEach(() => resetPublishTracker());

  it('records failures and forgets a topic once it publishes again', () => {
    recordPublishFailure('t1', new Error('down'));
    expect(recentPublishFailures(60_000)).toHaveLength(1);
    recordPublishSuccess('t1');
    expect(recentPublishFailures(60_000)).toHaveLength(0);
  });

  it('trackedSend never throws and records timeouts', async () => {
    await trackedSend('t2', () => new Promise(() => {}), 20);
    await trackedSend('t3', async () => { throw new Error('nope'); });
    await trackedSend('t4', async () => undefined);
    const topics = recentPublishFailures(60_000).map((f) => f.topic);
    expect(topics).toEqual(['t2', 't3']);
  });
});
