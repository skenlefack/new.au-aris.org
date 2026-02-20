export interface KafkaHeaders {
  correlationId: string;
  sourceService: string;
  tenantId: string;
  userId?: string;
  schemaVersion: string;
  timestamp: string;
}

export interface KafkaEvent<T> {
  id: string;
  topic: string;
  key: string;
  payload: T;
  headers: KafkaHeaders;
  timestamp: Date;
  version: number;
}
