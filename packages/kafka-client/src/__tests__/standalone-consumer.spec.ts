import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandaloneKafkaConsumer } from '../standalone-consumer';
import type { EachMessagePayload, KafkaMessage } from 'kafkajs';

// Capture eachMessage callback
let capturedEachMessage: ((payload: EachMessagePayload) => Promise<void>) | null = null;

const mockConsumerConnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerSubscribe = vi.fn().mockResolvedValue(undefined);
const mockConsumerRun = vi.fn().mockImplementation(async (config: any) => {
  capturedEachMessage = config.eachMessage;
});
const mockConsumerCommitOffsets = vi.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = vi.fn().mockResolvedValue(undefined);

const mockDlqProducerSend = vi.fn().mockResolvedValue(undefined);
const mockDlqProducerConnect = vi.fn().mockResolvedValue(undefined);
const mockDlqProducerDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(() => ({
    consumer: vi.fn().mockReturnValue({
      connect: mockConsumerConnect,
      subscribe: mockConsumerSubscribe,
      run: mockConsumerRun,
      commitOffsets: mockConsumerCommitOffsets,
      disconnect: mockConsumerDisconnect,
    }),
    producer: vi.fn().mockReturnValue({
      connect: mockDlqProducerConnect,
      send: mockDlqProducerSend,
      disconnect: mockDlqProducerDisconnect,
    }),
  })),
}));

vi.mock('@aris/shared-types', () => ({
  TOPIC_DLQ_ALL: 'dlq.all.v1',
}));

function makeMessage(payload: unknown, headers?: Record<string, Buffer>): KafkaMessage {
  return {
    key: Buffer.from('key-1'),
    value: Buffer.from(JSON.stringify(payload)),
    offset: '10',
    timestamp: Date.now().toString(),
    size: 100,
    attributes: 0,
    headers: headers ?? {},
  } as unknown as KafkaMessage;
}

function makeEachMessagePayload(message: KafkaMessage): EachMessagePayload {
  return {
    topic: 'test.topic.v1',
    partition: 0,
    message,
    heartbeat: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as EachMessagePayload;
}

describe('StandaloneKafkaConsumer', () => {
  let consumer: StandaloneKafkaConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEachMessage = null;
    consumer = new StandaloneKafkaConsumer({
      clientId: 'test-consumer',
      brokers: ['localhost:9092'],
    });
  });

  it('should subscribe and create consumer', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group' },
      handler,
    );

    expect(mockConsumerConnect).toHaveBeenCalled();
    expect(mockConsumerSubscribe).toHaveBeenCalledWith({
      topic: 'test.topic.v1',
      fromBeginning: false,
    });
    expect(mockConsumerRun).toHaveBeenCalled();
  });

  it('should pass parsed JSON payload to handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group' },
      handler,
    );

    const message = makeMessage({ foo: 'bar' });
    await capturedEachMessage!(makeEachMessagePayload(message));

    expect(handler).toHaveBeenCalledWith(
      { foo: 'bar' },
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('should pass parsed headers to handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group' },
      handler,
    );

    const message = makeMessage({ data: 1 }, {
      correlationId: Buffer.from('corr-1'),
      tenantId: Buffer.from('tenant-ke'),
    });
    await capturedEachMessage!(makeEachMessagePayload(message));

    const headers = handler.mock.calls[0][1];
    expect(headers.correlationId).toBe('corr-1');
    expect(headers.tenantId).toBe('tenant-ke');
  });

  it('should commit offset on successful processing', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group' },
      handler,
    );

    const message = makeMessage({ data: 1 });
    await capturedEachMessage!(makeEachMessagePayload(message));

    expect(mockConsumerCommitOffsets).toHaveBeenCalledWith([
      { topic: 'test.topic.v1', partition: 0, offset: '11' },
    ]);
  });

  it('should send to DLQ when maxRetries exceeded', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('processing failed'));
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group', maxRetries: 2 },
      handler,
    );

    const message = makeMessage({ data: 1 }, {
      'x-retry-count': Buffer.from('2'),
    });

    await capturedEachMessage!(makeEachMessagePayload(message));

    expect(mockDlqProducerSend).toHaveBeenCalledWith({
      topic: 'dlq.all.v1',
      messages: [
        expect.objectContaining({
          key: message.key,
          value: message.value,
        }),
      ],
    });
    // Should also commit offset after DLQ
    expect(mockConsumerCommitOffsets).toHaveBeenCalled();
  });

  it('should re-throw with incremented retry header below maxRetries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('transient error'));
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group', maxRetries: 3 },
      handler,
    );

    const message = makeMessage({ data: 1 }, {
      'x-retry-count': Buffer.from('1'),
    });

    await expect(
      capturedEachMessage!(makeEachMessagePayload(message)),
    ).rejects.toThrow('transient error');

    // Should NOT send to DLQ
    expect(mockDlqProducerSend).not.toHaveBeenCalled();
    // Message headers should have incremented retry count
    expect(message.headers!['x-retry-count']).toEqual(Buffer.from('2'));
  });

  it('should disconnect all consumers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'topic1.v1', groupId: 'group1' },
      handler,
    );
    await consumer.subscribe(
      { topic: 'topic2.v1', groupId: 'group2' },
      handler,
    );

    await consumer.disconnect();
    expect(mockConsumerDisconnect).toHaveBeenCalledTimes(2);
  });

  it('should return 0 for missing x-retry-count header', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group', maxRetries: 3 },
      handler,
    );

    // Message without x-retry-count header
    const message = makeMessage({ data: 1 });

    await expect(
      capturedEachMessage!(makeEachMessagePayload(message)),
    ).rejects.toThrow('fail');

    // Since retry count is 0 and maxRetries is 3, it should re-throw (not DLQ)
    expect(mockDlqProducerSend).not.toHaveBeenCalled();
    // Should set retry count to 1
    expect(message.headers!['x-retry-count']).toEqual(Buffer.from('1'));
  });

  it('should parse Buffer header values to strings', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.subscribe(
      { topic: 'test.topic.v1', groupId: 'test-group' },
      handler,
    );

    const message = makeMessage({ data: 1 }, {
      myHeader: Buffer.from('my-value'),
      anotherHeader: Buffer.from('another-value'),
    });
    await capturedEachMessage!(makeEachMessagePayload(message));

    const headers = handler.mock.calls[0][1];
    expect(headers.myHeader).toBe('my-value');
    expect(headers.anotherHeader).toBe('another-value');
  });
});
