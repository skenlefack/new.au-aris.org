import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type Redis from 'ioredis';
import type { MinioStorage } from '../plugins/minio';
import type { WahisService } from '../services/wahis.service';
import type { EmpresService } from '../services/empres.service';
import type { FaostatService } from '../services/faostat.service';
import type { ConnectorService } from '../services/connector.service';
import type { CountryIngestionService } from '../services/country-ingestion.service';
import type { ExportSchedulerService } from '../services/export-scheduler.service';
import type { HubAuditService } from '../hub/audit-service';
import type { ConnectionService } from '../hub/connection.service';
import type { PipelineService } from '../hub/pipeline.service';
import type { PipelineEngineService } from '../hub/pipeline-engine.service';
import type { MappingService } from '../hub/mapping.service';
import type { TransactionService } from '../hub/transaction.service';
import type { AgreementService } from '../hub/agreement.service';
import type { NotificationService } from '../hub/notification.service';
import type { ScheduleService } from '../hub/schedule.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    kafka: StandaloneKafkaProducer;
    minio: MinioStorage;

    // Legacy services
    wahisService: WahisService;
    empresService: EmpresService;
    faostatService: FaostatService;
    connectorService: ConnectorService;
    countryIngestionService: CountryIngestionService;
    exportScheduler: ExportSchedulerService;

    // Hub v3 services
    hubAudit: HubAuditService;
    hubConnectionService: ConnectionService;
    hubPipelineService: PipelineService;
    hubPipelineEngine: PipelineEngineService;
    hubMappingService: MappingService;
    hubTransactionService: TransactionService;
    hubAgreementService: AgreementService;
    hubNotificationService: NotificationService;
    hubScheduleService: ScheduleService;
  }
}
