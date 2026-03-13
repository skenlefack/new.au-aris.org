import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { ApiaryService } from './services/apiary.service';
import type { ProductionService } from './services/production.service';
import type { ColonyHealthService } from './services/colony-health.service';
import type { TrainingService } from './services/training.service';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    kafkaProducer: StandaloneKafkaProducer;
    authHookFn: ReturnType<typeof authHook>;
    apiaryService: ApiaryService;
    productionService: ProductionService;
    colonyHealthService: ColonyHealthService;
    trainingService: TrainingService;
  }
}
