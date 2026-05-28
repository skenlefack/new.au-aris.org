/**
 * ARIS 4.0 — AI Chat Routes
 * Multi-turn conversation with Ollama LLM, persisted per user.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// Sliding window: max messages to include in prompt
const MAX_CONTEXT_MESSAGES = 20;

const SYSTEM_PROMPT = `You are ARIS AI, the intelligent assistant for the African Union's Animal Resources Information System (ARIS 4.0).
You help AU-IBAR staff, national administrators, and data stewards with:
- Animal health surveillance and disease reporting (WAHIS, EMPRES)
- Livestock production statistics and trade data
- Fisheries, wildlife, apiculture, and climate data
- Data quality, campaign management, and workflow validation
- Dashboard creation and analytics interpretation
Answer in the user's language. Be concise, precise, and reference ARIS features when relevant.`;

interface ConversationBody {
  title?: string;
  model?: string;
}

interface MessageBody {
  content: string;
  fileIds?: string[];
}

interface ListQuery {
  page?: number;
  limit?: number;
}

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  const db = app.prisma;

  // ── Create conversation ───────────────────────────────────
  app.post('/api/v1/ai/chat/conversations', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: ConversationBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { title, model } = request.body || {};

    const conversation = await db.aiConversation.create({
      data: {
        userId: user.userId,
        title: title || 'New Conversation',
        model: model || 'qwen2.5:32b',
      },
    });

    return reply.code(201).send({ data: conversation });
  });

  // ── List conversations ────────────────────────────────────
  app.get('/api/v1/ai/chat/conversations', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      db.aiConversation.findMany({
        where: { userId: user.userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          model: true,
          messageCount: true,
          totalTokens: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.aiConversation.count({ where: { userId: user.userId } }),
    ]);

    return reply.send({
      data: conversations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── Get conversation with recent messages ─────────────────
  app.get('/api/v1/ai/chat/conversations/:id', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;

    const conversation = await db.aiConversation.findFirst({
      where: { id: request.params.id, userId: user.userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!conversation) {
      return reply.code(404).send({ statusCode: 404, message: 'Conversation not found' });
    }

    // Reverse to chronological order
    conversation.messages.reverse();

    return reply.send({ data: conversation });
  });

  // ── Get conversation messages (paginated) ─────────────────
  app.get('/api/v1/ai/chat/conversations/:id/messages', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Params: { id: string }; Querystring: ListQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Verify ownership
    const conv = await db.aiConversation.findFirst({
      where: { id: request.params.id, userId: user.userId },
      select: { id: true },
    });
    if (!conv) {
      return reply.code(404).send({ statusCode: 404, message: 'Conversation not found' });
    }

    const [messages, total] = await Promise.all([
      db.aiChatMessage.findMany({
        where: { conversationId: request.params.id },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      db.aiChatMessage.count({ where: { conversationId: request.params.id } }),
    ]);

    return reply.send({
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── Send message (user → AI → save both) ──────────────────
  app.post('/api/v1/ai/chat/conversations/:id/messages', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: MessageBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { content, fileIds } = request.body;

    if (!content?.trim()) {
      return reply.code(400).send({ statusCode: 400, message: 'Message content is required' });
    }

    // Verify ownership
    const conversation = await db.aiConversation.findFirst({
      where: { id: request.params.id, userId: user.userId },
    });
    if (!conversation) {
      return reply.code(404).send({ statusCode: 404, message: 'Conversation not found' });
    }

    // Load recent messages for context (sliding window)
    const recentMessages = await db.aiChatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTEXT_MESSAGES,
      select: { role: true, content: true },
    });
    recentMessages.reverse();

    // Build Ollama prompt with conversation history
    let fullPrompt = `<|system|>\n${SYSTEM_PROMPT}\n`;
    for (const msg of recentMessages) {
      const role = msg.role === 'USER' ? 'user' : 'assistant';
      fullPrompt += `<|${role}|>\n${msg.content}\n`;
    }
    fullPrompt += `<|user|>\n${content}\n<|assistant|>\n`;

    // Save user message
    const userMessage = await db.aiChatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: content.trim(),
        fileIds: fileIds || [],
      },
    });

    // Call Ollama
    const startMs = Date.now();
    let assistantContent: string;
    let tokensUsed = 0;

    try {
      const result = await app.ollamaClient.generate({
        model: conversation.model || 'qwen2.5:32b',
        prompt: fullPrompt,
        temperature: 0.7,
        maxTokens: 2048,
      });
      assistantContent = result.output;
      tokensUsed = (result.tokensInput || 0) + (result.tokensOutput || 0);
    } catch (err) {
      assistantContent = "I'm sorry, I'm temporarily unavailable. Please try again in a moment.";
      request.log.error(err, 'Ollama generation failed for chat');
    }

    const durationMs = Date.now() - startMs;

    // Save assistant message
    const assistantMessage = await db.aiChatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: assistantContent,
        model: conversation.model,
        tokensUsed,
        durationMs,
      },
    });

    // Update conversation counters + auto-title on first message
    const updateData: Record<string, unknown> = {
      messageCount: { increment: 2 },
      totalTokens: { increment: tokensUsed },
      updatedAt: new Date(),
    };

    if (conversation.messageCount === 0 && conversation.title === 'New Conversation') {
      // Auto-title from first user message
      updateData.title = content.trim().slice(0, 60) + (content.length > 60 ? '...' : '');
    }

    await db.aiConversation.update({
      where: { id: conversation.id },
      data: updateData,
    });

    // Log usage
    await app.usageLogger.log({
      userId: user.userId,
      endpoint: '/ai/chat/message',
      model: conversation.model || 'qwen2.5:32b',
      tokensInput: 0,
      tokensOutput: tokensUsed,
      durationMs,
      status: 'success',
    });

    return reply.code(201).send({
      data: {
        userMessage,
        assistantMessage,
      },
    });
  });

  // ── Delete conversation ───────────────────────────────────
  app.delete('/api/v1/ai/chat/conversations/:id', {
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;

    const conversation = await db.aiConversation.findFirst({
      where: { id: request.params.id, userId: user.userId },
      select: { id: true },
    });
    if (!conversation) {
      return reply.code(404).send({ statusCode: 404, message: 'Conversation not found' });
    }

    // Cascade deletes messages via onDelete: Cascade
    await db.aiConversation.delete({ where: { id: conversation.id } });

    return reply.code(204).send();
  });
}
