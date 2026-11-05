import type { FastifyInstance } from 'fastify';

/**
 * Replaces the JSON body parser with one that behaves like Fastify's default
 * (prototype-poisoning protection, empty-body handling) and also keeps the raw
 * body on `request.rawBody`, needed to verify webhook HMAC signatures.
 */
export function registerRawJsonParser(app: FastifyInstance): void {
  const defaultJsonParser = app.getDefaultJsonParser('error', 'ignore');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    (request as any).rawBody = body as string;
    defaultJsonParser(request, body as string, done);
  });
}
