// React Query hooks for the Dashboard Builder.
//
// Wraps the analytics service (services/analytics, port 3030) endpoints
// for custom dashboard CRUD, widget management, sharing, and preferences.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsClient } from './client';

/** Map flat grid_x/grid_y/grid_w/grid_h from backend to layout object expected by frontend */
function mapWidgetLayout(w: any): any {
  if (w.layout) return w; // already mapped
  return {
    ...w,
    title: w.title || w.title_fr || w.titleFr || '',
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
  const widgets = (sec.widgets || []).map(mapWidgetLayout);
  return {
    id: sec.id,
    dashboardId: sec.dashboard_id || sec.dashboardId,
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

  // Map dashboard title from backend fields
  if (!d.title) {
    d.title = d.title_fr || d.titleFr || d.title_en || d.titleEn || '';
  }
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

export type DashboardScope = 'CONTINENTAL' | 'REC' | 'MEMBER_STATE' | 'PERSONAL';
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
  | 'ALERT_FEED';

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
  ownership?: DashboardOwnership;
  page?: number;
  limit?: number;
}) {
  const qp: Record<string, string> = {};
  if (params?.scope) qp.scope = params.scope;
  if (params?.domainCode) qp.domainCode = params.domainCode;
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
      // Map title_fr/title_en → title for each dashboard in the list
      if (res?.data && Array.isArray(res.data)) {
        res.data = res.data.map((d: any) => ({
          ...d,
          title: d.title || d.title_fr || d.titleFr || d.title_en || d.titleEn || '',
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
    queryFn: () =>
      analyticsClient.get<{ data: Dashboard }>(
        '/analytics/dashboards/default',
        { scope, target },
      ),
    enabled: !!scope && !!target,
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
      description?: string;
      scope: DashboardScope;
      domainCode?: string;
      isTemplate?: boolean;
      tags?: string[];
    }) => {
      const payload = {
        ...body,
        titleFr: body.titleFr || body.title || 'Nouveau tableau de bord',
        titleEn: body.titleEn || body.title || 'New Dashboard',
      };
      return analyticsClient.post<{ data: Dashboard }>('/analytics/dashboards', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string;
      scope?: DashboardScope;
      domainCode?: string;
      tags?: string[];
    }) =>
      analyticsClient.patch<{ data: Dashboard }>(
        `/analytics/dashboards/${id}`,
        body,
      ),
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
      ...body
    }: {
      dashboardId: string;
      widgetId: string;
      title?: string;
      config?: Record<string, unknown>;
      dataSource?: Record<string, unknown>;
      layout?: { x: number; y: number; w: number; h: number };
    }) =>
      analyticsClient.patch<{ data: DashboardWidget }>(
        `/analytics/dashboards/${dashboardId}/widgets/${widgetId}`,
        body,
      ),
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
    }) =>
      analyticsClient.patch<{ data: DashboardWidget[] }>(
        `/analytics/dashboards/${dashboardId}/widgets/batch`,
        { widgets },
      ),
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

export function useShareDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      ...body
    }: {
      dashboardId: string;
      targetType: 'USER' | 'ROLE' | 'TENANT';
      targetId: string;
      permission: 'VIEW' | 'EDIT';
    }) =>
      analyticsClient.post(
        `/analytics/dashboards/${dashboardId}/share`,
        body,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.dashboardId) });
    },
  });
}

export function useSetDashboardPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      dashboardId: string;
      scope: string;
      target: string;
    }) =>
      analyticsClient.post('/analytics/dashboards/preference', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
