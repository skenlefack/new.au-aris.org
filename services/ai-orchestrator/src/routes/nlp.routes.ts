/**
 * Router 1: /api/v1/ai/nlp
 * NLP endpoints using Ollama LLM (Qwen / Phi-4).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const PREFIX = '/api/v1/ai/nlp';
const DEFAULT_MODEL = 'qwen2.5:32b';

interface ClassifyBody { text: string; categories: string[]; model?: string }
interface ExtractBody { text: string; entityTypes?: string[]; model?: string }
interface SummarizeBody { text: string; maxLength?: number; model?: string; language?: string }
interface TranslateBody { text: string; sourceLang: string; targetLang: string; model?: string }

export async function registerNlpRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /classify ──
  app.post(`${PREFIX}/classify`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ClassifyBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { text, categories, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const cacheKey = app.promptCache.buildKey(usedModel, text, `classify:${categories.join(',')}`);
    const cached = await app.promptCache.get<{ label: string; confidence: number }>(cacheKey);
    if (cached) {
      return reply.code(200).send({ data: { ...cached, cached: true } });
    }

    const start = Date.now();
    const prompt = `Classify the following text into exactly one of these categories: ${categories.join(', ')}.\n\nText: "${text}"\n\nRespond with JSON: { "label": "<category>", "confidence": <0-1> }`;

    const result = await app.ollamaClient.generate({ model: usedModel, prompt, format: 'json', temperature: 0.1 });

    let parsed: { label: string; confidence: number };
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { label: 'unknown', confidence: 0 };
    }

    await app.promptCache.set(cacheKey, parsed);
    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/classify`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: { ...parsed, cached: false } });
  });

  // ── POST /extract ──
  app.post(`${PREFIX}/extract`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ExtractBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { text, entityTypes, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const start = Date.now();
    const types = entityTypes?.length ? entityTypes.join(', ') : 'person, organization, location, date, disease, species';
    const prompt = `Extract named entities from the following text. Entity types to find: ${types}.\n\nText: "${text}"\n\nRespond with JSON: { "entities": [{ "text": "...", "type": "...", "confidence": 0.0-1.0 }] }`;

    const result = await app.ollamaClient.generate({ model: usedModel, prompt, format: 'json', temperature: 0.1 });

    let parsed: { entities: Array<{ text: string; type: string; confidence: number }> };
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { entities: [] };
    }

    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/extract`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: parsed });
  });

  // ── POST /summarize ──
  app.post(`${PREFIX}/summarize`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SummarizeBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { text, maxLength, model, language } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const cacheKey = app.promptCache.buildKey(usedModel, text, `summarize:${maxLength ?? 200}:${language ?? 'en'}`);
    const cached = await app.promptCache.get<{ summary: string }>(cacheKey);
    if (cached) {
      return reply.code(200).send({ data: { ...cached, cached: true } });
    }

    const start = Date.now();
    const lang = language ? ` in ${language}` : '';
    const prompt = `Summarize the following text${lang} in at most ${maxLength ?? 200} words.\n\nText: "${text}"\n\nRespond with JSON: { "summary": "..." }`;

    const result = await app.ollamaClient.generate({ model: usedModel, prompt, format: 'json', temperature: 0.3 });

    let parsed: { summary: string };
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { summary: result.output.trim() };
    }

    await app.promptCache.set(cacheKey, parsed);
    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/summarize`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: { ...parsed, cached: false } });
  });

  // ── POST /translate ──
  app.post(`${PREFIX}/translate`, {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: TranslateBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { text, sourceLang, targetLang, model } = request.body;
    const usedModel = model || DEFAULT_MODEL;

    const cacheKey = app.promptCache.buildKey(usedModel, text, `translate:${sourceLang}:${targetLang}`);
    const cached = await app.promptCache.get<{ translation: string }>(cacheKey);
    if (cached) {
      return reply.code(200).send({ data: { ...cached, cached: true } });
    }

    const start = Date.now();
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}.\n\nText: "${text}"\n\nRespond with JSON: { "translation": "..." }`;

    const result = await app.ollamaClient.generate({ model: usedModel, prompt, format: 'json', temperature: 0.2 });

    let parsed: { translation: string };
    try {
      parsed = JSON.parse(result.output);
    } catch {
      parsed = { translation: result.output.trim() };
    }

    await app.promptCache.set(cacheKey, parsed);
    await app.usageLogger.log({
      userId: user.userId, endpoint: `${PREFIX}/translate`, model: usedModel,
      tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
      durationMs: Date.now() - start, status: 'success', timestamp: Date.now(),
    });

    return reply.code(200).send({ data: { ...parsed, cached: false } });
  });
}
