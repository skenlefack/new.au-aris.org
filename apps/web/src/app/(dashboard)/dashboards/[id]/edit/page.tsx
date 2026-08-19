'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, X, Share2, ArrowLeft, Sparkles, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useDashboard,
  useUpdateDashboard,
  useAddWidget,
  useRemoveWidget,
  useSaveLayout,
  type WidgetType,
  type DashboardWidget,
  type DashboardSection,
} from '@/lib/api/dashboard-hooks';
import { DashboardEditor } from '@/components/dashboard-builder/DashboardEditor';
import { WidgetConfigPanel } from '@/components/dashboard-builder/WidgetConfigPanel';
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';
import { ShareDashboardDialog } from '@/components/dashboard-builder/ShareDashboardDialog';
import type { GlobalFilters } from '@/components/dashboard-builder/GlobalFilterBar';

export default function DashboardEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: dashboardData, isLoading } = useDashboard(id);
  const updateDashboard = useUpdateDashboard();
  const addWidget = useAddWidget();
  const removeWidget = useRemoveWidget();
  const saveLayout = useSaveLayout();

  const dashboard = dashboardData?.data;
  const d = dashboard as any;

  const [title, setTitle] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const titleInitRef = useRef(false);

  // Local sections state — synced from server, modified locally during editing
  const [localSections, setLocalSections] = useState<DashboardSection[]>([]);
  // Track whether user has made local edits (drag/reorder) to avoid overwriting
  const hasLocalEdits = useRef(false);

  // Undo/Redo history
  const MAX_HISTORY = 30;
  const [history, setHistory] = useState<DashboardSection[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback((sections: DashboardSection[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(sections)));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLocalSections(JSON.parse(JSON.stringify(history[newIndex])));
      hasLocalEdits.current = true;
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLocalSections(JSON.parse(JSON.stringify(history[newIndex])));
      hasLocalEdits.current = true;
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Initialize title once
  if (d && !titleInitRef.current) {
    setTitle({
      fr: d.title_fr || d.titleFr || d.title || '',
      en: d.title_en || d.titleEn || d.title || '',
      pt: d.title_pt || d.titlePt || '', ar: d.title_ar || d.titleAr || '',
      es: d.title_es || d.titleEs || '', sw: d.title_sw || d.titleSw || '',
    });
    setDescription({
      en: d.description_en || d.descriptionEn || d.description || '',
      fr: d.description_fr || d.descriptionFr || d.description || '',
      pt: d.description_pt || d.descriptionPt || '', ar: d.description_ar || d.descriptionAr || '',
      es: d.description_es || d.descriptionEs || '', sw: d.description_sw || d.descriptionSw || '',
    });
    setRefreshInterval(d.refreshInterval ?? d.refresh_interval ?? null);
    titleInitRef.current = true;
  }

  // Sync sections from server data — re-sync when server data changes
  // (after addWidget/removeWidget mutations invalidate the query)
  useEffect(() => {
    if (dashboard?.sections && !hasLocalEdits.current) {
      setLocalSections(dashboard.sections);
      // Initialize undo history with the first server state
      if (history.length === 0) {
        setHistory([JSON.parse(JSON.stringify(dashboard.sections))]);
        setHistoryIndex(0);
      }
    }
  }, [dashboard?.sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Widget config panel
  const [configWidget, setConfigWidget] = useState<DashboardWidget | null>(null);

  // AI suggestion dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Share dialog
  const [shareOpen, setShareOpen] = useState(false);

  // Global filters
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({});

  const handleAiAccept = useCallback(
    (draft: any) => {
      if (!dashboard) return;
      // The draft may be the full AI response { id, type, output: {...} }
      // or just the inner output. Handle both.
      const inner = draft.output ?? draft;
      if (inner.title) setTitle(prev => ({ ...prev, fr: inner.title, en: inner.title }));
      const widgets = inner.widgets ?? draft.widgets;
      if (Array.isArray(widgets) && localSections.length > 0) {
        const targetSection = localSections[0];
        // Map AI widget types to ARIS WidgetType enum
        const typeMap: Record<string, string> = {
          // exact matches — use frontend short names
          kpi_card: 'KPI_CARD', bar_chart: 'BAR', line_chart: 'LINE',
          pie_chart: 'PIE', table: 'TABLE', map: 'MAP', gauge: 'GAUGE',
          stat_card: 'STAT_CARD', progress_bar: 'PROGRESS_BAR',
          divider: 'DIVIDER', image: 'IMAGE', iframe: 'IFRAME', list: 'LIST',
          // legacy / short forms
          kpi: 'KPI_CARD', stat: 'STAT_CARD', chart: 'LINE',
          bar: 'BAR', line: 'LINE', pie: 'PIE',
          timeseries: 'LINE', time_series: 'LINE',
          horizontal_bar: 'BAR', area: 'AREA',
          stacked_bar: 'STACKED_BAR', text_block: 'TEXT_BLOCK',
          alert_feed: 'ALERT_FEED',
        };
        widgets.forEach((w: any, idx: number) => {
          const rawType = (w.type ?? 'KPI_CARD').toLowerCase().trim();
          const mappedType = typeMap[rawType] ?? 'KPI_CARD';
          addWidget.mutate({
            dashboardId: id,
            type: mappedType as WidgetType,
            title: w.title ?? w.type ?? `Widget ${idx + 1}`,
            sectionId: targetSection.id.startsWith('temp-') ? undefined : targetSection.id,
            columnIndex: idx % 3,  // spread across 3 columns
            sortOrder: Math.floor(idx / 3),
          });
        });
      }
    },
    [dashboard, id, addWidget, localSections],
  );

  const handleAddWidget = useCallback(
    (type: WidgetType, sectionId: string, columnIndex: number) => {
      const section = localSections.find((s) => s.id === sectionId);
      const colWidgets = section?.widgets.filter(
        (w) => (w.columnIndex ?? 0) === columnIndex,
      ) ?? [];

      const widgetTitle = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const tempWidgetId = `temp-widget-${Date.now()}`;

      // Optimistic: add widget to local state immediately
      const tempWidget: DashboardWidget = {
        id: tempWidgetId,
        dashboardId: id,
        type,
        title: widgetTitle,
        config: {},
        layout: { x: 0, y: 0, w: 3, h: 2 },
        sectionId,
        columnIndex,
        sortOrder: colWidgets.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setLocalSections((prev) =>
        prev.map((sec) =>
          sec.id === sectionId
            ? { ...sec, widgets: [...sec.widgets, tempWidget] }
            : sec,
        ),
      );
      hasLocalEdits.current = true;

      // Fire server mutation — on success, allow server sync to replace temp widget
      addWidget.mutate(
        {
          dashboardId: id,
          type,
          title: widgetTitle,
          titleFr: widgetTitle,
          titleEn: widgetTitle,
          sectionId: sectionId.startsWith('temp-') ? undefined : sectionId,
          columnIndex,
          sortOrder: colWidgets.length,
        },
        {
          onSuccess: () => {
            hasLocalEdits.current = false;
          },
        },
      );
    },
    [id, addWidget, localSections],
  );

  const handleSectionsChange = useCallback((newSections: DashboardSection[]) => {
    hasLocalEdits.current = true;
    pushHistory(newSections);
    setLocalSections(newSections);
  }, [pushHistory]);

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      // Remove from local state immediately
      setLocalSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          widgets: sec.widgets.filter((w) => w.id !== widgetId),
        })),
      );
      hasLocalEdits.current = false; // allow server sync after delete
      removeWidget.mutate({ dashboardId: id, widgetId });
    },
    [id, removeWidget],
  );

  const handleConfigureWidget = useCallback((widget: DashboardWidget) => {
    setConfigWidget(widget);
  }, []);

  const handleDuplicateWidget = useCallback(
    (widgetId: string) => {
      setLocalSections((prev) => {
        return prev.map((sec) => {
          const idx = sec.widgets.findIndex((w) => w.id === widgetId);
          if (idx === -1) return sec;
          const original = sec.widgets[idx];
          const copy: DashboardWidget = {
            ...original,
            id: `temp-widget-${Date.now()}`,
            title: `Copy of ${original.title}`,
            sortOrder: original.sortOrder + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const newWidgets = [...sec.widgets];
          newWidgets.splice(idx + 1, 0, copy);
          return { ...sec, widgets: newWidgets };
        });
      });
      hasLocalEdits.current = true;
    },
    [],
  );

  const handleDuplicateSection = useCallback(
    (sectionId: string) => {
      setLocalSections((prev) => {
        const idx = prev.findIndex((s) => s.id === sectionId);
        if (idx === -1) return prev;
        const original = prev[idx];
        const newSectionId = `temp-section-${Date.now()}`;
        const copy: DashboardSection = {
          ...original,
          id: newSectionId,
          titleFr: `Copy of ${original.titleFr || ''}`,
          titleEn: `Copy of ${original.titleEn || ''}`,
          sortOrder: original.sortOrder + 1,
          widgets: original.widgets.map((w, i) => ({
            ...w,
            id: `temp-widget-${Date.now()}-${i}`,
            sectionId: newSectionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
        };
        const result = [...prev];
        result.splice(idx + 1, 0, copy);
        return result;
      });
      hasLocalEdits.current = true;
    },
    [],
  );

  const handleSave = async () => {
    // 1. Update title/description/refreshInterval if changed
    const dashRefresh = d?.refreshInterval ?? d?.refresh_interval ?? null;
    const titleChanged = title.fr !== (d?.title_fr || d?.titleFr || '') || title.en !== (d?.title_en || d?.titleEn || '');
    const descChanged = (description.fr || description.en) !== (d?.description || d?.description_fr || '');
    if (titleChanged || descChanged || refreshInterval !== dashRefresh) {
      await updateDashboard.mutateAsync({
        id, title: title.fr || title.en, description: description.fr || description.en, refreshInterval,
        titleFr: title.fr, titleEn: title.en,
        titlePt: title.pt, titleAr: title.ar,
        titleEs: title.es, titleSw: title.sw,
      });
    }

    // 2. Save layout (sections + widget positions)
    const sectionPayload = localSections.map((s, i) => ({
      id: s.id.startsWith('temp-') ? null : s.id,
      titleFr: s.titleFr,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      titlePt: s.titlePt,
      columnCount: s.columnCount,
      sortOrder: i,
      isCollapsed: s.isCollapsed,
      config: s.config,
    }));

    const widgetPayload = localSections.flatMap((sec) =>
      sec.widgets.map((w) => ({
        id: w.id,
        sectionId: sec.id.startsWith('temp-') ? null : sec.id,
        columnIndex: w.columnIndex ?? 0,
        sortOrder: w.sortOrder ?? 0,
      })),
    );

    await saveLayout.mutateAsync({
      dashboardId: id,
      sections: sectionPayload,
      widgets: widgetPayload,
    });

    router.push(`/dashboards/${id}`);
  };

  const handleCancel = () => {
    router.push(`/dashboards/${id}`);
  };

  const isSaving = updateDashboard.isPending || saveLayout.isPending;

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1F4E79]" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">Dashboard not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title || 'Untitled Dashboard'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#C9A227]/30 bg-gradient-to-r from-[#1F4E79]/5 to-[#C9A227]/5 px-3 py-1.5 text-sm font-medium text-[#1F4E79] hover:from-[#1F4E79]/10 hover:to-[#C9A227]/10 transition-all dark:text-[#C9A227] dark:border-[#C9A227]/20"
          >
            <Sparkles className="h-4 w-4" style={{ color: '#C9A227' }} />
            Suggest with AI
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor with DnD */}
      <div className="flex-1 min-h-0">
        <DashboardEditor
          title={title}
          description={description}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          sections={localSections}
          onSectionsChange={handleSectionsChange}
          onAddWidget={handleAddWidget}
          onWidgetConfigure={handleConfigureWidget}
          onWidgetRemove={handleRemoveWidget}
          onWidgetDuplicate={handleDuplicateWidget}
          onSectionDuplicate={handleDuplicateSection}
          globalFilters={globalFilters}
          onGlobalFiltersChange={setGlobalFilters}
        />
      </div>

      <WidgetConfigPanel
        widget={configWidget}
        dashboardId={id}
        allWidgets={localSections.flatMap((s) => s.widgets)}
        onClose={() => setConfigWidget(null)}
        onSaved={() => {
          setConfigWidget(null);
          hasLocalEdits.current = false;
        }}
      />

      <AiSuggestionDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        type="dashboard"
        onAccept={handleAiAccept}
        context={{ domainCode: (dashboard as any).domainCode, scope: (dashboard as any).scope }}
      />

      <ShareDashboardDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        dashboardId={id}
        dashboardTitle={title}
      />
    </div>
  );
}
