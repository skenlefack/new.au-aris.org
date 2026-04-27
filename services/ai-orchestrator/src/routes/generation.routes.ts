/**
 * Router 2: /api/v1/ai/generation
 * AI-assisted generation of forms, campaigns, indicators, dashboards.
 * Each returns an AiGenerationDraft with status: 'DRAFT'.
 *
 * Uses phi4:14b by default for generation (faster on CPU than 32b models).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_AI_GENERATION_COMPLETED,
  TOPIC_AI_GENERATION_FAILED,
} from '@aris/shared-types';

const PREFIX = '/api/v1/ai/generation';
// phi4:14b is ~3x faster than qwen2.5:32b on CPU — good enough for JSON generation
const DEFAULT_MODEL = process.env.AI_GENERATION_MODEL || 'phi4:14b';

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

interface GenerationBody {
  // The frontend always sends { prompt, context }
  prompt?: string;
  context?: Record<string, unknown>;
  // Backend-specific fields (optional, for direct API use)
  description?: string;
  purpose?: string;
  objective?: string;
  name?: string;
  domain?: string;
  fields?: string[];
  availableFields?: string[];
  availableIndicators?: string[];
  targetCountries?: string[];
  model?: string;
}

export async function registerGenerationRoutes(app: FastifyInstance): Promise<void> {

  /** Extract the user's text from the various possible fields */
  function extractText(body: GenerationBody): string {
    return body.prompt || body.description || body.purpose || body.objective || '';
  }

  /** Extract domain from body or context */
  function extractDomain(body: GenerationBody): string | undefined {
    return body.domain
      || (body.context?.domainCode as string)
      || (body.context?.domain as string)
      || undefined;
  }

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
        temperature: 0.3,
        maxTokens: 2048, // limit output for speed
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
  }, async (request: FastifyRequest<{ Body: GenerationBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body;
    const usedModel = body.model || DEFAULT_MODEL;
    const domain = extractDomain(body);

    const prompt = buildFormPrompt(extractText(body), domain, body.fields);
    const system = 'You are an expert form designer for ARIS (Animal Resources Information System, AU-IBAR). Generate valid JSON Schema forms relevant to African animal resources. Be concise.';

    const draft = await createDraft(user, 'FORM', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-campaign ──
  app.post(`${PREFIX}/suggest-campaign`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: GenerationBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body;
    const usedModel = body.model || DEFAULT_MODEL;
    const domain = extractDomain(body);

    const prompt = buildCampaignPrompt(extractText(body), domain, body.targetCountries);
    const system = 'You are an expert in data collection campaign design for AU-IBAR. Generate structured campaign proposals. Be concise.';

    const draft = await createDraft(user, 'CAMPAIGN', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-indicator ──
  app.post(`${PREFIX}/suggest-indicator`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: GenerationBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body;
    const usedModel = body.model || DEFAULT_MODEL;
    const domain = extractDomain(body);

    const prompt = buildIndicatorPrompt(body.name || '', extractText(body), domain, body.availableFields);
    const system = 'You are an expert in KPI and indicator design for animal resources. Generate indicator definitions. Be concise.';

    const draft = await createDraft(user, 'INDICATOR', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });

  // ── POST /suggest-dashboard ──
  app.post(`${PREFIX}/suggest-dashboard`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: GenerationBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const body = request.body;
    const usedModel = body.model || DEFAULT_MODEL;
    const domain = extractDomain(body);

    const prompt = buildDashboardPrompt(extractText(body), domain, body.availableIndicators);
    const system = DASHBOARD_SYSTEM_PROMPT;

    const draft = await createDraft(user, 'DASHBOARD', prompt, system, usedModel);
    return reply.code(200).send({ data: draft });
  });
}

// ── Prompt Builders ──

function buildFormPrompt(description: string, domain?: string, fields?: string[]): string {
  let prompt = `Design a data collection form for: ${description}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (fields?.length) prompt += `\nRequired fields: ${fields.join(', ')}`;
  prompt += '\n\nRespond with JSON: { "title": "...", "type": "object", "properties": {...}, "required": [...] }';
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
  let prompt = name ? `Design a KPI indicator named "${name}": ${description}` : `Design a KPI indicator: ${description}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (fields?.length) prompt += `\nAvailable data fields: ${fields.join(', ')}`;
  prompt += '\n\nRespond with JSON: { "name": "...", "formula": "...", "unit": "...", "frequency": "...", "thresholds": { "warning": ..., "critical": ... }, "dataSources": [...] }';
  return prompt;
}

const WIDGET_TYPES = 'KPI_CARD, BAR_CHART, LINE_CHART, PIE_CHART, TABLE, MAP, GAUGE';

const DASHBOARD_SYSTEM_PROMPT = `You are an expert dashboard designer for ARIS (Animal Resources Information System, AU-IBAR).
Generate dashboard layouts for African animal resources data.
Use ONLY these widget types: ${WIDGET_TYPES}.
Be concise. Return valid JSON only.`;

function buildDashboardPrompt(purpose: string, domain?: string, indicators?: string[]): string {
  let prompt = `Design a dashboard: ${purpose}`;
  if (domain) prompt += `\nDomain: ${domain}`;
  if (indicators?.length) prompt += `\nAvailable indicators: ${indicators.join(', ')}`;
  prompt += `\n\nWidget types allowed: ${WIDGET_TYPES}`;
  prompt += '\n\nRespond with JSON: { "title": "...", "widgets": [{ "type": "KPI_CARD|BAR_CHART|LINE_CHART|PIE_CHART|TABLE|MAP|GAUGE", "title": "...", "dataSource": "..." }] }';
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
