import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import type { Client } from '@opensearch-project/opensearch';
import type { StandaloneKafkaProducer, StandaloneKafkaConsumer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware';
import type { DatalakeService } from '../services/datalake.service';
import type { HistoricalDataService } from '../services/historical-data.service';
import type { IngestionService } from '../services/ingestion.service';
import type { QueryEngineService } from '../services/query-engine.service';
import type { ExportService } from '../services/export.service';
import type { PartitionService } from '../services/partition.service';
import type { MinioStorage } from '../services/minio.storage';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    prisma: PrismaClient;
    kafkaProducer: StandaloneKafkaProducer;
    kafkaConsumer: StandaloneKafkaConsumer;
    elastic: Client;
    datalakeService: DatalakeService;
    historicalDataService: HistoricalDataService;
    ingestionService: IngestionService;
    queryEngine: QueryEngineService;
    exportService: ExportService;
    partitionService: PartitionService;
    minioStorage: MinioStorage;
    authHookFn: ReturnType<typeof authHook>;
  }
}
