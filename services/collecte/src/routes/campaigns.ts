import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { CampaignService } from '../services/campaign.service';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  ListCampaignsQuerySchema,
  IdParamSchema,
} from '../schemas/campaign.schema';
import type {
  CreateCampaignBody,
  UpdateCampaignBody,
  ListCampaignsQuery,
  IdParam,
} from '../schemas/campaign.schema';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export default async function campaignRoutes(app: FastifyInstance): Promise<void> {
  const service = new CampaignService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/collecte/campaigns
  app.post<{ Body: CreateCampaignBody }>('/api/v1/collecte/campaigns', {
    schema: { body: CreateCampaignSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/collecte/campaigns
  app.get<{ Querystring: ListCampaignsQuery }>('/api/v1/collecte/campaigns', {
    schema: { querystring: ListCampaignsQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findAll(user, request.query);
  });

  // GET /api/v1/collecte/campaigns/:id
  app.get<{ Params: IdParam }>('/api/v1/collecte/campaigns/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.findOne(request.params.id, user);
  });

  // PATCH /api/v1/collecte/campaigns/:id
  app.patch<{ Params: IdParam; Body: UpdateCampaignBody }>('/api/v1/collecte/campaigns/:id', {
    schema: { params: IdParamSchema, body: UpdateCampaignSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.update(request.params.id, request.body, user);
  });

  // DELETE /api/v1/collecte/campaigns/:id (only PLANNED campaigns)
  app.delete<{ Params: IdParam }>('/api/v1/collecte/campaigns/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await service.delete(request.params.id, user);
    return reply.code(200).send(result);
  });
}
