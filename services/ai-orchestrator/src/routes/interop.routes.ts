/**
 * Router 6: /api/v1/ai/interop
 * Interoperability mapping suggestions using Ollama Coder model.
 * Restricted to SUPER_ADMIN / CONTINENTAL_ADMIN.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';

const PREFIX = '/api/v1/ai/interop';
const CODER_MODEL = process.env.CODER_MODEL || 'qwen2.5-coder:32b';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];

interface SuggestMappingBody {
  sourceSchema: Record<string, unknown>;
  targetStandard: 'FAOSTAT' | 'WAHIS' | 'EMPRES' | 'FishStatJ' | 'CITES' | 'DHIS2';
  context?: string;
  model?: string;
}

interface ValidateMappingBody {
  mapping: Record<string, string>;
  sourceSchema: Record<string, unknown>;
  targetStandard: string;
  model?: string;
}

export async function registerInteropRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /suggest-mapping ──
  app.post(`${PREFIX}/suggest-mapping`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES), app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestMappingBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { sourceSchema, targetStandard, context, model } = request.body;
    const usedModel = model || CODER_MODEL;

    const start = Date.now();
    const prompt = `Given the following source data schema:\n${JSON.stringify(sourceSchema, null, 2)}\n\nSuggest a field mapping to the ${targetStandard} standard.${context ? `\nContext: ${context}` : ''}\n\nRespond with JSON: { "mappings": [{ "source": "...", "target": "...", "transformation": "...", "confidence": 0.0-1.0 }], "unmapped": [...] }`;

    const system = `You are an expert in interoperability standards for animal resources (WAHIS, FAOSTAT, EMPRES, FishStatJ, CITES, DHIS2). Generate precise field mappings with transformation rules.`;

    const result = await app.ollamaClient.generate({
      model: usedModel,
      prompt,
      system,
      format: 'json',
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { raw: result.output, mappings: [] };
    }

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/suggest-mapping`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: parsed });
  });

  // ── POST /validate-mapping ──
  app.post(`${PREFIX}/validate-mapping`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES), app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ValidateMappingBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { mapping, sourceSchema, targetStandard, model } = request.body;
    const usedModel = model || CODER_MODEL;

    const start = Date.now();
    const prompt = `Validate the following field mapping from source schema to ${targetStandard}:\n\nSource schema:\n${JSON.stringify(sourceSchema, null, 2)}\n\nProposed mapping:\n${JSON.stringify(mapping, null, 2)}\n\nCheck for: completeness, type compatibility, semantic correctness, missing required fields.\n\nRespond with JSON: { "valid": true/false, "issues": [{ "field": "...", "severity": "error|warning|info", "message": "..." }], "suggestions": [...] }`;

    const system = 'You are a data interoperability expert. Validate field mappings for correctness and completeness.';

    const result = await app.ollamaClient.generate({
      model: usedModel,
      prompt,
      system,
      format: 'json',
      temperature: 0.1,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { valid: false, issues: [{ field: '*', severity: 'error', message: 'Failed to parse validation result' }] };
    }

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/validate-mapping`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: parsed });
  });
}
