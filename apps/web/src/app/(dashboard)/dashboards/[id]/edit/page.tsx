'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, X, Share2, ArrowLeft, Sparkles } from 'lucide-react';
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
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';

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

  const [title, setTitle] = useState('');
  const titleInitRef = useRef(false);

  // Local sections state — synced from server, modified locally during editing
  const [localSections, setLocalSections] = useState<DashboardSection[]>([]);
  // Track whether user has made local edits (drag/reorder) to avoid overwriting
  const hasLocalEdits = useRef(false);

  // Initialize title once
  if (d && !titleInitRef.current) {
    setTitle(d.title || d.title_fr || d.titleFr || '');
    titleInitRef.current = true;
  }

  // Sync sections from server data — re-sync when server data changes
  // (after addWidget/removeWidget mutations invalidate the query)
  useEffect(() => {
    if (dashboard?.sections && !hasLocalEdits.current) {
      setLocalSections(dashboard.sections);
    }
  }, [dashboard?.sections]);

  // AI suggestion dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleAiAccept = useCallback(
    (draft: any) => {
      if (!dashboard) return;
      if (draft.title) setTitle(draft.title);
      if (Array.isArray(draft.widgets) && localSections.length > 0) {
        const targetSection = localSections[0];
        for (const w of draft.widgets) {
          addWidget.mutate({
            dashboardId: id,
            type: w.type ?? 'KPI_CARD',
            title: w.title ?? w.type,
            sectionId: targetSection.id.startsWith('temp-') ? undefined : targetSection.id,
            columnIndex: 0,
            sortOrder: targetSection.widgets.length,
          });
        }
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
    setLocalSections(newSections);
  }, []);

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

  const handleConfigureWidget = useCallback((_widget: DashboardWidget) => {
    // Widget config modal - future iteration
  }, []);

  const handleSave = async () => {
    // 1. Update title if changed
    const dashTitle = d?.title || d?.title_fr || '';
    if (title !== dashTitle) {
      await updateDashboard.mutateAsync({ id, title });
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-none bg-transparent text-lg font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-0 w-80"
            placeholder="Dashboard title..."
          />
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
          sections={localSections}
          onSectionsChange={handleSectionsChange}
          onAddWidget={handleAddWidget}
          onWidgetConfigure={handleConfigureWidget}
          onWidgetRemove={handleRemoveWidget}
        />
      </div>

      <AiSuggestionDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        type="dashboard"
        onAccept={handleAiAccept}
        context={{ domainCode: (dashboard as any).domainCode, scope: (dashboard as any).scope }}
      />
    </div>
  );
}
