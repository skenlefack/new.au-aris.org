'use client';

import React from 'react';
import {
  Activity,
  BarChart3,
  PieChart,
  Map as MapIcon,
  LayoutDashboard,
  Table2,
  Gauge,
  Type,
  Bell,
  TrendingUp,
  Layers,
  AreaChart,
  Hash,
  Minus,
  Image as ImageIcon,
  Globe,
  List as ListIcon,
  BarChart,
  Grid3X3,
  Medal,
  Clock,
  HeartPulse,
  GitBranch,
  Calculator,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WidgetType } from '@/lib/api/dashboard-hooks';
import { useTranslations } from '@/lib/i18n/translations';

interface WidgetTemplate {
  type: WidgetType;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
  defaultLayout: { w: number; h: number };
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { type: 'KPI_CARD', labelKey: 'widgetKpiCard', descKey: 'widgetKpiCardDesc', icon: Activity, defaultLayout: { w: 3, h: 2 } },
  { type: 'LINE', labelKey: 'widgetLine', descKey: 'widgetLineDesc', icon: TrendingUp, defaultLayout: { w: 6, h: 4 } },
  { type: 'BAR', labelKey: 'widgetBar', descKey: 'widgetBarDesc', icon: BarChart3, defaultLayout: { w: 6, h: 4 } },
  { type: 'STACKED_BAR', labelKey: 'widgetStackedBar', descKey: 'widgetStackedBarDesc', icon: Layers, defaultLayout: { w: 6, h: 4 } },
  { type: 'AREA', labelKey: 'widgetArea', descKey: 'widgetAreaDesc', icon: AreaChart, defaultLayout: { w: 6, h: 4 } },
  { type: 'PIE', labelKey: 'widgetPie', descKey: 'widgetPieDesc', icon: PieChart, defaultLayout: { w: 4, h: 4 } },
  { type: 'MAP', labelKey: 'widgetMap', descKey: 'widgetMapDesc', icon: MapIcon, defaultLayout: { w: 6, h: 5 } },
  { type: 'TABLE', labelKey: 'widgetTable', descKey: 'widgetTableDesc', icon: Table2, defaultLayout: { w: 6, h: 4 } },
  { type: 'GAUGE', labelKey: 'widgetGauge', descKey: 'widgetGaugeDesc', icon: Gauge, defaultLayout: { w: 3, h: 3 } },
  { type: 'TEXT_BLOCK', labelKey: 'widgetTextBlock', descKey: 'widgetTextBlockDesc', icon: Type, defaultLayout: { w: 4, h: 3 } },
  { type: 'ALERT_FEED', labelKey: 'widgetAlertFeed', descKey: 'widgetAlertFeedDesc', icon: Bell, defaultLayout: { w: 4, h: 4 } },
  { type: 'STAT_CARD', labelKey: 'widgetStatCard', descKey: 'widgetStatCardDesc', icon: Hash, defaultLayout: { w: 3, h: 2 } },
  { type: 'PROGRESS_BAR', labelKey: 'widgetProgressBar', descKey: 'widgetProgressBarDesc', icon: BarChart, defaultLayout: { w: 4, h: 2 } },
  { type: 'DIVIDER', labelKey: 'widgetDivider', descKey: 'widgetDividerDesc', icon: Minus, defaultLayout: { w: 12, h: 1 } },
  { type: 'IMAGE', labelKey: 'widgetImage', descKey: 'widgetImageDesc', icon: ImageIcon, defaultLayout: { w: 4, h: 3 } },
  { type: 'IFRAME', labelKey: 'widgetEmbed', descKey: 'widgetEmbedDesc', icon: Globe, defaultLayout: { w: 6, h: 4 } },
  { type: 'LIST', labelKey: 'widgetList', descKey: 'widgetListDesc', icon: ListIcon, defaultLayout: { w: 4, h: 3 } },
  { type: 'HEATMAP', labelKey: 'widgetHeatmap', descKey: 'widgetHeatmapDesc', icon: Grid3X3, defaultLayout: { w: 6, h: 4 } },
  { type: 'RANKED_LIST', labelKey: 'widgetRankedList', descKey: 'widgetRankedListDesc', icon: Medal, defaultLayout: { w: 4, h: 4 } },
  { type: 'ACTIVITY_FEED', labelKey: 'widgetActivityFeed', descKey: 'widgetActivityFeedDesc', icon: Clock, defaultLayout: { w: 4, h: 4 } },
  { type: 'EPI_CURVE', labelKey: 'widgetEpiCurve', descKey: 'widgetEpiCurveDesc', icon: HeartPulse, defaultLayout: { w: 6, h: 4 } },
  { type: 'DUAL_AXIS', labelKey: 'widgetDualAxis', descKey: 'widgetDualAxisDesc', icon: GitBranch, defaultLayout: { w: 6, h: 4 } },
  { type: 'COUNTER', labelKey: 'widgetCounter', descKey: 'widgetCounterDesc', icon: Calculator, defaultLayout: { w: 3, h: 2 } },
  { type: 'CHOROPLETH_MAP', labelKey: 'widgetChoroplethMap', descKey: 'widgetChoroplethMapDesc', icon: Globe, defaultLayout: { w: 6, h: 4 } },
  { type: 'KPI_STRIP', labelKey: 'widgetKpiStrip', descKey: 'widgetKpiStripDesc', icon: LayoutDashboard, defaultLayout: { w: 12, h: 1 } },
  { type: 'PERSON_STAT', labelKey: 'widgetPersonStat', descKey: 'widgetPersonStatDesc', icon: Users, defaultLayout: { w: 4, h: 3 } },
];

interface WidgetPaletteProps {
  onAdd: (type: WidgetType, defaultLayout: { w: number; h: number }) => void;
}

export function WidgetPalette({ onAdd }: WidgetPaletteProps) {
  const t = useTranslations('dashboard');

  return (
    <div className="flex h-full flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {t('widgets')}
        </h2>
        <p className="mt-0.5 text-xs text-gray-400">
          {t('clickToAdd')}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {WIDGET_TEMPLATES.map((tmpl) => {
          const Icon = tmpl.icon;
          return (
            <button
              key={tmpl.type}
              onClick={() => onAdd(tmpl.type, tmpl.defaultLayout)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1F4E79]/10 text-[#1F4E79] group-hover:bg-[#1F4E79]/20 transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t(tmpl.labelKey)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug">
                  {t(tmpl.descKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
