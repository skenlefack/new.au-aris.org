/**
 * Fastify Tracing Plugin — ARIS 4.0
 *
 * Injects OpenTelemetry traceId and spanId into every Pino log entry
 * for log-trace correlation. Also adds the trace context to the request
 * object so route handlers can access it.
 *
 * Usage in app.ts:
 *   import { tracingPlugin } from '@aris/observability';
 *   app.register(tracingPlugin);
 */

import { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

declare module 'fastify' {
  interface FastifyRequest {
    traceId?: string;
    spanId?: string;
  }
}

const tracingPluginCallback: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts: Record<string, unknown>,
  done: (err?: Error) => void,
) => {
  // Add traceId/spanId to every request's log context (Pino child logger)
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      // Attach to request for handler access
      request.traceId = traceId;
      request.spanId = spanId;

      // Inject into Pino logger child bindings so every log line
      // from this request automatically includes traceId + spanId
      request.log = request.log.child({
        traceId,
        spanId,
        traceFlags: spanContext.traceFlags,
      });
    }
  });

  // On error, record exception on the active span
  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.recordException(error);
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
  });

  done();
};

export const tracingPlugin = fp(tracingPluginCallback, {
  fastify: '>=4.0.0',
  name: '@aris/observability-tracing',
});
