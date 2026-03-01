'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Settings, Download, RefreshCw, Clock,
  TrendingUp, BarChart3, Map as MapIcon,
  LayoutGrid, Layers, Maximize, Minimize,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardFilterProvider, useDashboardFilters } from './GlobalFilterContext';
import { DashboardFilterPanel } from './DashboardFilterPanel';
import { DashboardKpiBar } from './DashboardKpiBar';
import { DashboardSynthetic } from './DashboardSynthetic';

// Widget imports
import { ChartLineWidget } from './widgets/ChartLineWidget';
import { ChartBarWidget } from './widgets/ChartBarWidget';
import { ChartPieWidget } from './widgets/ChartPieWidget';
import { ChartHeatmapWidget } from './widgets/ChartHeatmapWidget';
import { TableAlertsWidget } from './widgets/TableAlertsWidget';
import { TableRankedWidget } from './widgets/TableRankedWidget';
import { MetricActivityWidget } from './widgets/MetricActivityWidget';
import { HealthEpiCurveWidget } from './widgets/HealthEpiCurveWidget';
import { HealthRainfallWidget } from './widgets/HealthRainfallWidget';

// Demo data
import {
  DEMO_KPIS,
  DEMO_COUNTRY_DATA,
  DEMO_MONTHLY_TRENDS,
  DEMO_DISEASES,
  DEMO_ALERTS,
  DEMO_HEATMAP_DATA,
  DEMO_EPI_CURVE,
  DEMO_RAINFALL,
  DEMO_ACTIVITIES,
  filterCountryData,
} from './demo-data';

// Leaflet-based map must be dynamic (no SSR)
const ChoroplethMap = dynamic(
  () => import('./maps/ChoroplethMap').then((m) => m.ChoroplethMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 animate-pulse" style={{ height: 520 }}>
        <div className="flex items-center justify-center h-full text-gray-400">
          <MapIcon className="h-8 w-8 animate-pulse" />
        </div>
      </div>
    ),
  },
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  VIEW MODE TOGGLE                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

type ViewMode = 'synthetic' | 'detailed';

