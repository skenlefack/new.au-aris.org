import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'PAID_ADMIN'] as const;
const PREFIX = '/api/v1/master-data/paid';

/**
 * PAID v2 reference data routes — full CRUD for 9 entity types with cascade filtering.
 * Data lives in animal_health.paid_* tables.
 *
 * Hierarchy: Project → LogFrame → Activity → SubActivity → PAID Activity → Breakdown Fields
 * Partners:  Project → Executive / Intl / National (filtered by country)
 */
export async function registerPaidRefRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const authAdmin = [app.authHookFn, tenantHook(), rolesHook(...ADMIN_ROLES)];
  const prisma = app.prisma as any;

  // ─── Generic paginated query helper ───

  interface PaginatedOpts {
    table: string;
    searchCols?: string[];
    filterCols?: Record<string, string>; // queryKey → dbColumn
    orderCol?: string;
  }

  async function paginated(opts: PaginatedOpts, query: Record<string, string | undefined>) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(query.limit ?? '100', 10)));
    const offset = (page - 1) * limit;
    const conditions: string[] = ['is_active = true'];
    const params: unknown[] = [];
    let idx = 1;

    if (query.search && opts.searchCols?.length) {
      const likeConds = opts.searchCols.map((c) => `COALESCE(${c},'')`  + ` ILIKE $${idx}`);
      conditions.push(`(${likeConds.join(' OR ')})`);
      params.push(`%${query.search}%`);
      idx++;
    }

    if (opts.filterCols) {
      for (const [qKey, dbCol] of Object.entries(opts.filterCols)) {
        if (query[qKey]) {
          // Special: countries[] is TEXT array — use ANY
          if (dbCol === 'countries') {
            conditions.push(`$${idx} = ANY(countries)`);
          } else {
            conditions.push(`${dbCol} = $${idx}`);
          }
          params.push(query[qKey]);
          idx++;
        }
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const order = opts.orderCol ?? 'code';

    const [data, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT * FROM animal_health.${opts.table} ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
        ...params,
      ),
      prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS total FROM animal_health.${opts.table} ${where}`,
        ...params,
      ),
    ]);

    return { data, meta: { total: (countResult as any[])[0]?.total ?? 0, page, limit } };
  }

  async function getById(table: string, id: number) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM animal_health.${table} WHERE id = $1`, id,
    );
    return rows[0] ?? null;
  }

  async function insertRow(table: string, cols: string[], vals: unknown[]) {
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO animal_health.${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async function updateRow(table: string, id: number, sets: Record<string, unknown>) {
    const entries = Object.entries(sets).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return getById(table, id);
    const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`);
    // Only paid_projects has updated_at column
    const updatedAtClause = table === 'paid_projects' ? ', updated_at = NOW()' : '';
    const params = [id, ...entries.map(([, v]) => v)];
    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE animal_health.${table} SET ${setClauses.join(', ')}${updatedAtClause} WHERE id = $1 RETURNING *`,
      ...params,
    );
    return rows[0] ?? null;
  }

  async function softDelete(table: string, id: number) {
    await prisma.$queryRawUnsafe(
      `UPDATE animal_health.${table} SET is_active = false WHERE id = $1`, id,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROJECTS
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/projects`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; type?: string; country?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_projects',
    searchCols: ['code', 'title'],
    filterCols: { type: 'type', country: 'countries' },
    orderCol: 'code',
  }, req.query as any));

  app.get(`${PREFIX}/projects/:id`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const row = await getById('paid_projects', parseInt(req.params.id));
    return row ? { data: row } : reply.code(404).send({ message: 'Not found' });
  });

  app.post(`${PREFIX}/projects`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { code: string; title: string; type?: string; countries?: string[] };
  }>) => {
    const b = req.body;
    const row = await insertRow('paid_projects',
      ['code', 'title', 'type', 'countries'],
      [b.code, b.title, b.type ?? 'single_country', b.countries ?? []],
    );
    return { data: row };
  });

  app.patch(`${PREFIX}/projects/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { code?: string; title?: string; type?: string; countries?: string[] };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.code !== undefined) sets.code = b.code;
    if (b.title !== undefined) sets.title = b.title;
    if (b.type !== undefined) sets.type = b.type;
    if (b.countries !== undefined) sets.countries = b.countries;
    const row = await updateRow('paid_projects', parseInt(req.params.id), sets);
    return { data: row };
  });

  app.delete(`${PREFIX}/projects/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => {
    await softDelete('paid_projects', parseInt(req.params.id));
    return { message: 'Deleted' };
  });

  // ═══════════════════════════════════════════════════════════════
  //  LOGFRAMES (filter by project)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/logframes`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; project?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_logframes',
    searchCols: ['code', 'label'],
    filterCols: { project: 'project_code' },
    orderCol: 'code',
  }, req.query as any));

  app.get(`${PREFIX}/logframes/:id`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const row = await getById('paid_logframes', parseInt(req.params.id));
    return row ? { data: row } : reply.code(404).send({ message: 'Not found' });
  });

  app.post(`${PREFIX}/logframes`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { code: string; project_code: string; label: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_logframes', ['code', 'project_code', 'label'], [b.code, b.project_code, b.label]) };
  });

  app.patch(`${PREFIX}/logframes/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { code?: string; project_code?: string; label?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.code !== undefined) sets.code = b.code;
    if (b.project_code !== undefined) sets.project_code = b.project_code;
    if (b.label !== undefined) sets.label = b.label;
    return { data: await updateRow('paid_logframes', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/logframes/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_logframes', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  LF ACTIVITIES (filter by logframe)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/lf-activities`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; logframe?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_lf_activities',
    searchCols: ['code', 'label'],
    filterCols: { logframe: 'logframe_code' },
    orderCol: 'code',
  }, req.query as any));

  app.get(`${PREFIX}/lf-activities/:id`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const row = await getById('paid_lf_activities', parseInt(req.params.id));
    return row ? { data: row } : reply.code(404).send({ message: 'Not found' });
  });

  app.post(`${PREFIX}/lf-activities`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { code: string; logframe_code: string; label: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_lf_activities', ['code', 'logframe_code', 'label'], [b.code, b.logframe_code, b.label]) };
  });

  app.patch(`${PREFIX}/lf-activities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { code?: string; logframe_code?: string; label?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.code !== undefined) sets.code = b.code;
    if (b.logframe_code !== undefined) sets.logframe_code = b.logframe_code;
    if (b.label !== undefined) sets.label = b.label;
    return { data: await updateRow('paid_lf_activities', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/lf-activities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_lf_activities', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  SUB-ACTIVITIES (filter by activity)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/subactivities`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; activity?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_subactivities',
    searchCols: ['code', 'label'],
    filterCols: { activity: 'activity_code' },
    orderCol: 'code',
  }, req.query as any));

  app.get(`${PREFIX}/subactivities/:id`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const row = await getById('paid_subactivities', parseInt(req.params.id));
    return row ? { data: row } : reply.code(404).send({ message: 'Not found' });
  });

  app.post(`${PREFIX}/subactivities`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { code: string; activity_code: string; label: string; unit_of_measure?: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_subactivities', ['code', 'activity_code', 'label', 'unit_of_measure'], [b.code, b.activity_code, b.label, b.unit_of_measure ?? null]) };
  });

  app.patch(`${PREFIX}/subactivities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { code?: string; activity_code?: string; label?: string; unit_of_measure?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.code !== undefined) sets.code = b.code;
    if (b.activity_code !== undefined) sets.activity_code = b.activity_code;
    if (b.label !== undefined) sets.label = b.label;
    if (b.unit_of_measure !== undefined) sets.unit_of_measure = b.unit_of_measure;
    return { data: await updateRow('paid_subactivities', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/subactivities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_subactivities', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  PAID ACTIVITIES (filter by subactivity)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/paid-activities`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; subactivity?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_paid_activities',
    searchCols: ['code', 'label'],
    filterCols: { subactivity: 'subactivity_code' },
    orderCol: 'code',
  }, req.query as any));

  app.get(`${PREFIX}/paid-activities/:id`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const row = await getById('paid_paid_activities', parseInt(req.params.id));
    return row ? { data: row } : reply.code(404).send({ message: 'Not found' });
  });

  app.post(`${PREFIX}/paid-activities`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { code: string; subactivity_code: string; label: string; unit_of_measure?: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_paid_activities', ['code', 'subactivity_code', 'label', 'unit_of_measure'], [b.code, b.subactivity_code, b.label, b.unit_of_measure ?? null]) };
  });

  app.patch(`${PREFIX}/paid-activities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { code?: string; subactivity_code?: string; label?: string; unit_of_measure?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.code !== undefined) sets.code = b.code;
    if (b.subactivity_code !== undefined) sets.subactivity_code = b.subactivity_code;
    if (b.label !== undefined) sets.label = b.label;
    if (b.unit_of_measure !== undefined) sets.unit_of_measure = b.unit_of_measure;
    return { data: await updateRow('paid_paid_activities', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/paid-activities/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_paid_activities', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  BREAKDOWN FIELDS (filter by paid_activity)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/breakdown-fields`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { paid_activity?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_breakdown_fields',
    searchCols: ['field_code', 'field_label'],
    filterCols: { paid_activity: 'paid_activity_code' },
    orderCol: 'sort_order',
  }, req.query as any));

  app.post(`${PREFIX}/breakdown-fields`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { paid_activity_code: string; field_code: string; field_label: string; field_type?: string; field_options?: unknown; sort_order?: number; is_required?: boolean };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_breakdown_fields',
      ['paid_activity_code', 'field_code', 'field_label', 'field_type', 'field_options', 'sort_order', 'is_required'],
      [b.paid_activity_code, b.field_code, b.field_label, b.field_type ?? 'number', b.field_options ? JSON.stringify(b.field_options) : null, b.sort_order ?? 0, b.is_required ?? false],
    ) };
  });

  app.patch(`${PREFIX}/breakdown-fields/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { field_code?: string; field_label?: string; field_type?: string; field_options?: unknown; sort_order?: number; is_required?: boolean };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.field_code !== undefined) sets.field_code = b.field_code;
    if (b.field_label !== undefined) sets.field_label = b.field_label;
    if (b.field_type !== undefined) sets.field_type = b.field_type;
    if (b.field_options !== undefined) sets.field_options = JSON.stringify(b.field_options);
    if (b.sort_order !== undefined) sets.sort_order = b.sort_order;
    if (b.is_required !== undefined) sets.is_required = b.is_required;
    return { data: await updateRow('paid_breakdown_fields', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/breakdown-fields/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_breakdown_fields', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  EXECUTIVE PARTNERS (filter by project)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/executive-partners`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; project?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_executive_partners',
    searchCols: ['name'],
    filterCols: { project: 'project_code' },
    orderCol: 'name',
  }, req.query as any));

  app.post(`${PREFIX}/executive-partners`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { project_code: string; name: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_executive_partners', ['project_code', 'name'], [b.project_code, b.name]) };
  });

  app.patch(`${PREFIX}/executive-partners/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { project_code?: string; name?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.project_code !== undefined) sets.project_code = b.project_code;
    if (b.name !== undefined) sets.name = b.name;
    return { data: await updateRow('paid_executive_partners', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/executive-partners/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_executive_partners', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  IMPLEMENTING PARTNERS INTERNATIONAL (filter by project)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/impl-partners-intl`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; project?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_impl_partners_intl',
    searchCols: ['name'],
    filterCols: { project: 'project_code' },
    orderCol: 'name',
  }, req.query as any));

  app.post(`${PREFIX}/impl-partners-intl`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { project_code: string; name: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_impl_partners_intl', ['project_code', 'name'], [b.project_code, b.name]) };
  });

  app.patch(`${PREFIX}/impl-partners-intl/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { project_code?: string; name?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.project_code !== undefined) sets.project_code = b.project_code;
    if (b.name !== undefined) sets.name = b.name;
    return { data: await updateRow('paid_impl_partners_intl', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/impl-partners-intl/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_impl_partners_intl', parseInt(req.params.id)); return { message: 'Deleted' }; });

  // ═══════════════════════════════════════════════════════════════
  //  IMPLEMENTING PARTNERS NATIONAL (filter by project + country)
  // ═══════════════════════════════════════════════════════════════

  app.get(`${PREFIX}/impl-partners-national`, { preHandler: authAndTenant }, async (req: FastifyRequest<{
    Querystring: { search?: string; project?: string; country?: string; page?: string; limit?: string };
  }>) => paginated({
    table: 'paid_impl_partners_national',
    searchCols: ['name'],
    filterCols: { project: 'project_code', country: 'country_code' },
    orderCol: 'name',
  }, req.query as any));

  app.post(`${PREFIX}/impl-partners-national`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Body: { project_code: string; country_code?: string; name: string };
  }>) => {
    const b = req.body;
    return { data: await insertRow('paid_impl_partners_national', ['project_code', 'country_code', 'name'], [b.project_code, b.country_code ?? null, b.name]) };
  });

  app.patch(`${PREFIX}/impl-partners-national/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string }; Body: { project_code?: string; country_code?: string; name?: string };
  }>) => {
    const b = req.body as any;
    const sets: Record<string, unknown> = {};
    if (b.project_code !== undefined) sets.project_code = b.project_code;
    if (b.country_code !== undefined) sets.country_code = b.country_code;
    if (b.name !== undefined) sets.name = b.name;
    return { data: await updateRow('paid_impl_partners_national', parseInt(req.params.id), sets) };
  });

  app.delete(`${PREFIX}/impl-partners-national/:id`, { preHandler: authAdmin }, async (req: FastifyRequest<{
    Params: { id: string };
  }>) => { await softDelete('paid_impl_partners_national', parseInt(req.params.id)); return { message: 'Deleted' }; });
}
