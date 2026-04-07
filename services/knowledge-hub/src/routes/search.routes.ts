import type { FastifyInstance } from 'fastify';
import { PublicSearchSchema, type PublicSearchInput } from '../schemas/knowledge.schema';

const PREFIX = '/api/v1/knowledge/search';

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  // Public Google-style search — no authentication required.
  // Returns only PUBLISHED + visibility=PUBLIC content.
  app.get<{ Querystring: PublicSearchInput }>(
    PREFIX,
    { schema: { querystring: PublicSearchSchema } },
    async (request) => {
      const result = await app.searchService.search(request.query);
      return { data: result };
    },
  );
}
