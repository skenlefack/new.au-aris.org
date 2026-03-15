import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import { PrismaClient } from '@prisma/client';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { StandaloneCacheService, DEFAULT_TTLS } from '@aris/cache';
import { AuditService } from './services/audit.service';
import { GeoService } from './services/geo.service';
import { SpeciesService } from './services/species.service';
import { DiseaseService } from './services/disease.service';
import { UnitService } from './services/unit.service';
import { TemporalityService } from './services/temporality.service';
import { IdentifierService } from './services/identifier.service';
import { DenominatorService } from './services/denominator.service';
import { VersionService } from './services/version.service';
import { HistoryService } from './services/history.service';
import { ImportExportService } from './services/import-export.service';
import { registerHealthRoutes } from './routes/health.routes';
import { registerGeoRoutes } from './routes/geo.routes';
import { registerSpeciesRoutes } from './routes/species.routes';
import { registerDiseaseRoutes } from './routes/disease.routes';
import { registerUnitRoutes } from './routes/unit.routes';
import { registerTemporalityRoutes } from './routes/temporality.routes';
import { registerIdentifierRoutes } from './routes/identifier.routes';
import { registerDenominatorRoutes } from './routes/denominator.routes';
import { registerVersionRoutes } from './routes/version.routes';
import { registerHistoryRoutes } from './routes/history.routes';
import { registerImportExportRoutes } from './routes/import-export.routes';
import { RefDataService } from './services/ref-data.service';
import { registerRefDataRoutes } from './routes/ref-data.routes';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    cache: StandaloneCacheService;
    // kafka is declared by @aris/kafka-client — use 'as any' when decorating with StandaloneKafkaProducer
    audit: AuditService;
    geoService: GeoService;
    speciesService: SpeciesService;
    diseaseService: DiseaseService;
    unitService: UnitService;
    temporalityService: TemporalityService;
    identifierService: IdentifierService;
    denominatorService: DenominatorService;
    versionService: VersionService;
    historyService: HistoryService;
    importExportService: ImportExportService;
    refDataService: RefDataService;
    authHookFn: ReturnType<typeof authHook>;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(cors, { origin: true, credentials: true });

  // Infrastructure
  const prisma = new PrismaClient();
  await prisma.$connect();
  app.decorate('prisma', prisma);

  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-master-data-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });
  try { await kafka.connect(); } catch (err) {
    app.log.warn(`Kafka connect failed: ${err}`);
  }
  app.decorate('kafka', kafka as any);

  // Redis cache (for master data — high read volume, 1h TTL)
  const cache = new StandaloneCacheService({
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    keyPrefix: 'aris:',
    defaultTtlSeconds: DEFAULT_TTLS.MASTER_DATA,
  });
  try {
    await cache.connect();
    app.log.info('Redis cache connected');
  } catch (err) {
    app.log.warn(`Redis cache connect failed (caching disabled): ${err}`);
  }
  app.decorate('cache', cache);

  // Auth hook
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = require('fs').readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch {}
  }
  app.decorate('authHookFn', authHook({ publicKey } as AuthHookOptions));

  // Services
  const audit = new AuditService(prisma);
  app.decorate('audit', audit);
  app.decorate('geoService', new GeoService(prisma, kafka, audit, cache));
  app.decorate('speciesService', new SpeciesService(prisma, kafka, audit, cache));
  app.decorate('diseaseService', new DiseaseService(prisma, kafka, audit, cache));
  app.decorate('unitService', new UnitService(prisma, audit, cache));
  app.decorate('temporalityService', new TemporalityService(prisma, audit));
  app.decorate('identifierService', new IdentifierService(prisma, audit));
  app.decorate('denominatorService', new DenominatorService(prisma, kafka, audit));
  app.decorate('versionService', new VersionService(prisma));
  app.decorate('historyService', new HistoryService(prisma, audit));
  app.decorate('importExportService', new ImportExportService(prisma, audit));
  app.decorate('refDataService', new RefDataService(prisma, kafka, audit));

  // Error handler
  app.setErrorHandler((error: unknown, _request, reply) => {
    const err = error as { statusCode?: number; message?: string };
    const statusCode = err.statusCode ?? 500;
    const message = err.message ?? 'Internal Server Error';
    reply.code(statusCode).send({ statusCode, message });
  });

  // Routes
  await app.register(registerHealthRoutes);
  await app.register(registerGeoRoutes);
  await app.register(registerSpeciesRoutes);
  await app.register(registerDiseaseRoutes);
  await app.register(registerUnitRoutes);
  await app.register(registerTemporalityRoutes);
  await app.register(registerIdentifierRoutes);
  await app.register(registerDenominatorRoutes);
  await app.register(registerVersionRoutes);
  await app.register(registerHistoryRoutes);
  await app.register(registerImportExportRoutes);
  await app.register(registerRefDataRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await kafka.disconnect();
    await cache.disconnect();
  });

  return app;
}
