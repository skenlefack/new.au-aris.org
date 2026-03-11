import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

interface BiUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
  tenantLevel?: string;
}

export class BiService {
  private redis: Redis | null;

  constructor(private prisma: PrismaClient, redis?: Redis) {
    this.redis = redis ?? null;
  }

  /* ═══════════════════════════════════════════
     Tool Configs
     ═══════════════════════════════════════════ */

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

  async getToolEmbedUrl(tool: string, user?: BiUser) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT base_url as "baseUrl", status, embed_mode as "embedMode"
      FROM governance.bi_tool_configs
      WHERE tool = $1 AND is_active = true
    `, tool);

    if (!rows.length || rows[0].status !== 'active') {
      return { data: { url: null, guestToken: null } };
    }

    const config = rows[0];

    // Superset: use embedded SDK (frontend handles guest token separately)
    if (tool === 'superset') {
      return {
        data: {
          url: `${config.baseUrl}/superset/welcome/?standalone=true`,
          guestToken: null,
        },
      };
    }

    // Grafana: build URL with tenant variables via proxy
    if (tool === 'grafana' && user) {
      const url = await this.getGrafanaEmbedUrl(user);
      return { data: { url, guestToken: null } };
    }

    return { data: { url: config.baseUrl, guestToken: null } };
  }

  /* ═══════════════════════════════════════════
     Tenant Resolution (shared across BI tools)
     ═══════════════════════════════════════════ */

  async resolveTenantIds(user: BiUser): Promise<string[]> {
    const level = user.tenantLevel ?? await this.getTenantLevel(user.tenantId);

    // Continental sees everything — no filter
    if (level === 'CONTINENTAL') return [];

    // Check cache
    const cacheKey = `aris:bi:tenant-children:${user.tenantId}`;
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    let ids: string[];

    if (level === 'REC') {
      // REC sees itself + all member state children
      const children = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
        SELECT id::text FROM tenant.tenants WHERE parent_id = $1::uuid
      `, user.tenantId);
      ids = [user.tenantId, ...children.map((c) => c.id)];
    } else {
      // MEMBER_STATE sees only itself
      ids = [user.tenantId];
    }

    // Cache for 5 minutes
    if (this.redis) {
      await this.redis.set(cacheKey, JSON.stringify(ids), 'EX', 300);
    }

    return ids;
  }

  private async getTenantLevel(tenantId: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ level: string }[]>(`
      SELECT level FROM tenant.tenants WHERE id = $1::uuid
    `, tenantId);
    return rows[0]?.level ?? 'MEMBER_STATE';
  }

  /* ═══════════════════════════════════════════
     Superset — Guest Token API
     ═══════════════════════════════════════════ */

  private async getSupersetAdminSession(): Promise<string> {
    // Check cache first
    const cacheKey = 'aris:bi:superset:admin-session';
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;
    }

    const supersetUrl = process.env['SUPERSET_INTERNAL_URL'] ?? 'http://localhost:8088';
    const username = process.env['SUPERSET_ADMIN_USERNAME'] ?? 'admin';
    const password = process.env['SUPERSET_ADMIN_PASSWORD'] ?? 'ArisSuperset2024!';

    const res = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        provider: 'db',
        refresh: true,
      }),
    });

    if (!res.ok) {
      throw Object.assign(new Error('Superset admin login failed'), { statusCode: 502 });
    }

    const body = await res.json() as { access_token: string };
    const token = body.access_token;

    // Cache for 30 minutes
    if (this.redis) {
      await this.redis.set(cacheKey, token, 'EX', 1800);
    }

    return token;
  }

  async getSupersetGuestToken(user: BiUser, dashboardId: string): Promise<string> {
    const adminToken = await this.getSupersetAdminSession();
    const tenantIds = await this.resolveTenantIds(user);
    const supersetUrl = process.env['SUPERSET_INTERNAL_URL'] ?? 'http://localhost:8088';

    // Build RLS clause
    const rls: { clause: string }[] = [];
    if (tenantIds.length > 0) {
      const inList = tenantIds.map((id) => `'${id}'`).join(',');
      rls.push({ clause: `tenant_id IN (${inList})` });
    }
    // Continental (tenantIds empty) → no RLS filter, sees everything

    const res = await fetch(`${supersetUrl}/api/v1/security/guest_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user: {
          username: user.email,
          first_name: user.firstName ?? 'ARIS',
          last_name: user.lastName ?? 'User',
        },
        resources: [{ type: 'dashboard', id: dashboardId }],
        rls,
      }),
    });

    if (!res.ok) {
      // If admin session expired, clear cache and retry once
      if (res.status === 401 && this.redis) {
        await this.redis.del('aris:bi:superset:admin-session');
        return this.getSupersetGuestToken(user, dashboardId);
      }
      const errBody = await res.text();
      throw Object.assign(
        new Error(`Superset guest token failed: ${res.status} ${errBody}`),
        { statusCode: 502 },
      );
    }

    const body = await res.json() as { token: string };
    return body.token;
  }

  /* ═══════════════════════════════════════════
     Grafana — Embed URL with tenant variables
     ═══════════════════════════════════════════ */

  async getGrafanaEmbedUrl(user: BiUser, dashboardUid?: string): Promise<string> {
    const tenantIds = await this.resolveTenantIds(user);

    let path = dashboardUid ? `/d/${dashboardUid}` : '/';

    const params = new URLSearchParams();
    params.set('kiosk', '');

    if (tenantIds.length === 0) {
      // Continental — wildcard
      params.set('var-tenant_id', '*');
    } else {
      for (const id of tenantIds) {
        params.append('var-tenant_id', id);
      }
    }

    return `/api/bi-proxy/grafana${path}?${params.toString()}`;
  }

  /* ═══════════════════════════════════════════
     Metabase — Session Proxy
     ═══════════════════════════════════════════ */

  private async getMetabaseAdminSession(): Promise<string> {
    const cacheKey = 'aris:bi:metabase:admin-session';
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;
    }

    const metabaseUrl = process.env['METABASE_INTERNAL_URL'] ?? 'http://localhost:3035';
    const email = process.env['METABASE_ADMIN_EMAIL'] ?? 'admin@au-aris.org';
    const password = process.env['METABASE_ADMIN_PASSWORD'] ?? 'ArisMetabase2024!';

    const res = await fetch(`${metabaseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });

    if (!res.ok) {
      throw Object.assign(new Error('Metabase admin login failed'), { statusCode: 502 });
    }

    const body = await res.json() as { id: string };
    const sessionId = body.id;

    // Cache for 30 minutes
    if (this.redis) {
      await this.redis.set(cacheKey, sessionId, 'EX', 1800);
    }

    return sessionId;
  }

  async getMetabaseSession(user: BiUser): Promise<string> {
    const metabaseUrl = process.env['METABASE_INTERNAL_URL'] ?? 'http://localhost:3035';
    const adminSession = await this.getMetabaseAdminSession();

    // Check if user exists in Metabase
    const usersRes = await fetch(`${metabaseUrl}/api/user`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': adminSession,
      },
    });

    let userExists = false;
    if (usersRes.ok) {
      const usersBody = await usersRes.json() as { data?: { email: string }[] };
      const users = usersBody.data ?? usersBody as any;
      if (Array.isArray(users)) {
        userExists = users.some((u: any) => u.email === user.email);
      }
    }

    // Generate a deterministic password for this user (they never need to know it)
    const userPassword = `Aris_${Buffer.from(user.userId).toString('base64').slice(0, 16)}!1A`;

    if (!userExists) {
      // Create user in Metabase
      const createRes = await fetch(`${metabaseUrl}/api/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Metabase-Session': adminSession,
        },
        body: JSON.stringify({
          email: user.email,
          first_name: user.firstName ?? 'ARIS',
          last_name: user.lastName ?? 'User',
          password: userPassword,
        }),
      });

      if (!createRes.ok) {
        // User may already exist (race condition), try to proceed
        const errText = await createRes.text();
        if (!errText.includes('already exists')) {
          throw Object.assign(
            new Error(`Metabase user creation failed: ${errText}`),
            { statusCode: 502 },
          );
        }
      }
    }

    // Create a session for this user
    const sessionRes = await fetch(`${metabaseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.email,
        password: userPassword,
      }),
    });

    if (!sessionRes.ok) {
      // If login fails, use admin session as fallback
      return adminSession;
    }

    const sessionBody = await sessionRes.json() as { id: string };
    return sessionBody.id;
  }

  /* ═══════════════════════════════════════════
     Access Rules
     ═══════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════
     Dashboards
     ═══════════════════════════════════════════ */

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
