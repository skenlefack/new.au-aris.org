import type { PrismaClient } from '@prisma/client';
import type { authHook } from '@aris/auth-middleware/fastify';
import type { WorkflowService } from './services/workflow.service.js';
import type { EscalationService } from './services/escalation.service.js';
import type { DefinitionService } from './services/definition.service.js';
import type { ValidationChainService } from './services/validation-chain.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authHookFn: ReturnType<typeof authHook>;
    workflowService: WorkflowService;
    escalationService: EscalationService;
    definitionService: DefinitionService;
    validationChainService: ValidationChainService;
  }
}
