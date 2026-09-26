import 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { Client as MinioClient } from 'minio';
import type Redis from 'ioredis';
import type { Client as OpenSearchClient } from '@opensearch-project/opensearch';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafka: StandaloneKafkaProducer;
    minio: MinioClient;
    redis: Redis;
    opensearch: OpenSearchClient;
    authHookFn: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
