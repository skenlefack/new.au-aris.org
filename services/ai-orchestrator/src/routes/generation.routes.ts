/**
 * Router 2: /api/v1/ai/generation
 * AI-assisted generation of forms, campaigns, indicators, dashboards.
 * Each returns an AiGenerationDraft with status: 'DRAFT'.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_AI_GENERATION_COMPLETED,
  TOPIC_AI_GENERATION_FAILED,
} from '@aris/shared-types';

const PREFIX = '/api/v1/ai/generation';
const DEFAULT_MODEL = 'qwen2.5:32b';

type DraftType = 'FORM' | 'CAMPAIGN' | 'INDICATOR' | 'DASHBOARD';

interface AiGenerationDraft {
  id: string;
  type: DraftType;
  prompt: string;
  output: unknown;
  status: 'DRAFT';
  model: string;
  durationMs: number;
  createdAt: string;
}

interface SuggestFormBody {
  description: string;
  domain?: string;
  fields?: string[];
  model?: string;
}

interface SuggestCampaignBody {
  objective: string;
  domain?: string;
  targetCountries?: string[];
  model?: string;
}

interface SuggestIndicatorBody {
  name: string;
  description: string;
  domain?: string;
  availableFields?: string[];
  model?: string;
}

interface SuggestDashboardBody {
  purpose: string;
  domain?: string;
  availableIndicators?: string[];
  model?: string;
}

export async function registerGenerationRoutes(app: FastifyInstance): Promise<void> {

  async function createDraft(
    user: AuthenticatedUser,
    type: DraftType,
    prompt: string,
    systemPrompt: string,
    model: string,
  ): Promise<AiGenerationDraft> {
    const cacheKey = app.promptCache.buildKey(model, prompt, `gen:${type}`);
    const cached = await app.promptCache.get<AiGenerationDraft>(cacheKey);
    if (cached) return cached;

    const start = Date.now();
    let result;
    try {
      result = await app.ollamaClient.generate({
        model,
        prompt,
        system: systemPrompt,
        format: 'json',
        temperature: 0.4,
      });
    } catch (err) {
      await publishKafka(app, TOPIC_AI_GENERATION_FAILED, {
        userId: user.userId, type, prompt, error: (err as Error).message,
      });
      throw err;
    }

    let output: unknown;
    try {
      output = JSON.parse(result.output);
    } catch {
      output = { raw: result.output };
    }

    const draft: AiGenerationDraft = {
      id: crypto.randomUUID(),
      type,
      prompt,
      output,
      status: 'DRAFT',
      model,
      durationMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };

    await app.promptCache.set(cacheKey, draft);

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/suggest-${type.toLowerCase()}`, model,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: draft.durationMs, status: 'success', timestamp: Date.now(),
    });

    await publishKafka(app, TOPIC_AI_GENERATION_COMPLETED, {
      draftId: draft.id, userId: user.userId, type, model,
    });

    return draft;
  }

  // ── POST /suggest-form ──
  app.post(`${PREFIX}/suggest-form`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestFormBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { description, domain, fields, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const prompt = buildFormPrompt(description, domain, fields);
    const system = 'You are an expert form designer for the ARIS animal resources information system. Generate valid JSON Schema forms.';

    const draft = await createDraft(user, 'FORM', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-campaign ──
  app.post(`${PREFIX}/suggest-campaign`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestCampaignBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { objective, domain, targetCountries, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const prompt = buildCampaignPrompt(objective, domain, targetCountries);
    const system = 'You are an expert in data collection campaign design for AU-IBAR. Generate structured campaign proposals with timeline, forms, and target assignments.';

    const draft = await createDraft(user, 'CAMPAIGN', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-indicator ──
  app.post(`${PREFIX}/suggest-indicator`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestIndicatorBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { name, description, domain, availableFields, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const prompt = buildIndicatorPrompt(name, description, domain, availableFields);
    const system = 'You are an expert in KPI and indicator design for animal resources. Generate indicator definitions with formulas, units, thresholds, and data sources.';

    const draft = await createDraft(user, 'INDICATOR', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-dashboard ──
  app.post(`${PREFIX}/suggest-dashboard`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestDashboardBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { purpose, domain, availableIndicators, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const prompt = buildDashboardPrompt(purpose, domain, availableIndicators);
    const system = 'You are an expert dashboard designer for the ARIS analytics platform. Generate dashboard layouts with widget placement, types (chart, map, table, KPI card), and data bindings.';

    const draft = await createDraft(user, 'DASHBOARD', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });
}

// ── Prompt Builders ──

function buildFormPrompt(description: string, domain?: string, fields?: string[]): string {
  let prompt = `Design a data collection form for: ${description}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (fields?.length) prompt += `\nRequired fields: ${fields.join(', ')}`;
  prompt += '\n\nRespond with JSON Schema format: { "title": "...", "type": "object", "properties": {...}, "required": [...] }';
  return prompt;
}

function buildCampaignPrompt(objective: string, domain?: string, countries?: string[]): string {
  let prompt = `Design a data collection campaign with objective: ${objective}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (countries?.length) prompt += `\nTarget countries: ${countries.join(', ')}`;
  prompt += '\n\nRespond with JSON: { "title": "...", "description": "...", "startDate": "...", "endDate": "...", "forms": [...], "assignments": [...], "frequency": "..." }';
  return prompt;
}

function buildIndicatorPrompt(name: string, description: string, domain?: string, fields?: string[]): string {
  let prompt = `Design a KPI indicator named "${name}": ${description}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (fields?.length) prompt += `\nAvailable data fields: ${fields.join(', ')}`;
  prompt += '\n\nRespond with JSON: { "name": "...", "formula": "...", "unit": "...", "frequency": "...", "thresholds": { "warning": ..., "critical": ... }, "dataSources": [...] }';
  return prompt;
}

function buildDashboardPrompt(purpose: string, domain?: string, indicators?: string[]): string {
  let prompt = `Design a dashboard layout for: ${purpose}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (indicators?.length) prompt += `\nAvailable indicators: ${indicators.join(', ')}`;
  prompt += '\n\nRespond with JSON: { "title": "...", "layout": { "columns": 12, "rows": [...] }, "widgets": [{ "type": "chart|map|table|kpi", "title": "...", "position": { "x": ..., "y": ..., "w": ..., "h": ... }, "dataSource": "..." }] }';
  return prompt;
}

// ── Kafka helper (fire-and-forget with timeout) ──

async function publishKafka(app: FastifyInstance, topic: string, payload: unknown): Promise<void> {
  try {
    await Promise.race([
      app.kafka.producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), 5000)),
    ]);
  } catch {
    app.log.warn(`Failed to publish to ${topic}`);
  }
}
