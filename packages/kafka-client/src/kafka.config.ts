export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  groupId?: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  retry?: {
    maxRetries: number;
    initialRetryTime: number;
    maxRetryTime: number;
    factor: number;
  };
  producer?: {
    idempotent: boolean;
    maxInFlightRequests: number;
    transactionTimeout: number;
  };
  consumer?: {
    sessionTimeout: number;
    heartbeatInterval: number;
    maxBytesPerPartition: number;
  };
}

export const DEFAULT_KAFKA_CONFIG: Partial<KafkaConfig> = {
  retry: {
    maxRetries: 5,
    initialRetryTime: 300,
    maxRetryTime: 30000,
    factor: 2,
  },
  producer: {
    idempotent: true,
    maxInFlightRequests: 1,
    transactionTimeout: 30000,
  },
  consumer: {
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576,
  },
};

export const KAFKA_CONFIG_TOKEN = 'ARIS_KAFKA_CONFIG';
export const KAFKA_INSTANCE_TOKEN = 'ARIS_KAFKA_INSTANCE';
