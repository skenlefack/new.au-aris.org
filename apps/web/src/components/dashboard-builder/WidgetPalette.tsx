'use client';

import React from 'react';
import {
  Activity,
  BarChart3,
  PieChart,
  Map,
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WidgetType } from '@/lib/api/dashboard-hooks';

interface WidgetTemplate {
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultLayout: { w: number; h: number };
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    type: 'KPI_CARD',
    label: 'KPI Card',
    description: 'Single value with trend indicator',
    icon: Activity,
    defaultLayout: { w: 3, h: 2 },
  },
  {
    type: 'LINE',
    label: 'Line Chart',
    description: 'Time series and trend lines',
    icon: TrendingUp,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'BAR',
    label: 'Bar Chart',
    description: 'Compare categorical data',
    icon: BarChart3,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'STACKED_BAR',
    label: 'Stacked Bar',
    description: 'Grouped categories breakdown',
    icon: Layers,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'AREA',
    label: 'Area Chart',
    description: 'Cumulative trend visualization',
    icon: AreaChart,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'PIE',
    label: 'Pie Chart',
    description: 'Proportional breakdown',
    icon: PieChart,
    defaultLayout: { w: 4, h: 4 },
  },
  {
    type: 'MAP',
    label: 'Map',
    description: 'Geographic data display',
    icon: Map,
    defaultLayout: { w: 6, h: 5 },
  },
  {
    type: 'TABLE',
    label: 'Table',
    description: 'Tabular data with rows/columns',
    icon: Table2,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'GAUGE',
    label: 'Gauge',
    description: 'Progress toward a target',
    icon: Gauge,
    defaultLayout: { w: 3, h: 3 },
  },
  {
    type: 'TEXT_BLOCK',
    label: 'Text Block',
    description: 'Free text or markdown content',
    icon: Type,
    defaultLayout: { w: 4, h: 3 },
  },
  {
    type: 'ALERT_FEED',
    label: 'Alert Feed',
    description: 'List of alerts and notifications',
    icon: Bell,
    defaultLayout: { w: 4, h: 4 },
  },
  {
    type: 'STAT_CARD',
    label: 'Statistics',
    description: 'Big number with comparison',
    icon: Hash,
    defaultLayout: { w: 3, h: 2 },
  },
  {
    type: 'PROGRESS_BAR',
    label: 'Progress Bar',
    description: 'Progress toward a goal',
    icon: BarChart,
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'DIVIDER',
    label: 'Divider',
    description: 'Visual separator',
    icon: Minus,
    defaultLayout: { w: 12, h: 1 },
  },
  {
    type: 'IMAGE',
    label: 'Image',
    description: 'Display an image',
    icon: ImageIcon,
    defaultLayout: { w: 4, h: 3 },
  },
  {
    type: 'IFRAME',
    label: 'Embed',
    description: 'Embed external content',
    icon: Globe,
    defaultLayout: { w: 6, h: 4 },
  },
  {
    type: 'LIST',
    label: 'List',
    description: 'List of items with values',
    icon: ListIcon,
    defaultLayout: { w: 4, h: 3 },
  },
];

interface WidgetPaletteProps {
  onAdd: (type: WidgetType, defaultLayout: { w: number; h: number }) => void;
}

export function WidgetPalette({ onAdd }: WidgetPaletteProps) {
  return (
    <div className="flex h-full flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Widgets
        </h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Click to add to dashboard
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
                  {tmpl.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug">
                  {tmpl.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
