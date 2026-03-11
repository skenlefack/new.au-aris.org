import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandaloneKafkaProducer } from '../standalone-producer';
import { Kafka } from 'kafkajs';

// Mock kafkajs
const mockProducerSend = vi.fn().mockResolvedValue([{ topicName: 'test', partition: 0, errorCode: 0, offset: '0' }]);
const mockProducerConnect = vi.fn().mockResolvedValue(undefined);
const mockProducerDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(() => ({
    producer: vi.fn().mockReturnValue({
      connect: mockProducerConnect,
      disconnect: mockProducerDisconnect,
      send: mockProducerSend,
    }),
  })),
  logLevel: { WARN: 4 },
}));

describe('StandaloneKafkaProducer', () => {
  let producer: StandaloneKafkaProducer;

  beforeEach(() => {
    vi.clearAllMocks();
    producer = new StandaloneKafkaProducer({
      clientId: 'test-client',
      brokers: ['localhost:9092'],
    });
  });

  // Test 1: connect is idempotent
  it('should not connect twice when already connected', async () => {
    await producer.connect();
    await producer.connect();
    expect(mockProducerConnect).toHaveBeenCalledTimes(1);
  });

  // Test 2: disconnect when not connected is no-op
  it('should not disconnect when not connected', async () => {
    await producer.disconnect();
    expect(mockProducerDisconnect).not.toHaveBeenCalled();
  });

  // Test 3: publish with headers
  it('should publish event with correct headers', async () => {
    await producer.connect();
    await producer.publish({
      topic: 'ms.health.event.created.v1',
      key: 'event-123',
      payload: { diseaseId: 'd1' },
      headers: {
        correlationId: 'corr-1',
        sourceService: 'health-service',
        tenantId: 'tenant-ke',
        schemaVersion: '1',
        timestamp: '2024-01-01T00:00:00Z',
      },
    });

    expect(mockProducerSend).toHaveBeenCalledWith({
      topic: 'ms.health.event.created.v1',
      messages: [
        {
          key: 'event-123',
          value: JSON.stringify({ diseaseId: 'd1' }),
          headers: expect.objectContaining({
            correlationId: 'corr-1',
            sourceService: 'health-service',
            tenantId: 'tenant-ke',
          }),
        },
      ],
    });
  });

  // Test 4: publish includes userId when present
  it('should include userId header when present in event', async () => {
    await producer.connect();
    await producer.publish({
      topic: 'test.topic.v1',
      key: 'k1',
      payload: {},
      headers: {
        correlationId: 'c1',
        sourceService: 'svc',
        tenantId: 't1',
        schemaVersion: '1',
        timestamp: '2024-01-01T00:00:00Z',
        userId: 'user-42',
      },
    });

    const sentHeaders = mockProducerSend.mock.calls[0][0].messages[0].headers;
    expect(sentHeaders.userId).toBe('user-42');
  });

  // Test 5: send forwards KafkaHeaders
  it('should send with forwarded KafkaHeaders', async () => {
    await producer.connect();
    await producer.send(
      'my.topic.v1',
      'key-1',
      { foo: 'bar' },
      {
        correlationId: 'c1',
        sourceService: 'svc',
        tenantId: 't1',
        schemaVersion: '1',
        timestamp: '2024-01-01T00:00:00Z',
      },
    );

    expect(mockProducerSend).toHaveBeenCalledWith({
      topic: 'my.topic.v1',
      messages: [
        {
          key: 'key-1',
          value: JSON.stringify({ foo: 'bar' }),
          headers: expect.objectContaining({
            correlationId: 'c1',
            tenantId: 't1',
          }),
        },
      ],
    });
  });

  // Test 6: sendWithRetry retries on failure
  it('should retry on send failure', async () => {
    vi.useFakeTimers();
    await producer.connect();

    mockProducerSend
      .mockRejectedValueOnce(new Error('broker unavailable'))
      .mockResolvedValueOnce([{ topicName: 'test', partition: 0, errorCode: 0, offset: '0' }]);

    const publishPromise = producer.send(
      'test.topic.v1',
      'k1',
      { data: 1 },
      {
        correlationId: 'c1',
        sourceService: 'svc',
        tenantId: 't1',
        schemaVersion: '1',
        timestamp: '2024-01-01T00:00:00Z',
      },
    );

    // Advance timers to allow the retry delay
    await vi.advanceTimersByTimeAsync(500);

    const result = await publishPromise;
    expect(mockProducerSend).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();

    vi.useRealTimers();
  });

  // Test 7: sendWithRetry throws after maxRetries
  it('should throw after max retries exceeded', async () => {
    await producer.connect();

    // Mock setTimeout to execute immediately to avoid waiting for real delays
    const origSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });

    mockProducerSend
      .mockRejectedValueOnce(new Error('persistent failure'))
      .mockRejectedValueOnce(new Error('persistent failure'))
      .mockRejectedValueOnce(new Error('persistent failure'));

    await expect(
      producer.send(
        'test.topic.v1',
        'k1',
        {},
        {
          correlationId: 'c1',
          sourceService: 'svc',
          tenantId: 't1',
          schemaVersion: '1',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ),
    ).rejects.toThrow('persistent failure');

    // 3 attempts total (initial + 2 retries, maxRetries defaults to 3)
    expect(mockProducerSend).toHaveBeenCalledTimes(3);

    vi.mocked(globalThis.setTimeout).mockRestore();
  });

  // Test 8: constructor merges DEFAULT_KAFKA_CONFIG
  it('should merge custom config with defaults', () => {
    // The producer is created in beforeEach. The Kafka constructor should
    // receive merged config values including default retry settings
    const mockKafka = vi.mocked(Kafka);
    const lastCallArgs = mockKafka.mock.calls[mockKafka.mock.calls.length - 1][0];
    expect(lastCallArgs.clientId).toBe('test-client');
    expect(lastCallArgs.brokers).toEqual(['localhost:9092']);
    // Default retry values from DEFAULT_KAFKA_CONFIG should be applied
    expect(lastCallArgs.retry).toBeDefined();
    expect(lastCallArgs.retry!.initialRetryTime).toBe(300);
  });
});
