'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, X, Share2, ArrowLeft, Sparkles } from 'lucide-react';
import {
  useDashboard,
  useUpdateDashboard,
  useAddWidget,
  useRemoveWidget,
  useBatchUpdateWidgets,
  type WidgetType,
  type DashboardWidget,
} from '@/lib/api/dashboard-hooks';
import { DashboardGrid } from '@/components/dashboard-builder/DashboardGrid';
import { WidgetPalette } from '@/components/dashboard-builder/WidgetPalette';
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';

export default function DashboardEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: dashboardData, isLoading } = useDashboard(id);
  const updateDashboard = useUpdateDashboard();
  const addWidget = useAddWidget();
  const removeWidget = useRemoveWidget();
  const batchUpdate = useBatchUpdateWidgets();

  const dashboard = dashboardData?.data;

  const [title, setTitle] = useState('');
  const titleInitialized = useRef(false);
  if (dashboard && !titleInitialized.current) {
    setTitle(dashboard.title);
    titleInitialized.current = true;
  }

  // AI suggestion dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleAiAccept = useCallback(
    (draft: any) => {
      if (!dashboard) return;
      if (draft.title) setTitle(draft.title);
      // If the AI suggests widgets, add them via addWidget
      if (Array.isArray(draft.widgets)) {
        let currentY = (dashboard.widgets ?? []).reduce(
          (max, w) => Math.max(max, w.layout.y + w.layout.h),
          0,
        );
        for (const w of draft.widgets) {
          addWidget.mutate({
            dashboardId: id,
            type: w.type ?? 'KPI_CARD',
            title: w.title ?? w.type,
            layout: { x: w.layout?.x ?? 0, y: currentY, w: w.layout?.w ?? 4, h: w.layout?.h ?? 3 },
          });
          currentY += w.layout?.h ?? 3;
        }
      }
    },
    [dashboard, id, addWidget],
  );

  // Pending layout changes (accumulated during drag/resize, saved on explicit Save)
  const pendingLayoutRef = useRef<
    Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }>
  >([]);

  const handleLayoutChange = useCallback(
    (layouts: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }>) => {
      pendingLayoutRef.current = layouts;
    },
    [],
  );

  const handleAddWidget = useCallback(
    (type: WidgetType, defaultLayout: { w: number; h: number }) => {
      if (!dashboard) return;
      // Find next free Y position
      const maxY = (dashboard.widgets ?? []).reduce(
        (max, w) => Math.max(max, w.layout.y + w.layout.h),
        0,
      );
      addWidget.mutate({
        dashboardId: id,
        type,
        title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        layout: { x: 0, y: maxY, ...defaultLayout },
      });
    },
    [dashboard, id, addWidget],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      removeWidget.mutate({ dashboardId: id, widgetId });
    },
    [id, removeWidget],
  );

  const handleConfigureWidget = useCallback((_widget: DashboardWidget) => {
    // Widget config modal - future iteration
    // For now, clicking configure does nothing
  }, []);

  const handleSave = async () => {
    // 1. Update title if changed
    if (dashboard && title !== dashboard.title) {
      await updateDashboard.mutateAsync({ id, title });
    }
    // 2. Batch update layouts if any pending
    if (pendingLayoutRef.current.length > 0) {
      await batchUpdate.mutateAsync({
        dashboardId: id,
        widgets: pendingLayoutRef.current.map((l, i) => ({
          id: l.id,
          layout: l.layout,
          sortOrder: i,
        })),
      });
      pendingLayoutRef.current = [];
    }
    router.push(`/dashboards/${id}`);
  };

  const handleCancel = () => {
    router.push(`/dashboards/${id}`);
  };

  const isSaving = updateDashboard.isPending || batchUpdate.isPending;

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
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left: Widget Palette */}
      <div className="w-64 flex-shrink-0">
        <WidgetPalette onAdd={handleAddWidget} />
      </div>

      {/* Right: Editor */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2">
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

        {/* Grid area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-gray-950 p-6">
          <DashboardGrid
            widgets={dashboard.widgets ?? []}
            editable
            onLayoutChange={handleLayoutChange}
            onWidgetConfigure={handleConfigureWidget}
            onWidgetRemove={handleRemoveWidget}
          />
        </div>
      </div>

      <AiSuggestionDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        type="dashboard"
        onAccept={handleAiAccept}
        context={{ domainCode: dashboard.domainCode, scope: dashboard.scope }}
      />
    </div>
  );
}
