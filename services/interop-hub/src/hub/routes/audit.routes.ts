import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authAndTenant, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser } from '../helpers';

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /audit — List audit logs ──
  app.get('/api/v1/hub/audit', {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const entityType = qs(request, 'entity_type');
    const action = qs(request, 'action');
    const actorId = qs(request, 'actor_id');
    const dateFrom = qs(request, 'date_from');
    const dateTo = qs(request, 'date_to');

    if (entityType) where.entity_type = entityType;
    if (action) where.action = action;
    if (actorId) where.actor_id = actorId;
    if (dateFrom || dateTo) {
      where.created_at = {} as Record<string, Date>;
      if (dateFrom) (where.created_at as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.created_at as Record<string, Date>).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      app.prisma.hubAuditLog.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      app.prisma.hubAuditLog.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });
}
