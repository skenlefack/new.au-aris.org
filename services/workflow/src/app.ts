import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { readFileSync } from 'fs';
import { StandaloneKafkaProducer } from '@aris/kafka-client';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import prismaPlugin from './plugins/prisma.js';
import kafkaConsumersPlugin from './plugins/kafka-consumers.js';
import { WorkflowService } from './services/workflow.service.js';
import { EscalationService } from './services/escalation.service.js';
import { DefinitionService } from './services/definition.service.js';
import { ValidationChainService } from './services/validation-chain.service.js';
import { registerWorkflowRoutes } from './routes/workflow.routes.js';
import { registerDefinitionRoutes } from './routes/definition.routes.js';
import { registerValidationChainRoutes } from './routes/validation-chain.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    workflowService: WorkflowService;
    escalationService: EscalationService;
    definitionService: DefinitionService;
    validationChainService: ValidationChainService;
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

  // Prisma plugin
  await app.register(prismaPlugin);

  // Kafka producer
  const kafka = new StandaloneKafkaProducer({
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-workflow-service',
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  });

  try {
    await kafka.connect();
    app.log.info('Kafka producer connected');
  } catch (err) {
    app.log.warn(`Kafka connect failed, events will be unavailable: ${err}`);
  }

  app.decorate('kafka', kafka as any);
  app.addHook('onClose', async () => {
    await kafka.disconnect();
  });

  // Auth hook
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try {
      publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
    } catch { /* key file not found */ }
  }

  const authOptions: AuthHookOptions = { publicKey };
  app.decorate('authHookFn', authHook(authOptions));

  // Services — use local `kafka` variable (StandaloneKafkaProducer) directly
  // to avoid type conflict with @aris/kafka-client FastifyKafka augmentation
  const workflowService = new WorkflowService(app.prisma, kafka);
  app.decorate('workflowService', workflowService);

  const definitionService = new DefinitionService(app.prisma);
  app.decorate('definitionService', definitionService);

  const validationChainService = new ValidationChainService(app.prisma);
  app.decorate('validationChainService', validationChainService);

  const escalationService = new EscalationService(app.prisma, workflowService, {
    log: (...args: any[]) => app.log.info(args[0]),
    error: (...args: any[]) => app.log.error(args[0]),
    warn: (...args: any[]) => app.log.warn(args[0]),
  });
  app.decorate('escalationService', escalationService);

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled server error');
    }

    return reply.code(statusCode).send({
      statusCode,
      message,
      errors: (error as any).errors ?? undefined,
    });
  });

  // Health endpoint
  app.get('/health', async () => ({
    status: 'ok',
    service: 'workflow',
    timestamp: new Date().toISOString(),
  }));

  // Routes
  await app.register(registerWorkflowRoutes);
  await app.register(registerDefinitionRoutes);
  await app.register(registerValidationChainRoutes);

  // Kafka consumers
  await app.register(kafkaConsumersPlugin);

  // Start escalation cron when app is ready
  app.addHook('onReady', async () => {
    escalationService.start();
  });

  app.addHook('onClose', async () => {
    escalationService.stop();
  });

  return app;
}
