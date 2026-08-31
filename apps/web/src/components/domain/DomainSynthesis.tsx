'use client';

import React, { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { Maximize2, Minimize2, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { DomainSummary } from '@/lib/api/domain-summary-hooks';

// Lazy-load map to avoid SSR issues with Leaflet
const ChoroplethMap = dynamic(
  () => import('@/components/dashboard/maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const COLORS = ['#1F4E79', '#C9A227', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ea580c'];

interface DomainSynthesisProps {
  synthesis: DomainSummary['synthesis'] | null;
  loading?: boolean;
  domainColor?: string;
}

/* ── Fullscreen Modal ── */
function FullscreenModal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative h-[92vh] w-[96vw] max-w-[1600px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Content */}
        <div className="h-[calc(92vh-65px)] overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Widget Card wrapper with fullscreen + export buttons ── */
function WidgetCard({ title, subtitle, children, onFullscreen, onExport, fullscreenContent, exportLabel = 'Export', fullscreenLabel = 'Fullscreen' }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onFullscreen?: () => void;
  onExport?: () => void;
  fullscreenContent?: React.ReactNode;
  exportLabel?: string;
  fullscreenLabel?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div className="group rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
            <p className="text-[11px] text-gray-400">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onExport && (
              <button
                onClick={onExport}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                title={exportLabel}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
              title={fullscreenLabel}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="px-2 pb-2">
          {children}
        </div>
      </div>

      {/* Fullscreen modal */}
      <FullscreenModal
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title={title}
      >
        {fullscreenContent ?? children}
      </FullscreenModal>
    </>
  );
}

/* ── Export helpers ── */
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => String(row[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportChartAsPNG(chartRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const el = chartRef.current;
  if (!el) return;
  const svg = el.querySelector('svg');
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `${filename}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

/* ── Sub-components for chart content (reusable at normal + fullscreen sizes) ── */

function TrendChart({ data, domainColor, height = 280, submissionsLabel = 'Submissions', monthLabel = 'Month' }: {
  data: DomainSummary['synthesis']['monthlyTrend'];
  domainColor: string;
  height?: number;
  submissionsLabel?: string;
  monthLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={domainColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={domainColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(v) => v.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={35} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          formatter={(value: number) => [value.toLocaleString(), submissionsLabel]}
          labelFormatter={(label) => `${monthLabel}: ${label}`}
        />
        <Area type="monotone" dataKey="count" stroke={domainColor} strokeWidth={2.5} fill="url(#trendGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopCountriesChart({ data, height = 280, domainColor = '#1F4E79', noDataLabel = 'No data', valueLabel = 'Submissions' }: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  domainColor?: string;
  noDataLabel?: string;
  valueLabel?: string;
}) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>{noDataLabel}</div>;
  }
  const yWidth = Math.min(120, Math.max(70, ...data.map((d) => d.name.length * 7)));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={yWidth} interval={0} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(value: number) => [value.toLocaleString(), valueLabel]}
        />
        <Bar dataKey="value" fill={domainColor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Main Component ── */

export function DomainSynthesis({ synthesis, loading, domainColor = '#1F4E79' }: DomainSynthesisProps) {
  const t = useTranslations('domain');
  const trendRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);

  if (loading || !synthesis) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[460px] animate-pulse rounded-2xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  const mapData = synthesis.countryDistribution.map((c) => ({
    code: c.code?.toUpperCase() ?? '',
    name: c.name ?? c.code ?? '',
    outbreaks: 0,
    cases: 0,
    deaths: 0,
    vaccinations: 0,
    submissions: c.count,
    rec: '',
  }));

  const topCountriesData = [...synthesis.countryDistribution]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      name: c.name ?? c.code ?? '',
      value: c.count,
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 1. Africa Choropleth Map */}
      <WidgetCard
        title={t('geoTitle')}
        subtitle={t('geoSubtitle')}
        exportLabel={t('export')}
        fullscreenLabel={t('fullscreen')}
        onExport={() => exportToCSV(
          synthesis.countryDistribution.map((c) => ({ [t('csvCountry')]: c.code, [t('csvSubmissions')]: c.count })),
          'geographic-coverage',
        )}
        fullscreenContent={
          <div className="h-[calc(92vh-130px)]">
            <ChoroplethMap title={t('geoTitle')} data={mapData} indicator="submissions" bare />
          </div>
        }
      >
        <div className="h-[400px]">
          <ChoroplethMap title={t('geoTitle')} data={mapData} indicator="submissions" bare />
        </div>
      </WidgetCard>

      {/* 2. Monthly Trend Area Chart */}
      <WidgetCard
        title={t('trendTitle')}
        subtitle={t('trendSubtitle')}
        exportLabel={t('export')}
        fullscreenLabel={t('fullscreen')}
        onExport={() => {
          exportToCSV(
            synthesis.monthlyTrend.map((row) => ({ [t('csvMonth')]: row.month, [t('csvSubmissions')]: row.count })),
            'monthly-trend',
          );
        }}
        fullscreenContent={
          <div ref={trendRef}>
            <TrendChart data={synthesis.monthlyTrend} domainColor={domainColor} height={600} submissionsLabel={t('submissions')} monthLabel={t('month')} />
          </div>
        }
      >
        <div ref={trendRef}>
          <TrendChart data={synthesis.monthlyTrend} domainColor={domainColor} height={380} submissionsLabel={t('submissions')} monthLabel={t('month')} />
        </div>
      </WidgetCard>

      {/* 3. Top 10 Countries */}
      <WidgetCard
        title={t('topCountriesTitle')}
        subtitle={t('topCountriesSubtitle')}
        exportLabel={t('export')}
        fullscreenLabel={t('fullscreen')}
        onExport={() => {
          exportToCSV(
            topCountriesData.map((c) => ({ [t('csvCountry')]: c.name, [t('csvSubmissions')]: c.value })),
            'top-countries',
          );
        }}
        fullscreenContent={
          <div ref={pieRef}>
            <TopCountriesChart data={topCountriesData} height={600} domainColor={domainColor} noDataLabel={t('noData')} valueLabel={t('submissions')} />
          </div>
        }
      >
        <div ref={pieRef}>
          <TopCountriesChart data={topCountriesData} height={380} domainColor={domainColor} noDataLabel={t('noData')} valueLabel={t('submissions')} />
        </div>
      </WidgetCard>
    </div>
  );
}
