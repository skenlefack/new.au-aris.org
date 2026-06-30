// React Query hooks for the Dashboard Builder.
//
// Wraps the analytics service (services/analytics, port 3030) endpoints
// for custom dashboard CRUD, widget management, sharing, and preferences.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsClient } from './client';

// ─── Widget type mapping (backend ↔ frontend) ──────────────────────────────
// Backend (Prisma/DB) uses LINE_CHART, BAR_CHART etc.
// Frontend uses shorter names: LINE, BAR, etc.
const BACKEND_TO_FRONTEND_TYPE: Record<string, WidgetType> = {
  LINE_CHART: 'LINE',
  BAR_CHART: 'BAR',
  PIE_CHART: 'PIE',
  AREA_CHART: 'AREA',
  MAP_AFRICA: 'MAP',
  IFRAME_BI: 'IFRAME',
  HEATMAP: 'HEATMAP',
  COMPOSITE_FORMULA: 'KPI_CARD', // fallback: render composites as KPI
  // These match 1:1 already:
  KPI_CARD: 'KPI_CARD',
  STACKED_BAR: 'STACKED_BAR',
  TABLE: 'TABLE',
  GAUGE: 'GAUGE',
  TEXT_BLOCK: 'TEXT_BLOCK',
  ALERT_FEED: 'ALERT_FEED',
  PROGRESS_BAR: 'PROGRESS_BAR',
  STAT_CARD: 'STAT_CARD',
  DIVIDER: 'DIVIDER',
  IMAGE: 'IMAGE',
  LIST: 'LIST',
  RANKED_LIST: 'RANKED_LIST',
  ACTIVITY_FEED: 'ACTIVITY_FEED',
  EPI_CURVE: 'EPI_CURVE',
  DUAL_AXIS: 'DUAL_AXIS',
  COUNTER: 'COUNTER',
};

const FRONTEND_TO_BACKEND_TYPE: Record<string, string> = {
  LINE: 'LINE_CHART',
  BAR: 'BAR_CHART',
  PIE: 'PIE_CHART',
  AREA: 'AREA_CHART',
  MAP: 'MAP_AFRICA',
  IFRAME: 'IFRAME_BI',
  // These match 1:1:
  KPI_CARD: 'KPI_CARD',
  STACKED_BAR: 'STACKED_BAR',
  TABLE: 'TABLE',
  GAUGE: 'GAUGE',
  TEXT_BLOCK: 'TEXT_BLOCK',
  ALERT_FEED: 'ALERT_FEED',
  PROGRESS_BAR: 'PROGRESS_BAR',
  STAT_CARD: 'STAT_CARD',
  DIVIDER: 'DIVIDER',
  IMAGE: 'IMAGE',
  LIST: 'LIST',
  HEATMAP: 'HEATMAP',
  RANKED_LIST: 'RANKED_LIST',
  ACTIVITY_FEED: 'ACTIVITY_FEED',
  EPI_CURVE: 'EPI_CURVE',
  DUAL_AXIS: 'DUAL_AXIS',
  COUNTER: 'COUNTER',
};

function toFrontendType(backendType: string): WidgetType {
  return BACKEND_TO_FRONTEND_TYPE[backendType] ?? (backendType as WidgetType);
}

function toBackendType(frontendType: string): string {
  return FRONTEND_TO_BACKEND_TYPE[frontendType] ?? frontendType;
}

/** Pick the best title for the current locale, with FR→EN fallback chain. */
function pickTitle(obj: any, locale: string): string {
  switch (locale) {
    case 'ar': return obj.title_ar || obj.titleAr || obj.title_fr || obj.titleFr || obj.title_en || obj.titleEn || '';
    case 'pt': return obj.title_pt || obj.titlePt || obj.title_fr || obj.titleFr || obj.title_en || obj.titleEn || '';
    case 'en': return obj.title_en || obj.titleEn || obj.title_fr || obj.titleFr || '';
    default:   return obj.title_fr || obj.titleFr || obj.title_en || obj.titleEn || '';
  }
}

/** Resolve the current locale from the persisted zustand store (non-hook). */
function getCurrentLocale(): string {
  try {
    const raw = typeof window !== 'undefined' && localStorage.getItem('aris-locale');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.locale ?? 'fr';
    }
  } catch { /* ignore */ }
  return 'fr';
}

