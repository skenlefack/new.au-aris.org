import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateInventorySchema,
  UpdateInventorySchema,
  InventoryFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateInventoryInput,
  type UpdateInventoryInput,
  type InventoryFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/inventory.schema.js';

export async function registerInventoryRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/wildlife/inventories — create inventory
  app.post<{ Body: CreateInventoryInput }>('/api/v1/wildlife/inventories', {
    schema: { body: CreateInventorySchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
    )],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.inventoryService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/wildlife/inventories — list inventories
  app.get<{ Querystring: PaginationQueryInput & InventoryFilterInput }>('/api/v1/wildlife/inventories', {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...InventoryFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...InventoryFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.inventoryService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/wildlife/inventories/:id — get inventory by ID
  app.get<{ Params: UuidParamInput }>('/api/v1/wildlife/inventories/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.inventoryService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/wildlife/inventories/:id — update inventory
  app.patch<{ Params: UuidParamInput; Body: UpdateInventoryInput }>('/api/v1/wildlife/inventories/:id', {
    schema: { params: UuidParamSchema, body: UpdateInventorySchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
    )],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.inventoryService.update(request.params.id, request.body, user);
  });
}
