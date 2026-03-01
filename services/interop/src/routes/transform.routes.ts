import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';
import {
  TransformTestSchema,
  type TransformTestBody,
} from '../schemas/transaction.schemas.js';

export async function registerTransformRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // POST /api/v1/interop-v2/transform — test a JSONata expression
  app.post<{ Body: TransformTestBody }>('/api/v1/interop-v2/transform', {
    schema: { body: TransformTestSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    try {
      const result = await app.transformEngine.transform(request.body.data, request.body.expression);
      return { data: result };
    } catch (err) {
      return {
        statusCode: 400,
        message: `Transform error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}
