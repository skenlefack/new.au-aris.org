import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { toCsv } from '../services/veille.service';

/** Configure sources and watchlists (continental watch team). */
const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];
/** Triage signals; REC and national users only see their countries. */
const TRIAGE_ROLES = [...MANAGE_ROLES, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD];
/** Read the published watch dataset. */
const DATASET_ROLES = [...TRIAGE_ROLES, UserRole.ANALYST, UserRole.DECISION_MAKER, UserRole.WAHIS_FOCAL_POINT, UserRole.PAID_ADMIN];

const BASE = '/api/v1/veille';

export async function registerVeilleRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();
  const manage = { preHandler: [auth, tenant, rolesHook(...MANAGE_ROLES)] };
  const triage = { preHandler: [auth, tenant, rolesHook(...TRIAGE_ROLES)] };
  const user = (req: { user?: unknown }) => req.user as AuthenticatedUser;

  /* Sources */
  app.get(`${BASE}/sources`, triage, async () => app.veilleService.listSources());
  app.post(`${BASE}/sources`, manage, async (req, reply) => reply.code(201).send(await app.veilleService.createSource(req.body ?? {}, user(req))));
  app.patch<{ Params: { id: string } }>(`${BASE}/sources/:id`, manage, async (req) => app.veilleService.updateSource(req.params.id, req.body ?? {}));
  app.delete<{ Params: { id: string } }>(`${BASE}/sources/:id`, manage, async (req) => app.veilleService.deleteSource(req.params.id));
  app.post<{ Params: { id: string } }>(`${BASE}/sources/:id/run`, manage, async (req) => ({ data: await app.scanner.runSource(req.params.id) }));

  /* Watchlists */
  app.get(`${BASE}/watchlists`, triage, async () => app.veilleService.listWatchLists());
  app.post(`${BASE}/watchlists`, manage, async (req, reply) => reply.code(201).send(await app.veilleService.createWatchList(req.body ?? {}, user(req))));
  app.patch<{ Params: { id: string } }>(`${BASE}/watchlists/:id`, manage, async (req) => app.veilleService.updateWatchList(req.params.id, req.body ?? {}));
  app.delete<{ Params: { id: string } }>(`${BASE}/watchlists/:id`, manage, async (req) => app.veilleService.deleteWatchList(req.params.id));

  /* Signals */
  app.get(`${BASE}/signals`, triage, async (req) => {
    const q = req.query as Record<string, string>;
    return app.veilleService.listSignals({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined }, user(req));
  });
  // rebuild groups and detected countries of untriaged signals after a rule change
  app.post(`${BASE}/signals/regroup`, manage, async () => app.veilleService.regroup());
  app.get<{ Params: { id: string } }>(`${BASE}/signals/:id`, triage, async (req) => app.veilleService.getSignal(req.params.id, user(req)));
  app.patch<{ Params: { id: string } }>(`${BASE}/signals/:id`, triage, async (req) => app.veilleService.reviewSignal(req.params.id, req.body ?? {}, user(req)));
  app.post<{ Params: { id: string } }>(`${BASE}/signals/:id/detach`, triage, async (req) => app.veilleService.detachSignal(req.params.id, user(req)));
  app.post<{ Params: { id: string } }>(`${BASE}/signals/:id/integrate`, triage, async (req) => app.veilleService.integrateSignal(req.params.id, req.body ?? {}, user(req)));
  app.post<{ Params: { id: string } }>(`${BASE}/signals/:id/ai`, manage, async (req) => {
    if (!app.ai.isEnabled) return { data: { queued: false, reason: 'AI enrichment is disabled' } };
    await app.ai.enrich(req.params.id);
    return app.veilleService.getSignal(req.params.id, user(req));
  });

  /* Statistics and published dataset */
  app.get(`${BASE}/stats`, triage, async (req) => app.veilleService.stats(user(req)));
  app.get(`${BASE}/dataset`, { preHandler: [auth, tenant, rolesHook(...DATASET_ROLES)] }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const u = user(req);
    const rows = await app.veilleService.dataset(q, u, TRIAGE_ROLES.includes(u.role));
    if (q.format === 'csv') {
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="aris-veille-signals.csv"')
        .send(toCsv(rows));
    }
    return { data: rows, meta: { total: rows.length } };
  });
}
