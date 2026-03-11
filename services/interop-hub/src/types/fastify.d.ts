import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import type { MinioStorage } from '../plugins/minio';
import type { WahisService } from '../services/wahis.service';
import type { EmpresService } from '../services/empres.service';
import type { FaostatService } from '../services/faostat.service';
import type { ConnectorService } from '../services/connector.service';
import type { ExportSchedulerService } from '../services/export-scheduler.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    minio: MinioStorage;
    wahisService: WahisService;
    empresService: EmpresService;
    faostatService: FaostatService;
    connectorService: ConnectorService;
    exportScheduler: ExportSchedulerService;
  }
}