/** Map flat grid_x/grid_y/grid_w/grid_h from backend to layout object expected by frontend */
function mapWidgetLayout(w: any): any {
  const locale = getCurrentLocale();
  if (w.layout) {
    // Still map the type even if layout is already mapped
    return w.type ? { ...w, type: toFrontendType(w.type), title: pickTitle(w, locale) } : w;
  }
  return {
    ...w,
    type: toFrontendType(w.type ?? 'KPI_CARD'),
    title: pickTitle(w, locale),
    titleFr: w.title_fr ?? w.titleFr ?? '',
    titleEn: w.title_en ?? w.titleEn ?? '',
    titleAr: w.title_ar ?? w.titleAr ?? null,
    titlePt: w.title_pt ?? w.titlePt ?? null,
    sectionId: w.section_id ?? w.sectionId ?? null,
    columnIndex: w.column_index ?? w.columnIndex ?? 0,
    sortOrder: w.sort_order ?? w.sortOrder ?? 0,
    layout: {
      x: w.grid_x ?? w.gridX ?? 0,
      y: w.grid_y ?? w.gridY ?? 0,
      w: w.grid_w ?? w.gridW ?? 3,
      h: w.grid_h ?? w.gridH ?? 2,
      minW: 2,
      minH: 2,
    },
  };
}

/** Map backend section data with nested widgets */
function mapSectionWidgets(sec: any): DashboardSection {
  const locale = getCurrentLocale();
  const widgets = (sec.widgets || []).map(mapWidgetLayout);
  const title = pickTitle(sec, locale);
  return {
    id: sec.id,
    dashboardId: sec.dashboard_id || sec.dashboardId,
    title,
    titleFr: sec.title_fr ?? sec.titleFr ?? '',
    titleEn: sec.title_en ?? sec.titleEn ?? '',
    titleAr: sec.title_ar ?? sec.titleAr ?? null,
    titlePt: sec.title_pt ?? sec.titlePt ?? null,
    columnCount: sec.column_count ?? sec.columnCount ?? 2,
    sortOrder: sec.sort_order ?? sec.sortOrder ?? 0,
    isCollapsed: sec.is_collapsed ?? sec.isCollapsed ?? false,
    config: sec.config ?? {},
    widgets,
  };
}

