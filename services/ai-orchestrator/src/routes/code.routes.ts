/**
 * Router 7: /api/v1/ai/code
 * Code explanation and fix suggestions using Ollama Coder model.
 * Restricted to SUPER_ADMIN / CONTINENTAL_ADMIN.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';

const PREFIX = '/api/v1/ai/code';
const CODER_MODEL = 'qwen2.5-coder:14b';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];

interface ExplainBody {
  code: string;
  language?: string;
  context?: string;
  model?: string;
}

interface SuggestFixBody {
  code: string;
  error: string;
  language?: string;
  context?: string;
  model?: string;
}

export async function registerCodeRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /explain ──
  app.post(`${PREFIX}/explain`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES), app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ExplainBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { code, language, context, model } = request.body;
    const usedModel = model || CODER_MODEL;

    const cacheKey = app.promptCache.buildKey(usedModel, code, `explain:${language ?? 'auto'}`);
    const cached = await app.promptCache.get<{ explanation: string }>(cacheKey);
    if (cached) {
      return reply.code(200).send({ data: { ...cached, cached: true } });
    }

    const start = Date.now();
    const lang = language ? ` (${language})` : '';
    const ctx = context ? `\nContext: ${context}` : '';
    const prompt = `Explain the following code${lang} in clear, concise terms suitable for a developer.${ctx}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nRespond with JSON: { "explanation": "...", "keyPoints": ["..."], "complexity": "simple|moderate|complex" }`;

    const result = await app.ollamaClient.generate({
      model: usedModel,
      prompt,
      system: 'You are a senior software engineer. Explain code clearly and concisely.',
      format: 'json',
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { explanation: result.output.trim(), keyPoints: [], complexity: 'unknown' };
    }

    await app.promptCache.set(cacheKey, parsed);
    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/explain`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: { ...(parsed as object), cached: false } });
  });

  // ── POST /suggest-fix ──
  app.post(`${PREFIX}/suggest-fix`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES), app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestFixBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { code, error, language, context, model } = request.body;
    const usedModel = model || CODER_MODEL;

    const start = Date.now();
    const lang = language ? ` (${language})` : '';
    const ctx = context ? `\nContext: ${context}` : '';
    const prompt = `The following code${lang} produces this error:\n\nError: ${error}${ctx}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nSuggest a fix.\n\nRespond with JSON: { "diagnosis": "...", "fix": "...", "fixedCode": "...", "confidence": 0.0-1.0 }`;

    const result = await app.ollamaClient.generate({
      model: usedModel,
      prompt,
      system: 'You are a senior software engineer. Diagnose bugs and suggest precise fixes.',
      format: 'json',
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { diagnosis: result.output.trim(), fix: '', fixedCode: '', confidence: 0 };
    }

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/suggest-fix`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: parsed });
  });
}
