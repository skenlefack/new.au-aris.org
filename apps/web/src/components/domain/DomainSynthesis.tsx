'use client';

import React, { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Maximize2, Minimize2, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
function WidgetCard({ title, subtitle, children, onFullscreen, onExport, fullscreenContent }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onFullscreen?: () => void;
  onExport?: () => void;
  fullscreenContent?: React.ReactNode;
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
                title="Exporter"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
              title="Plein ecran"
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

function TrendChart({ data, domainColor, height = 280 }: {
  data: DomainSummary['synthesis']['monthlyTrend'];
  domainColor: string;
  height?: number;
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
          formatter={(value: number) => [value.toLocaleString(), 'Soumissions']}
          labelFormatter={(label) => `Mois: ${label}`}
        />
        <Area type="monotone" dataKey="count" stroke={domainColor} strokeWidth={2.5} fill="url(#trendGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BreakdownChart({ data, height = 280 }: {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>Aucune donnee</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={height > 400 ? 80 : 55}
          outerRadius={height > 400 ? 140 : 90}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
          animationBegin={200}
          animationDuration={800}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(value: number) => value.toLocaleString()}
        />
        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Main Component ── */

export function DomainSynthesis({ synthesis, loading, domainColor = '#1F4E79' }: DomainSynthesisProps) {
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

  const pieData = synthesis.subDomainBreakdown
    .filter((s) => s.count > 0)
    .map((s, i) => ({
      name: s.label || s.code,
      value: s.count,
      color: COLORS[i % COLORS.length],
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 1. Africa Choropleth Map */}
      <WidgetCard
        title="Couverture geographique"
        subtitle="Soumissions par pays"
        onExport={() => exportToCSV(
          synthesis.countryDistribution.map((c) => ({ pays: c.code, soumissions: c.count })),
          'couverture-geographique',
        )}
        fullscreenContent={
          <div className="h-[calc(92vh-130px)]">
            <ChoroplethMap title="Couverture geographique" data={mapData} indicator="submissions" bare />
          </div>
        }
      >
        <div className="h-[400px]">
          <ChoroplethMap title="Couverture geographique" data={mapData} indicator="submissions" bare />
        </div>
      </WidgetCard>

      {/* 2. Monthly Trend Area Chart */}
      <WidgetCard
        title="Tendance mensuelle"
        subtitle="12 derniers mois"
        onExport={() => {
          exportToCSV(
            synthesis.monthlyTrend.map((t) => ({ mois: t.month, soumissions: t.count })),
            'tendance-mensuelle',
          );
        }}
        fullscreenContent={
          <div ref={trendRef}>
            <TrendChart data={synthesis.monthlyTrend} domainColor={domainColor} height={600} />
          </div>
        }
      >
        <div ref={trendRef}>
          <TrendChart data={synthesis.monthlyTrend} domainColor={domainColor} height={380} />
        </div>
      </WidgetCard>

      {/* 3. Sub-domain Donut */}
      <WidgetCard
        title="Repartition"
        subtitle="Par formulaire / sous-domaine"
        onExport={() => {
          exportToCSV(
            synthesis.subDomainBreakdown.map((s) => ({ sous_domaine: s.label || s.code, soumissions: s.count })),
            'repartition-sous-domaines',
          );
        }}
        fullscreenContent={
          <div ref={pieRef}>
            <BreakdownChart data={pieData} height={600} />
          </div>
        }
      >
        <div ref={pieRef}>
          <BreakdownChart data={pieData} height={380} />
        </div>
      </WidgetCard>
    </div>
  );
}