function mapDashboardWidgets(data: any): any {
  if (!data) return data;
  const d = data.data ?? data;

  // Map sections with nested widgets
  if (d.sections && Array.isArray(d.sections)) {
    d.sections = d.sections.map(mapSectionWidgets);
  }

  // Map orphan widgets (backward compat — widgets without section)
  if (d.widgets && Array.isArray(d.widgets)) {
    d.widgets = d.widgets.map(mapWidgetLayout);
  }

  // Map dashboard title — locale-aware
  const locale = getCurrentLocale();
  d.title = pickTitle(d, locale);
  d.titleFr = d.title_fr || d.titleFr || d.title || '';
  d.titleEn = d.title_en || d.titleEn || d.title || '';

  // Backward compat: if no sections exist, create a synthetic one from flat widgets
  if ((!d.sections || d.sections.length === 0) && d.widgets && d.widgets.length > 0) {
    d.sections = [{
      id: 'default-section',
      dashboardId: d.id,
      titleFr: 'Section principale',
      titleEn: 'Main Section',
      titleAr: null,
      titlePt: null,
      columnCount: 1,
      sortOrder: 0,
      isCollapsed: false,
      config: {},
      widgets: d.widgets,
    }];
  }

  return data;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardScope = 'CONTINENTAL' | 'REC' | 'COUNTRY' | 'PERSONAL';
export type DashboardOwnership = 'USER_OWNED' | 'SHARED' | 'SYSTEM_TEMPLATE';
export type WidgetType =
  | 'KPI_CARD'
  | 'LINE'
  | 'BAR'
  | 'PIE'
  | 'STACKED_BAR'
  | 'AREA'
  | 'MAP'
  | 'TABLE'
  | 'GAUGE'
  | 'TEXT_BLOCK'
  | 'ALERT_FEED'
  | 'STAT_CARD'
  | 'PROGRESS_BAR'
  | 'DIVIDER'
  | 'IMAGE'
  | 'IFRAME'
  | 'LIST'
  | 'HEATMAP'
  | 'RANKED_LIST'
  | 'ACTIVITY_FEED'
  | 'EPI_CURVE'
  | 'DUAL_AXIS'
  | 'COUNTER';

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  dataSource?: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  sectionId?: string;
  columnIndex: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSection {
  id: string;
  dashboardId: string;
  title?: string;
  titleFr: string;
  titleEn: string;
  titleAr?: string | null;
  titlePt?: string | null;
  columnCount: number;
  sortOrder: number;
  isCollapsed: boolean;
  config: Record<string, unknown>;
  widgets: DashboardWidget[];
}

export interface Dashboard {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  scope: DashboardScope;
  domainCode?: string;
  ownerId: string;
  isDefault: boolean;
  isTemplate: boolean;
  tags?: string[];
  sections: DashboardSection[];
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardListItem {
  id: string;
  title: string;
  description?: string;
  scope: DashboardScope;
  domainCode?: string;
  campaignId?: string;
  ownerId: string;
  isDefault: boolean;
  isTemplate: boolean;
  tags?: string[];
  widgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardRenderData {
  dashboard: Dashboard;
  widgetData: Record<string, unknown>; // widgetId -> rendered data
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

// ─── Query keys ─────────────────────────────────────────────────────────────

const KEYS = {
  all: ['dashboards'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (params: Record<string, string | undefined>) =>
    [...KEYS.lists(), params] as const,
  details: () => [...KEYS.all, 'detail'] as const,
  detail: (id: string) => [...KEYS.details(), id] as const,
  render: (id: string) => [...KEYS.all, 'render', id] as const,
  default: (scope: string, target: string) =>
    [...KEYS.all, 'default', scope, target] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useDashboards(params?: {
  scope?: DashboardScope;
  domainCode?: string;
  recCode?: string;
  countryCode?: string;
  campaignId?: string;
  ownership?: DashboardOwnership;
  page?: number;
  limit?: number;
}) {
  const qp: Record<string, string> = {};
  if (params?.scope) qp.scope = params.scope;
  if (params?.domainCode) qp.domainCode = params.domainCode;
  if (params?.recCode) qp.recCode = params.recCode;
  if (params?.countryCode) qp.countryCode = params.countryCode;
  if (params?.campaignId) qp.campaignId = params.campaignId;
  if (params?.ownership) qp.ownership = params.ownership;
  if (params?.page) qp.page = String(params.page);
  if (params?.limit) qp.limit = String(params.limit);

  return useQuery<PaginatedResponse<DashboardListItem>>({
    queryKey: KEYS.list(qp),
    queryFn: async () => {
      const res = await analyticsClient.get<PaginatedResponse<DashboardListItem>>(
        '/analytics/dashboards',
        qp,
      );
      // Map title to locale-aware title for each dashboard in the list
      if (res?.data && Array.isArray(res.data)) {
        const loc = getCurrentLocale();
        res.data = res.data.map((d: any) => ({
          ...d,
          title: pickTitle(d, loc),
        }));
      }
      return res;
    },
  });
}

export function useDashboard(id: string) {
  return useQuery<{ data: Dashboard }>({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const res = await analyticsClient.get<{ data: Dashboard }>(`/analytics/dashboards/${id}`);
      return mapDashboardWidgets(res);
    },
    enabled: !!id,
  });
}

export function useDashboardRender(id: string) {
  return useQuery<{ data: DashboardRenderData }>({
    queryKey: KEYS.render(id),
    queryFn: async () => {
      const res = await analyticsClient.get<{ data: DashboardRenderData }>(
        `/analytics/dashboards/${id}/render`,
      );
      return mapDashboardWidgets(res);
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useDefaultDashboard(scope: string, target: string) {
  return useQuery<{ data: Dashboard }>({
    queryKey: KEYS.default(scope, target),
    queryFn: () => {
      // Parse target key: "domain:uuid", "sub:uuid", or "global"
      const params: Record<string, string> = { scope };
      if (target.startsWith('domain:')) {
        params.domainId = target.slice(7);
      } else if (target.startsWith('sub:')) {
        params.subDomainId = target.slice(4);
      }
      // "global" = no domainId/subDomainId, just scope
      return analyticsClient.get<{ data: Dashboard }>(
        '/analytics/dashboards/default-for',
        params,
      );
    },
    enabled: !!scope,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title?: string;
      titleFr?: string;
      titleEn?: string;
      titlePt?: string;
      titleAr?: string;
      description?: string;
      scope: DashboardScope;
      domainCode?: string;
      recCode?: string;
      countryCode?: string;
      campaignId?: string;
      isTemplate?: boolean;
      tags?: string[];
    }) => {
      const payload = {
        ...body,
        titleFr: body.titleFr || body.title || 'Nouveau tableau de bord',
        titleEn: body.titleEn || body.title || 'New Dashboard',
        titlePt: body.titlePt || null,
        titleAr: body.titleAr || null,
      };
      return analyticsClient.post<{ data: Dashboard }>('/analytics/dashboards', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

/** Fetch a public dashboard for REC/Country landing pages (no auth required) */
export function usePublicDashboard(scope: DashboardScope, code?: string) {
  const qp: Record<string, string> = { scope };
  if (scope === 'REC' && code) qp.recCode = code;
  if (scope === 'COUNTRY' && code) qp.countryCode = code;

  return useQuery<{ data: DashboardRenderData | null }>({
    queryKey: ['dashboards', 'public', scope, code],
    queryFn: async () => {
      try {
        const res = await analyticsClient.get<{ data: DashboardRenderData | null }>(
          '/analytics/dashboards/public',
          qp,
        );
        return res ?? { data: null };
      } catch {
        return { data: null };
      }
    },
    enabled: !!code,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      title,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string;
      scope?: DashboardScope;
      domainCode?: string;
      tags?: string[];
    }) => {
      const payload: Record<string, unknown> = { ...body };
      if (title !== undefined) {
        payload.titleFr = title;
        payload.titleEn = title;
      }
      return analyticsClient.patch<{ data: Dashboard }>(
        `/analytics/dashboards/${id}`,
        payload,
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      analyticsClient.delete(`/analytics/dashboards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

// ─── Widget mutations ───────────────────────────────────────────────────────

export function useAddWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      ...body
    }: {
      dashboardId: string;
      type: WidgetType;
      title: string;
      titleFr?: string;
      titleEn?: string;
      config?: Record<string, unknown>;
      dataSource?: Record<string, unknown>;
      sectionId?: string;
      columnIndex?: number;
      sortOrder?: number;
      layout?: { x: number; y: number; w: number; h: number };
    }) => {
      const payload: Record<string, unknown> = { ...body };
      payload.type = toBackendType(body.type);
      payload.titleFr = body.titleFr || body.title || 'Widget';
      payload.titleEn = body.titleEn || body.title || 'Widget';
      if (body.layout) {
        payload.gridX = body.layout.x;
        payload.gridY = body.layout.y;
        payload.gridW = body.layout.w;
        payload.gridH = body.layout.h;
      }
      return analyticsClient.post<{ data: DashboardWidget }>(
        `/analytics/dashboards/${dashboardId}/widgets`,
        payload,
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
    },
  });
}

export function useSaveLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      sections,
      widgets,
    }: {
      dashboardId: string;
      sections: Array<{
        id?: string | null;
        titleFr?: string;
        titleEn?: string;
        titleAr?: string | null;
        titlePt?: string | null;
        columnCount?: number;
        sortOrder: number;
        isCollapsed?: boolean;
        config?: Record<string, unknown>;
      }>;
      widgets: Array<{
        id: string;
        sectionId: string | null;
        columnIndex: number;
        sortOrder: number;
      }>;
    }) =>
      analyticsClient.post<{ data: Dashboard }>(
        `/analytics/dashboards/${dashboardId}/layout`,
        { sections, widgets },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useUpdateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      widgetId,
      title,
      ...rest
    }: {
      dashboardId: string;
      widgetId: string;
      title?: string;
      config?: Record<string, unknown>;
      dataSource?: Record<string, unknown>;
      layout?: { x: number; y: number; w: number; h: number };
    }) => {
      const payload: Record<string, unknown> = { ...rest };
      if (title !== undefined) {
        payload.titleFr = title;
        payload.titleEn = title;
      }
      if (rest.layout) {
        payload.gridX = rest.layout.x;
        payload.gridY = rest.layout.y;
        payload.gridW = rest.layout.w;
        payload.gridH = rest.layout.h;
        delete payload.layout;
      }
      return analyticsClient.patch<{ data: DashboardWidget }>(
        `/analytics/dashboards/${dashboardId}/widgets/${widgetId}`,
        payload,
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
    },
  });
}

export function useBatchUpdateWidgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      widgets,
    }: {
      dashboardId: string;
      widgets: Array<{
        id: string;
        layout: { x: number; y: number; w: number; h: number };
        sortOrder?: number;
      }>;
    }) => {
      // Map frontend layout objects to backend gridX/gridY/gridW/gridH fields
      const mapped = widgets.map((w) => ({
        id: w.id,
        gridX: w.layout.x,
        gridY: w.layout.y,
        gridW: w.layout.w,
        gridH: w.layout.h,
        sortOrder: w.sortOrder,
      }));
      return analyticsClient.patch<{ data: DashboardWidget[] }>(
        `/analytics/dashboards/${dashboardId}/widgets/batch`,
        { widgets: mapped },
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
    },
  });
}

export function useRemoveWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      widgetId,
    }: {
      dashboardId: string;
      widgetId: string;
    }) =>
      analyticsClient.delete(
        `/analytics/dashboards/${dashboardId}/widgets/${widgetId}`,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
    },
  });
}

// ─── Sharing & preferences ──────────────────────────────────────────────────

// Dashboard sharing — re-export from dedicated hooks file
export { useShareDashboard } from './dashboard-share-hooks';

export function useSetDashboardPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      dashboardId: string;
      scope: string;
      target: string;
    }) => {
      // Parse target key to proper API fields
      const payload: Record<string, string> = {
        dashboardId: body.dashboardId,
        scope: body.scope,
      };
      if (body.target.startsWith('domain:')) {
        payload.domainId = body.target.slice(7);
      } else if (body.target.startsWith('sub:')) {
        payload.subDomainId = body.target.slice(4);
      }
      return analyticsClient.post('/analytics/dashboards/preferences', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
