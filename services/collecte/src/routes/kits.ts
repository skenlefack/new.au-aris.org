import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { KitService, type DecisionInput, type ShipmentInput, type ReceptionInput } from '../services/kits/kit.service';

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const text = (max: number) => ({ type: 'string', maxLength: max }) as const;

/** PANVAC kit requests: tracking list, PANVAC decision and shipments, reception by the requesting country. */
export default async function kitRoutes(app: FastifyInstance): Promise<void> {
  const kits = new KitService(app.prisma);
  const auth = app.authHookFn;
  const tenant = tenantHook();
  const user = (r: { user?: unknown }) => r.user as AuthenticatedUser;

  // GET /api/v1/collecte/campaigns/:id/kit-requests — requests visible to the user, with shipments, timeline and metrics
  app.get<{ Params: { id: string } }>('/api/v1/collecte/campaigns/:id/kit-requests', {
    schema: { params: idParams },
    preHandler: [auth, tenant],
  }, async (request) => kits.list(user(request), request.params.id));

  // POST /api/v1/collecte/kit-requests/:id/decision — PANVAC approves (quantity + availability period) or rejects
  app.post<{ Params: { id: string }; Body: DecisionInput }>('/api/v1/collecte/kit-requests/:id/decision', {
    schema: {
      params: idParams,
      body: {
        type: 'object', required: ['decision'], additionalProperties: false,
        properties: {
          decision: { type: 'string', enum: ['APPROVE', 'REJECT'] },
          quantityApproved: { type: 'integer', minimum: 1, maximum: 100000 },
          availableFrom: date, availableTo: date, comment: text(1000),
        },
      },
    },
    preHandler: [auth, tenant],
  }, async (request) => kits.decide(user(request), request.params.id, request.body));

  // POST /api/v1/collecte/kit-requests/:id/shipments — PANVAC records a shipment
  app.post<{ Params: { id: string }; Body: ShipmentInput }>('/api/v1/collecte/kit-requests/:id/shipments', {
    schema: {
      params: idParams,
      body: {
        type: 'object', required: ['shippedAt', 'quantity'], additionalProperties: false,
        properties: {
          shippedAt: date, quantity: { type: 'integer', minimum: 1, maximum: 100000 },
          kitFormat: text(20), numSamples: { type: 'integer', minimum: 0 }, lotNumber: text(100), expiryDate: date,
          waybill: text(100), carrier: text(100), comment: text(1000),
        },
      },
    },
    preHandler: [auth, tenant],
  }, async (request, reply) => reply.code(201).send(await kits.addShipment(user(request), request.params.id, request.body)));

  // DELETE /api/v1/collecte/kit-shipments/:id — PANVAC removes a shipment entered by mistake (not yet received)
  app.delete<{ Params: { id: string } }>('/api/v1/collecte/kit-shipments/:id', {
    schema: { params: idParams },
    preHandler: [auth, tenant],
  }, async (request) => kits.deleteShipment(user(request), request.params.id));

  // POST /api/v1/collecte/kit-shipments/:id/reception — the requesting country confirms reception
  app.post<{ Params: { id: string }; Body: ReceptionInput }>('/api/v1/collecte/kit-shipments/:id/reception', {
    schema: {
      params: idParams,
      body: {
        type: 'object', required: ['receivedAt', 'quantityReceived', 'condition'], additionalProperties: false,
        properties: {
          receivedAt: date, quantityReceived: { type: 'integer', minimum: 0 },
          condition: { type: 'string', enum: ['GOOD', 'DAMAGED', 'INCOMPLETE'] }, comment: text(1000),
        },
      },
    },
    preHandler: [auth, tenant],
  }, async (request) => kits.confirmReception(user(request), request.params.id, request.body));

  // POST /api/v1/collecte/kit-requests/:id/cancel — the requesting country withdraws a request not yet decided
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/api/v1/collecte/kit-requests/:id/cancel', {
    schema: { params: idParams, body: { type: 'object', additionalProperties: false, properties: { reason: text(500) } } },
    preHandler: [auth, tenant],
  }, async (request) => kits.cancel(user(request), request.params.id, request.body?.reason));
}
