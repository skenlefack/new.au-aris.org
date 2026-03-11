import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventConsumer } from '../events/event-consumer';

const mockSubscribe = vi.fn().mockResolvedValue(undefined);

describe('EventConsumer', () => {
  let eventConsumer: EventConsumer;
  let mockConsumerService: { subscribe: typeof mockSubscribe };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumerService = { subscribe: mockSubscribe };
    eventConsumer = new (EventConsumer as any)(mockConsumerService);
  });

  it('should subscribe to a topic with correct options', async () => {
    const handler = vi.fn();
    await eventConsumer.subscribe({
      topic: 'ms.health.event.created.v1',
      groupId: 'health-consumer',
      handler,
      fromBeginning: true,
      maxRetries: 5,
    });

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'ms.health.event.created.v1',
        groupId: 'health-consumer',
        fromBeginning: true,
        maxRetries: 5,
      }),
      expect.any(Function),
    );
  });

  it('should parse event with BaseEvent shape and call handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await eventConsumer.subscribe({
      topic: 'test.topic.v1',
      groupId: 'test-group',
      handler,
    });

    // Get the wrapped handler
    const wrappedHandler = mockSubscribe.mock.calls[0][1];
    const baseEvent = {
      eventId: 'e1',
      eventType: 'test.event',
      timestamp: '2024-01-01',
      version: 1,
      source: 'test',
      payload: { data: 'hello' },
    };

    await wrappedHandler(baseEvent, {}, {});
    expect(handler).toHaveBeenCalledWith(baseEvent, {}, {});
  });

  it('should wrap legacy payload in BaseEvent shape', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await eventConsumer.subscribe({
      topic: 'test.topic.v1',
      groupId: 'test-group',
      handler,
    });

    const wrappedHandler = mockSubscribe.mock.calls[0][1];
    // Legacy payload without eventType+payload envelope
    const legacyPayload = { someField: 'value', tenantId: 'tenant-ke' };

    await wrappedHandler(legacyPayload, {}, {});
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: legacyPayload,
        tenantId: 'tenant-ke',
      }),
      {},
      {},
    );
  });

  it('should skip null/non-object payloads', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await eventConsumer.subscribe({
      topic: 'test.topic.v1',
      groupId: 'test-group',
      handler,
    });

    const wrappedHandler = mockSubscribe.mock.calls[0][1];
    await wrappedHandler(null, {}, {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('should subscribe to multiple topics via subscribeAll', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    await eventConsumer.subscribeAll([
      { topic: 'topic1.v1', groupId: 'g1', handler: handler1 },
      { topic: 'topic2.v1', groupId: 'g2', handler: handler2 },
    ]);

    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });

  it('should forward headers and raw message to handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await eventConsumer.subscribe({
      topic: 'test.topic.v1',
      groupId: 'test-group',
      handler,
    });

    const wrappedHandler = mockSubscribe.mock.calls[0][1];
    const headers = { correlationId: 'c1', tenantId: 't1' };
    const raw = { offset: '5', key: Buffer.from('k1') };
    const event = {
      eventId: 'e1',
      eventType: 'test',
      payload: {},
    };

    await wrappedHandler(event, headers, raw);
    expect(handler).toHaveBeenCalledWith(
      expect.any(Object),
      headers,
      raw,
    );
  });
});
