import { describe, it, expect } from 'vitest';
import { EVENTS, ALL_EVENT_TOPICS } from '../events/event-catalog';

describe('event-catalog', () => {
  it('should have no duplicate topic names', () => {
    const uniqueTopics = new Set(ALL_EVENT_TOPICS);
    expect(uniqueTopics.size).toBe(ALL_EVENT_TOPICS.length);
  });

  it('should have all topics matching naming convention', () => {
    // Convention: {scope}.{domain}.{entity}.{action}.v{version}
    // Some topics have extra segments (e.g. ms.health.lab.result.created.v1)
    // DLQ topics use dlq.{domain}.v{version}
    const topicPattern = /^(sys|ms|rec|au|dlq)\.([\w][\w-]*\.)+v\d+$/;
    for (const topic of ALL_EVENT_TOPICS) {
      expect(topic).toMatch(topicPattern);
    }
  });

  it('should contain expected domain topics', () => {
    // Health domain
    expect(EVENTS.HEALTH.EVENT_CREATED).toBe('ms.health.event.created.v1');
    expect(EVENTS.HEALTH.OUTBREAK_ALERT).toBe('rec.health.outbreak.alert.v1');
    // Collecte domain
    expect(EVENTS.COLLECTE.FORM_SUBMITTED).toBe('ms.collecte.form.submitted.v1');
    // Workflow domain
    expect(EVENTS.WORKFLOW.VALIDATION_APPROVED).toBe('au.workflow.validation.approved.v1');
    // DLQ
    expect(EVENTS.DLQ.ALL).toBe('dlq.all.v1');
  });
});
