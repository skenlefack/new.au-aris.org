import type { authHook } from '@aris/auth-middleware';
import type { OllamaClient } from '../clients/ollama.client';
import type { MlClient } from '../clients/ml.client';
import type { CollecteClient } from '../clients/collecte.client';
import type { RateLimiter } from '../services/rate-limiter';
import type { UsageLogger } from '../services/usage-logger';
import type { PromptCache } from '../services/prompt-cache';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    rateLimitHook: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    ollamaClient: OllamaClient;
    mlClient: MlClient;
    collecteClient: CollecteClient;
    rateLimiter: RateLimiter;
    usageLogger: UsageLogger;
    promptCache: PromptCache;
  }
}
