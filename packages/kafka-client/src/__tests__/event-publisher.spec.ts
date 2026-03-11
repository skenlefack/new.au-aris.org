import { describe, it, expect, vi, beforeEach } from 'vitest';

// We can't easily use NestJS DI in unit tests, so we'll instantiate directly
// by mocking the @Inject decorator behavior

const mockSend = vi.fn().mockResolvedValue(undefined);

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// Import after mocks
import { EventPublisher } from '../events/event-publisher';

describe('EventPublisher', () => {
  let publisher: EventPublisher;
  let mockProducer: { send: typeof mockSend };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducer = { send: mockSend };
    // Create publisher by directly setting the private field
    publisher = new (EventPublisher as any)(mockProducer);
  });

  it('should publish event with auto-generated eventId and timestamp', async () => {
    await publisher.publish('ms.health.event.created.v1', {
      eventType: 'ms.health.event.created.v1',
      source: 'health-service',
      version: 1,
      tenantId: 'tenant-ke',
      payload: { diseaseId: 'd1' },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [topic, key, event, headers] = mockSend.mock.calls[0];
    expect(topic).toBe('ms.health.event.created.v1');
    expect(event.eventId).toBe('mock-uuid-1234');
    expect(event.timestamp).toBeDefined();
    expect(event.correlationId).toBeDefined();
  });

  it('should use provided eventId when given', async () => {
    await publisher.publish('test.topic.v1', {
      eventType: 'test.topic.v1',
      source: 'test',
      version: 1,
      eventId: 'custom-id',
      payload: {},
    });

    const [, , event] = mockSend.mock.calls[0];
    expect(event.eventId).toBe('custom-id');
  });

  it('should use options.key as partition key when provided', async () => {
    await publisher.publish(
      'test.topic.v1',
      {
        eventType: 'test.topic.v1',
        source: 'test',
        version: 1,
        payload: {},
      },
      { key: 'custom-key' },
    );

    const [, key] = mockSend.mock.calls[0];
    expect(key).toBe('custom-key');
  });

  it('should default partition key to eventId', async () => {
    await publisher.publish('test.topic.v1', {
      eventType: 'test.topic.v1',
      source: 'test',
      version: 1,
      payload: {},
    });

    const [, key] = mockSend.mock.calls[0];
    expect(key).toBe('mock-uuid-1234');
  });

  it('should include userId in headers when present', async () => {
    await publisher.publish('test.topic.v1', {
      eventType: 'test.topic.v1',
      source: 'test',
      version: 1,
      tenantId: 'tenant-1',
      userId: 'user-42',
      payload: {},
    });

    const [, , , headers] = mockSend.mock.calls[0];
    expect(headers.userId).toBe('user-42');
    expect(headers.tenantId).toBe('tenant-1');
  });
});
