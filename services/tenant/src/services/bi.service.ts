import type { PrismaClient } from '@prisma/client';

export class BiService {
  constructor(private prisma: PrismaClient) {}

  /* ── Tool Configs ── */

  async listTools() {
    const tools = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, tool, base_url as "baseUrl", display_name as "displayName",
             description, icon, status, embed_mode as "embedMode",
             sort_order as "sortOrder", is_active as "isActive",
             metadata, created_at as "createdAt", updated_at as "updatedAt"
      FROM governance.bi_tool_configs
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);
    return { data: tools };
  }

  async getToolByName(tool: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, tool, base_url as "baseUrl", display_name as "displayName",
             description, icon, status, embed_mode as "embedMode",
             sort_order as "sortOrder", is_active as "isActive",
             metadata, created_at as "createdAt", updated_at as "updatedAt"
      FROM governance.bi_tool_configs
      WHERE tool = $1
    `, tool);
    if (!rows.length) {
      const err = new Error(`BI tool '${tool}' not found`) as any;
      err.statusCode = 404;
      throw err;
    }
    return { data: rows[0] };
  }

  async getToolEmbedUrl(tool: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT base_url as "baseUrl", status, embed_mode as "embedMode"
      FROM governance.bi_tool_configs
      WHERE tool = $1 AND is_active = true
    `, tool);

    if (!rows.length || rows[0].status !== 'active') {
      return { data: { url: null, guestToken: null } };
    }

    const config = rows[0];
    let url = config.baseUrl;

    // Superset: add standalone query param for embedded mode
    if (tool === 'superset') {
      url = `${config.baseUrl}/superset/welcome/?standalone=true`;
    }

    return {
      data: {
        url,
        guestToken: null, // TODO: implement Superset Guest Token provisioning
      },
    };
  }

  /* ── Access Rules ── */

  async listAccessRules(toolName?: string) {
    let query = `
      SELECT r.id, r.bi_tool_config_id as "biToolConfigId",
             t.tool, r.role_level as "roleLevel",
             r.entity_type as "entityType", r.entity_id as "entityId",
             r.allowed_schemas as "allowedSchemas",
             r.allowed_tables as "allowedTables",
             r.excluded_tables as "excludedTables",
             r.data_filters as "dataFilters",
             r.can_create_dashboard as "canCreateDashboard",
             r.can_export_data as "canExportData",
             r.can_use_sql_lab as "canUseSqlLab",
             r.is_active as "isActive"
      FROM governance.bi_data_access_rules r
      JOIN governance.bi_tool_configs t ON t.id = r.bi_tool_config_id
    `;
    const params: any[] = [];

    if (toolName) {
      query += ` WHERE t.tool = $1`;
      params.push(toolName);
    }

    query += ` ORDER BY t.sort_order, r.role_level`;

    const rules = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return { data: rules };
  }

  async getAccessRulesForRole(role: string, toolName?: string) {
    let query = `
      SELECT r.id, r.bi_tool_config_id as "biToolConfigId",
             t.tool, r.role_level as "roleLevel",
             r.allowed_schemas as "allowedSchemas",
             r.allowed_tables as "allowedTables",
             r.excluded_tables as "excludedTables",
             r.data_filters as "dataFilters",
             r.can_create_dashboard as "canCreateDashboard",
             r.can_export_data as "canExportData",
             r.can_use_sql_lab as "canUseSqlLab"
      FROM governance.bi_data_access_rules r
      JOIN governance.bi_tool_configs t ON t.id = r.bi_tool_config_id
      WHERE r.role_level = $1 AND r.is_active = true
    `;
    const params: any[] = [role];

    if (toolName) {
      query += ` AND t.tool = $2`;
      params.push(toolName);
    }

    const rules = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return { data: rules };
  }

  async upsertAccessRule(data: {
    biToolConfigId: string;
    roleLevel: string;
    allowedSchemas: string[];
    allowedTables: string[];
    excludedTables: string[];
    canCreateDashboard: boolean;
    canExportData: boolean;
    canUseSqlLab: boolean;
    dataFilters?: Record<string, unknown>;
  }) {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO governance.bi_data_access_rules
        (id, bi_tool_config_id, role_level, allowed_schemas, allowed_tables,
         excluded_tables, data_filters, can_create_dashboard, can_export_data, can_use_sql_lab)
      VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9)
      ON CONFLICT (bi_tool_config_id, role_level, entity_type, entity_id) DO UPDATE SET
        allowed_schemas = EXCLUDED.allowed_schemas,
        allowed_tables = EXCLUDED.allowed_tables,
        excluded_tables = EXCLUDED.excluded_tables,
        data_filters = EXCLUDED.data_filters,
        can_create_dashboard = EXCLUDED.can_create_dashboard,
        can_export_data = EXCLUDED.can_export_data,
        can_use_sql_lab = EXCLUDED.can_use_sql_lab,
        updated_at = now()
      RETURNING id
    `,
      data.biToolConfigId,
      data.roleLevel,
      JSON.stringify(data.allowedSchemas),
      JSON.stringify(data.allowedTables),
      JSON.stringify(data.excludedTables),
      data.dataFilters ? JSON.stringify(data.dataFilters) : null,
      data.canCreateDashboard,
      data.canExportData,
      data.canUseSqlLab,
    );
    return { data: result[0] };
  }

  async deleteAccessRule(id: string) {
    await this.prisma.$queryRawUnsafe(`
      DELETE FROM governance.bi_data_access_rules WHERE id = $1::uuid
    `, id);
    return { data: { deleted: true } };
  }

  /* ── Dashboards ── */

  async listDashboards(toolName?: string) {
    let query = `
      SELECT d.id, d.bi_tool_config_id as "biToolConfigId",
             t.tool, d.external_id as "externalId",
             d.name, d.description, d.thumbnail,
             d.category, d.embed_url as "embedUrl",
             d.scope, d.allowed_roles as "allowedRoles",
             d.sort_order as "sortOrder",
             d.is_featured as "isFeatured",
             d.is_active as "isActive"
      FROM governance.bi_dashboards d
      JOIN governance.bi_tool_configs t ON t.id = d.bi_tool_config_id
      WHERE d.is_active = true
    `;
    const params: any[] = [];

    if (toolName) {
      query += ` AND t.tool = $1`;
      params.push(toolName);
    }

    query += ` ORDER BY d.is_featured DESC, d.sort_order ASC`;

    const dashboards = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return { data: dashboards };
  }

  async createDashboard(data: {
    biToolConfigId: string;
    externalId: string;
    name: Record<string, string>;
    description?: Record<string, string>;
    thumbnail?: string;
    category?: string;
    embedUrl: string;
    scope?: string;
    allowedRoles?: string[];
    sortOrder?: number;
    isFeatured?: boolean;
  }) {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO governance.bi_dashboards
        (id, bi_tool_config_id, external_id, name, description, thumbnail,
         category, embed_url, scope, allowed_roles, sort_order, is_featured)
      VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11)
      ON CONFLICT (bi_tool_config_id, external_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        embed_url = EXCLUDED.embed_url,
        updated_at = now()
      RETURNING id
    `,
      data.biToolConfigId,
      data.externalId,
      JSON.stringify(data.name),
      data.description ? JSON.stringify(data.description) : null,
      data.thumbnail ?? null,
      data.category ?? null,
      data.embedUrl,
      data.scope ?? 'global',
      JSON.stringify(data.allowedRoles ?? []),
      data.sortOrder ?? 0,
      data.isFeatured ?? false,
    );
    return { data: result[0] };
  }

  async deleteDashboard(id: string) {
    await this.prisma.$queryRawUnsafe(`
      DELETE FROM governance.bi_dashboards WHERE id = $1::uuid
    `, id);
    return { data: { deleted: true } };
  }
}