/** Dashboard title icon: AU logo in fullscreen, BarChart3 icon otherwise */
function TitleIcon({ isFullscreen, size = 'md' }: { isFullscreen: boolean; size?: 'sm' | 'md' }) {
  if (isFullscreen) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/au-logo.png"
        alt="AU-IBAR"
        className={cn(
          'flex-shrink-0 object-contain',
          size === 'sm' ? 'h-5 w-5' : 'h-6 w-6',
        )}
      />
    );
  }
  return (
    <BarChart3
      className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'}
      style={{ color: 'var(--color-accent)' }}
    />
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
      <button
        onClick={() => onChange('synthetic')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
          mode === 'synthetic'
            ? 'text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
        )}
        style={mode === 'synthetic' ? { backgroundColor: 'var(--color-accent)' } : undefined}
        title="Synthetic view — everything on one screen"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Synthetic</span>
      </button>
      <button
        onClick={() => onChange('detailed')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
          mode === 'detailed'
            ? 'text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
        )}
        style={mode === 'detailed' ? { backgroundColor: 'var(--color-accent)' } : undefined}
        title="Detailed view — scrollable with full widgets"
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Detailed</span>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  DASHBOARD CONTENT (orchestrator)                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function DashboardContent() {
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [activePage, setActivePage] = useState('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('synthetic');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useDashboardFilters();

  const handleCountryClick = useCallback((code: string) => {
    setFilter('country', code);
  }, [setFilter]);

  /* ── Fullscreen API ───────────────────────────────────────────────────── */

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await dashboardRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported or denied
    }
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Apply filters to demo data
  const filteredCountryData = filterCountryData(DEMO_COUNTRY_DATA, {
    rec: filters.rec,
    country: filters.country,
  });

  // Top countries by submissions (for ranked table)
  const topCountries = [...filteredCountryData]
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 10);
  const maxSubmissions = topCountries[0]?.submissions ?? 1;
  const rankedRows = topCountries.map((c, i) => ({
    rank: i + 1,
    label: c.name,
    value: c.submissions,
    formattedValue: c.submissions.toLocaleString(),
    barPercent: (c.submissions / maxSubmissions) * 100,
  }));

  // Disease distribution for pie chart
  const diseaseForPie = DEMO_DISEASES.map((d) => ({
    name: d.code,
    value: d.cases,
    color: d.color,
  }));

  // Filtered alerts
  const filteredAlerts = filters.country !== 'all'
    ? DEMO_ALERTS.filter((a) => a.countryCode === filters.country)
    : DEMO_ALERTS;

  // Scope label
  const scopeLabel = filters.country !== 'all'
    ? DEMO_COUNTRY_DATA.find((c) => c.code === filters.country)?.name ?? filters.country
    : filters.rec !== 'all'
      ? filters.rec.toUpperCase()
      : 'Continental';

  /* ── Synthetic mode: full-screen, no filter panel, no header chrome ───── */

  if (viewMode === 'synthetic') {
    return (
      <div ref={dashboardRef} className={cn('flex h-full', isFullscreen && 'bg-slate-50 dark:bg-gray-950')}>
        {/* Thin collapsed filter panel */}
        <DashboardFilterPanel
          collapsed={!filterPanelOpen}
          onToggle={() => setFilterPanelOpen((p) => !p)}
          activePage={activePage}
          onPageChange={setActivePage}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {/* Compact header with view toggle */}
          <div className="flex-shrink-0 flex items-center justify-between bg-slate-50/95 dark:bg-gray-950/95 border-b border-gray-200/80 dark:border-gray-800 px-4 py-1.5">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TitleIcon isFullscreen={isFullscreen} size="sm" />
              ARIS — {scopeLabel} Dashboard
            </h1>
            <div className="flex items-center gap-2">
              <ViewToggle mode={viewMode} onChange={setViewMode} />
              <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Export PDF">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Synthetic dashboard fills remaining space */}
          <div className="flex-1 min-h-0">
            <DashboardSynthetic />
          </div>
        </div>
      </div>
    );
  }

  /* ── Detailed mode: scrollable with full widgets ──────────────────────── */

  return (
    <div ref={dashboardRef} className={cn('flex h-full', isFullscreen && 'bg-slate-50 dark:bg-gray-950')}>
      {/* Left Filter Panel */}
      <DashboardFilterPanel
        collapsed={!filterPanelOpen}
        onToggle={() => setFilterPanelOpen((p) => !p)}
        activePage={activePage}
        onPageChange={setActivePage}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Dashboard Header */}
        <div className="sticky top-0 z-20 bg-slate-50/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-200/80 dark:border-gray-800 px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TitleIcon isFullscreen={isFullscreen} />
                {activePage === 'overview' ? 'Overview' : activePage.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
                  — {scopeLabel} Dashboard
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle mode={viewMode} onChange={setViewMode} />
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-400">
                <Clock className="h-3 w-3" />
                Auto-refresh: 5m
                <RefreshCw className="h-3 w-3 ml-1" />
              </span>
              <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Export PDF">
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
              <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Settings">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="px-5 py-5 space-y-5">
          {/* KPI Bar */}
          <DashboardKpiBar kpis={DEMO_KPIS} />

          {activePage === 'overview' && (
            <OverviewGrid
              filteredCountryData={filteredCountryData}
              onCountryClick={handleCountryClick}
              filteredAlerts={filteredAlerts}
              diseaseForPie={diseaseForPie}
              rankedRows={rankedRows}
              selectedRec={filters.rec}
              selectedCountry={filters.country}
            />
          )}

          {activePage === 'trends' && (
            <TrendsGrid />
          )}

          {activePage === 'alerts' && (
            <AlertsGrid alerts={filteredAlerts} />
          )}

          {/* Default: show overview for unimplemented pages */}
          {!['overview', 'trends', 'alerts'].includes(activePage) && (
            <OverviewGrid
              filteredCountryData={filteredCountryData}
              onCountryClick={handleCountryClick}
              filteredAlerts={filteredAlerts}
              diseaseForPie={diseaseForPie}
              rankedRows={rankedRows}
              selectedRec={filters.rec}
              selectedCountry={filters.country}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Grid ──────────────────────────────────────────────────────────

function OverviewGrid({
  filteredCountryData,
  onCountryClick,
  filteredAlerts,
  diseaseForPie,
  rankedRows,
  selectedRec,
  selectedCountry,
}: {
  filteredCountryData: any[];
  onCountryClick: (code: string) => void;
  filteredAlerts: any[];
  diseaseForPie: any[];
  rankedRows: any[];
  selectedRec?: string;
  selectedCountry?: string;
}) {
  return (
    <>
      {/* Row 2: Map + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ChoroplethMap
            title="Continental Outbreak Map"
            subtitle="Active outbreaks by country"
            data={filteredCountryData}
            onCountryClick={onCountryClick}
            demo
            selectedRec={selectedRec}
            selectedCountry={selectedCountry}
          />
        </div>
        <div>
          <TableAlertsWidget
            title="Active Alerts"
            subtitle="Recent disease alerts"
            alerts={filteredAlerts}
            demo
          />
        </div>
      </div>

      {/* Row 3: Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartLineWidget
          title="Outbreak Trend"
          subtitle="Monthly outbreaks — last 12 months"
          data={DEMO_MONTHLY_TRENDS}
          lines={[
            { dataKey: 'outbreaks', label: 'Outbreaks', color: '#ef4444', type: 'area' },
            { dataKey: 'submissions', label: 'Submissions', color: '#3b82f6' },
          ]}
          area
          demo
        />
        <ChartBarWidget
          title="Cases by Disease"
          subtitle="Top 10 diseases by reported cases"
          data={DEMO_DISEASES.map((d) => ({ name: d.code, cases: d.cases, color: d.color }))}
          bars={[{ dataKey: 'cases', label: 'Cases', color: '#3b82f6' }]}
          xKey="name"
          horizontal
          showValues
          demo
        />
      </div>

      {/* Row 4: Pie + Ranked table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartPieWidget
          title="Disease Distribution"
          subtitle="Cases by disease type"
          data={diseaseForPie}
          donut
          demo
        />
        <TableRankedWidget
          title="Top Countries by Submissions"
          subtitle="Data collection activity ranking"
          rows={rankedRows}
          demo
        />
      </div>

      {/* Row 5: Heatmap + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartHeatmapWidget
          title="Monthly Activity Heatmap"
          subtitle="Submissions by country × month"
          data={DEMO_HEATMAP_DATA}
          demo
        />
        <MetricActivityWidget
          title="Recent Activity"
          subtitle="Latest system events"
          activities={DEMO_ACTIVITIES}
          demo
        />
      </div>

      {/* Row 6: Epi Curve + Rainfall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HealthEpiCurveWidget
          title="Epi Curve — FMD"
          subtitle="Weekly cases, deaths & 4-week moving average"
          data={DEMO_EPI_CURVE}
          demo
        />
        <HealthRainfallWidget
          title="Rainfall vs RVF Cases"
          subtitle="Monthly precipitation and Rift Valley Fever correlation"
          data={DEMO_RAINFALL}
          demo
        />
      </div>
    </>
  );
}

// ─── Trends Grid ────────────────────────────────────────────────────────────

function TrendsGrid() {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartLineWidget
          title="Outbreak Trend"
          subtitle="Outbreaks, cases, and deaths over 12 months"
          data={DEMO_MONTHLY_TRENDS}
          lines={[
            { dataKey: 'outbreaks', label: 'Outbreaks', color: '#ef4444' },
            { dataKey: 'cases', label: 'Cases', color: '#f97316' },
            { dataKey: 'deaths', label: 'Deaths', color: '#6b7280' },
          ]}
          demo
        />
        <ChartLineWidget
          title="Vaccination Trend"
          subtitle="Monthly vaccinations administered"
          data={DEMO_MONTHLY_TRENDS}
          lines={[
            { dataKey: 'vaccinations', label: 'Vaccinations', color: '#22c55e', type: 'area' },
          ]}
          area
          demo
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartBarWidget
          title="Submissions per Month"
          subtitle="Data collection volume over time"
          data={DEMO_MONTHLY_TRENDS}
          bars={[{ dataKey: 'submissions', label: 'Submissions', color: 'var(--color-accent, #006B3F)' }]}
          xKey="label"
          demo
        />
        <ChartHeatmapWidget
          title="Country × Month Heatmap"
          subtitle="Submission intensity matrix"
          data={DEMO_HEATMAP_DATA}
          demo
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HealthEpiCurveWidget
          title="Epi Curve — FMD"
          subtitle="52-week epidemiological curve"
          data={DEMO_EPI_CURVE}
          demo
        />
        <HealthRainfallWidget
          title="Rainfall vs RVF"
          subtitle="Climate–disease correlation"
          data={DEMO_RAINFALL}
          demo
        />
      </div>
    </>
  );
}

// ─── Alerts Grid ────────────────────────────────────────────────────────────

function AlertsGrid({ alerts }: { alerts: any[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <TableAlertsWidget
        title="All Active Alerts"
        subtitle="Disease alerts across the continent"
        alerts={alerts.length > 0 ? alerts : DEMO_ALERTS}
        demo
      />
      <MetricActivityWidget
        title="Alert-Related Activity"
        subtitle="Recent actions on alerts"
        activities={DEMO_ACTIVITIES.filter((a) => a.type === 'alert' || a.type === 'validation')}
        demo
      />
    </div>
  );
}

// ─── Main Export (with Provider) ────────────────────────────────────────────

export function DashboardPage() {
  return (
    <DashboardFilterProvider>
      <DashboardContent />
    </DashboardFilterProvider>
  );
}
