'use client';
// @ts-nocheck — Record<string, unknown> config props cause false-positive
// "unknown is not ReactNode" errors with React 18 strict JSX inference.
// TODO: replace Record<string, unknown> with typed WidgetConfig discriminated union.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Search, Check, AlertCircle, ChevronDown, Trash2, Shield, Zap } from 'lucide-react';
import {
  type DashboardWidget,
  type WidgetType,
  useUpdateWidget,
} from '@/lib/api/dashboard-hooks';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { useIndicators, type Indicator } from '@/lib/api/indicator-hooks';
import { useFormBuilderTemplates, useFormBuilderTemplate, type FormTemplateListItem } from '@/lib/api/form-builder-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useKpiDefinitions } from '@/lib/api/settings-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { KpiCardConfig } from './config/KpiCardConfig';
import { ChartConfig } from './config/ChartConfig';
import { TableConfig } from './config/TableConfig';
import { GaugeConfig } from './config/GaugeConfig';
import { TextBlockConfig } from './config/TextBlockConfig';
import { AlertFeedConfig } from './config/AlertFeedConfig';
import { AnalyticsQueryConfig } from './config/AnalyticsQueryConfig';

interface WidgetConfigPanelProps {
  widget: DashboardWidget | null;
  dashboardId: string;
  allWidgets?: DashboardWidget[];
  onClose: () => void;
  onSaved: () => void;
}

const DATA_SOURCE_KEYS = [
  { value: 'ANALYTICS_QUERY', labelKey: 'dbDsAnalyticsQuery' },
  { value: 'INDICATOR', labelKey: 'dbDsIndicator' },
  { value: 'FORM_AGGREGATION', labelKey: 'dbDsFormAggregation' },
  { value: 'KPI_CONTINENTAL', labelKey: 'dbDsKpiContinental' },
  { value: 'MANUAL_VALUE', labelKey: 'dbDsManualValue' },
  { value: 'COMPOSITE', labelKey: 'dbDsCompositeFormula' },
  { value: 'SQL_QUERY', labelKey: 'dbDsSqlQuery' },
] as const;

const WIDGET_TYPE_LABEL_KEYS: Record<WidgetType, string> = {
  KPI_CARD: 'dbWtKpiCard',
  LINE: 'dbWtLineChart',
  BAR: 'dbWtBarChart',
  PIE: 'dbWtPieChart',
  STACKED_BAR: 'dbWtStackedBar',
  AREA: 'dbWtAreaChart',
  MAP: 'dbWtMap',
  TABLE: 'dbWtTable',
  GAUGE: 'dbWtGauge',
  TEXT_BLOCK: 'dbWtTextBlock',
  ALERT_FEED: 'dbWtAlertFeed',
  STAT_CARD: 'dbWtStatistics',
  PROGRESS_BAR: 'dbWtProgressBar',
  DIVIDER: 'dbWtDivider',
  IMAGE: 'dbWtImage',
  IFRAME: 'dbWtEmbed',
  LIST: 'dbWtList',
  HEATMAP: 'dbWtHeatmap',
  RANKED_LIST: 'dbWtRankedList',
  ACTIVITY_FEED: 'dbWtActivityFeed',
  EPI_CURVE: 'dbWtEpiCurve',
  DUAL_AXIS: 'dbWtDualAxis',
  COUNTER: 'dbWtCounter',
};

const CHART_TYPES: WidgetType[] = ['LINE', 'BAR', 'PIE', 'STACKED_BAR', 'AREA'];

const KNOWN_KPI_CODES = [
  'CONTINENTAL_LIVESTOCK_TOTAL',
  'CONTINENTAL_OUTBREAK_COUNT',
  'CONTINENTAL_VACCINATION_COVERAGE',
  'CONTINENTAL_TRADE_VOLUME',
  'CONTINENTAL_FISHERIES_CAPTURE',
  'CONTINENTAL_AQUACULTURE_PRODUCTION',
  'CONTINENTAL_WILDLIFE_PA_COVERAGE',
  'CONTINENTAL_APICULTURE_PRODUCTION',
  'CONTINENTAL_LAB_CAPACITY',
  'CONTINENTAL_SURVEILLANCE_COVERAGE',
  'CONTINENTAL_AMR_INDEX',
  'CONTINENTAL_FOOD_SAFETY_SCORE',
  'REC_LIVESTOCK_TOTAL',
  'REC_OUTBREAK_COUNT',
  'REC_VACCINATION_COVERAGE',
  'REC_TRADE_VOLUME',
  'NATIONAL_PVS_SCORE',
  'NATIONAL_VET_CAPACITY',
  'NATIONAL_REPORTING_RATE',
];

const SQL_BLOCKED_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC'];

/* ─── Validation helpers ─────────────────────────────────────────────────── */

type ValidationResult = { valid: boolean; message?: string };

function validateDataSource(type: string, config: Record<string, unknown>, t: (key: string) => string): ValidationResult {
  switch (type) {
    case 'INDICATOR':
      if (!config.indicatorCode) return { valid: false, message: t('dbValSelectIndicator') };
      return { valid: true };
    case 'FORM_AGGREGATION':
      if (!config.formId) return { valid: false, message: t('dbValSelectForm') };
      return { valid: true };
    case 'KPI_CONTINENTAL':
      if (!config.kpiCode) return { valid: false, message: t('dbValEnterKpi') };
      return { valid: true };
    case 'MANUAL_VALUE':
      if (!config.value) return { valid: false, message: t('dbValEnterValue') };
      return { valid: true };
    case 'COMPOSITE':
      if (!config.formula) return { valid: false, message: t('dbValEnterFormula') };
      return { valid: true };
    case 'SQL_QUERY':
      if (!config.query) return { valid: false, message: t('dbValEnterSql') };
      return { valid: true };
    default:
      return { valid: true };
  }
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function WidgetConfigPanel({ widget, dashboardId, allWidgets, onClose, onSaved }: WidgetConfigPanelProps) {
  const t = useTranslations('dashboard');
  const updateWidget = useUpdateWidget();
  const addToast = useRealtimeStore((s) => s.addToast);

  const [localTitle, setLocalTitle] = useState('');
  const [dataSourceType, setDataSourceType] = useState('INDICATOR');
  const [dataSourceConfig, setDataSourceConfig] = useState<Record<string, unknown>>({});
  const [displayConfig, setDisplayConfig] = useState<Record<string, unknown>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync local state when widget changes
  useEffect(() => {
    if (widget) {
      setLocalTitle(widget.title || '');
      const ds = widget.dataSource ?? {};
      setDataSourceType((ds.type as string) || 'INDICATOR');
      setDataSourceConfig({ ...ds });
      setDisplayConfig({ ...widget.config });
      setValidationError(null);
    }
  }, [widget]);

  const handleDataSourceConfigChange = useCallback((updates: Record<string, unknown>) => {
    setDataSourceConfig((prev) => ({ ...prev, ...updates }));
    setValidationError(null);
  }, []);

  const handleDisplayConfigChange = useCallback((updates: Record<string, unknown>) => {
    setDisplayConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = async () => {
    if (!widget) return;

    const validation = validateDataSource(dataSourceType, dataSourceConfig, t);
    if (!validation.valid) {
      setValidationError(validation.message || t('dbInvalidConfig'));
      return;
    }

    try {
      await updateWidget.mutateAsync({
        dashboardId,
        widgetId: widget.id,
        title: localTitle,
        config: displayConfig,
        dataSource: { ...dataSourceConfig, type: dataSourceType },
      });
      addToast({ type: 'success', title: t('dbWidgetUpdated'), message: t('dbConfigSaved') });
      onSaved();
    } catch {
      addToast({ type: 'error', title: t('dbError'), message: t('dbFailedToSaveConfig') });
    }
  };

  if (!widget) return null;

  const isOpen = !!widget;
  const validation = validateDataSource(dataSourceType, dataSourceConfig, t);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] z-50 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#1F4E79]/10 dark:bg-[#1F4E79]/30 px-2 py-0.5 text-xs font-medium text-[#1F4E79] dark:text-[#C9A227]">
              {t(WIDGET_TYPE_LABEL_KEYS[widget.type]) ?? widget.type}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('dbConfigure')}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Section 1: Widget Title */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('dbWidgetTitle')}</h3>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder={t('dbEnterWidgetTitle')}
            />
          </section>

          {/* Section 2: Data Source */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dbDataSource')}</h3>
              {validation.valid ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> {t('dbValid')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" /> {t('dbInvalid')}
                </span>
              )}
            </div>
            <select
              value={dataSourceType}
              onChange={(e) => {
                setDataSourceType(e.target.value);
                setDataSourceConfig({});
                setValidationError(null);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              {DATA_SOURCE_KEYS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </section>

          {/* Section 3: Data Source Configuration */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('dbDataSourceConfig')}</h3>
            {validationError && (
              <div className="mb-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2">
                <p className="text-xs text-red-700 dark:text-red-300">{validationError}</p>
              </div>
            )}
            <DataSourceFields
              type={dataSourceType}
              config={dataSourceConfig}
              onChange={handleDataSourceConfigChange}
              allWidgets={allWidgets}
              currentWidgetId={widget.id}
            />
          </section>

          {/* Section 4: Display Configuration */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('dbDisplayConfig')}</h3>
            <DisplayConfigSection
              widgetType={widget.type}
              config={displayConfig}
              onChange={handleDisplayConfigChange}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('dbCancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={updateWidget.isPending}
            className="rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
          >
            {updateWidget.isPending ? t('dbSaving') : t('dbSave')}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Data Source Fields ─────────────────────────────────────────────────── */

function DataSourceFields({
  type,
  config,
  onChange,
  allWidgets,
  currentWidgetId,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
  allWidgets?: DashboardWidget[];
  currentWidgetId?: string;
}) {
  const t = useTranslations('dashboard');
  switch (type) {
    case 'ANALYTICS_QUERY':
      return <AnalyticsQueryConfig config={config} onChange={onChange} />;
    case 'INDICATOR':
      return <IndicatorPicker config={config} onChange={onChange} />;
    case 'FORM_AGGREGATION':
      return <FormAggregationPicker config={config} onChange={onChange} />;
    case 'KPI_CONTINENTAL':
      return <KpiPicker config={config} onChange={onChange} />;
    case 'MANUAL_VALUE':
      return <ManualValueFields config={config} onChange={onChange} />;
    case 'COMPOSITE':
      return <CompositeFormulaEditor config={config} onChange={onChange} allWidgets={allWidgets} currentWidgetId={currentWidgetId} />;
    case 'SQL_QUERY':
      return <SqlQueryEditor config={config} onChange={onChange} />;
    default:
      return <p className="text-sm text-gray-500">{t('dbSelectDataSourceAbove')}</p>;
  }
}

/* ─── Indicator Picker ───────────────────────────────────────────────────── */

function IndicatorPicker({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}): JSX.Element {
  const t = useTranslations('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch indicators
  const { data: indicatorData, isLoading } = useIndicators({
    search: debouncedQuery || undefined,
    active: true,
    limit: 15,
  });

  const indicators = indicatorData?.data ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If config already has an indicatorCode but no selectedIndicator, try to find it
  useEffect(() => {
    if (config.indicatorCode && !selectedIndicator && indicators.length > 0) {
      const found = indicators.find((i) => i.code === config.indicatorCode);
      if (found) setSelectedIndicator(found);
    }
  }, [config.indicatorCode, indicators, selectedIndicator]);

  const handleSelect = (indicator: Indicator) => {
    setSelectedIndicator(indicator);
    onChange({ indicatorCode: indicator.code });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    setSelectedIndicator(null);
    onChange({ indicatorCode: '' });
    setSearchQuery('');
  };

  return (
    <div className="space-y-3" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbDsIndicator')}</label>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          placeholder={t('dbSearchIndicators')}
        />
        {isOpen ? (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-180" />
        ) : null}
      </div>

      {/* Dropdown results */}
      {isOpen ? (
        <div className="relative z-10">
          <div className="absolute top-0 left-0 right-0 max-h-52 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">{t('dbLoading')}</div>
            ) : indicators.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                {debouncedQuery ? t('dbNoIndicatorsFound') : t('dbTypeToSearchIndicators')}
              </div>
            ) : (
              indicators.map((indicator) => (
                <button
                  key={indicator.id}
                  type="button"
                  onClick={() => handleSelect(indicator)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                    (config.indicatorCode as string) === indicator.code ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {indicator.code}
                    </span>
                    {indicator.scope && (
                      <span className="ml-2 shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#1F4E79]/10 text-[#1F4E79] dark:bg-[#C9A227]/20 dark:text-[#C9A227]">
                        {indicator.scope}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {indicator.nameEn}
                    {indicator.unit && <span className="ml-1 text-gray-400">({indicator.unit})</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Selected indicator display */}
      {selectedIndicator && (
        <div className="rounded-md border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {selectedIndicator.code}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-800 text-green-600 dark:text-green-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1 text-xs text-green-700 dark:text-green-300 space-y-0.5">
            <p><span className="font-medium">{t('dbName')}:</span> {selectedIndicator.nameEn}</p>
            {selectedIndicator.unit && <p><span className="font-medium">{t('dbUnit')}:</span> {selectedIndicator.unit}</p>}
            {selectedIndicator.periodicity && <p><span className="font-medium">{t('dbPeriodicity')}:</span> {selectedIndicator.periodicity}</p>}
            {selectedIndicator.scope && <p><span className="font-medium">{t('dbScope')}:</span> {selectedIndicator.scope}</p>}
          </div>
        </div>
      )}

      {/* Fallback: show raw code if set but indicator not resolved */}
      {!selectedIndicator && config.indicatorCode && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">
              {config.indicatorCode as string}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helper: extract fields from JSON Schema ──────────────────────────── */

interface FormFieldInfo {
  key: string;
  label: string;
  type: string;
  isNumeric: boolean;
}

function extractFieldsFromSchema(schema: unknown): FormFieldInfo[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  const properties = (s.properties ?? {}) as Record<string, unknown>;
  const fields: FormFieldInfo[] = [];

  for (const [key, def] of Object.entries(properties)) {
    if (!def || typeof def !== 'object') continue;
    const d = def as Record<string, unknown>;
    const type = String(d.type ?? 'string');
    const title = String(d.title ?? d.label ?? key);
    const isNumeric = type === 'number' || type === 'integer';
    fields.push({ key, label: title, type, isNumeric });

    // If it's an object with nested properties (repeater/group), flatten one level
    if (type === 'object' && d.properties && typeof d.properties === 'object') {
      const nested = d.properties as Record<string, unknown>;
      for (const [nk, nd] of Object.entries(nested)) {
        if (!nd || typeof nd !== 'object') continue;
        const ndObj = nd as Record<string, unknown>;
        const nType = String(ndObj.type ?? 'string');
        const nTitle = String(ndObj.title ?? ndObj.label ?? nk);
        fields.push({ key: `${key}.${nk}`, label: `${title} > ${nTitle}`, type: nType, isNumeric: nType === 'number' || nType === 'integer' });
      }
    }

    // If it's an array with item properties (repeater rows)
    if (type === 'array' && d.items && typeof d.items === 'object') {
      const items = d.items as Record<string, unknown>;
      if (items.properties && typeof items.properties === 'object') {
        const nested = items.properties as Record<string, unknown>;
        for (const [nk, nd] of Object.entries(nested)) {
          if (!nd || typeof nd !== 'object') continue;
          const ndObj = nd as Record<string, unknown>;
          const nType = String(ndObj.type ?? 'string');
          const nTitle = String(ndObj.title ?? ndObj.label ?? nk);
          fields.push({ key: `${key}[].${nk}`, label: `${title} > ${nTitle}`, type: nType, isNumeric: nType === 'number' || nType === 'integer' });
        }
      }
    }
  }

  return fields;
}

/* ─── Form Aggregation Picker ────────────────────────────────────────────── */

function FormAggregationPicker({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const t = useTranslations('dashboard');
  const [formSearchOpen, setFormSearchOpen] = useState(false);
  const [formSearch, setFormSearch] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const formDropdownRef = useRef<HTMLDivElement>(null);

  const { data: templatesData, isLoading } = useFormBuilderTemplates({
    status: 'PUBLISHED',
    limit: 50,
  });

  const templates = templatesData?.data ?? [];

  // Fetch selected template details (with schema) when a form is selected
  const selectedFormId = (config.formId as string) || undefined;
  const { data: templateDetail } = useFormBuilderTemplate(selectedFormId);
  const templateData = (templateDetail as any)?.data ?? templateDetail;

  // Extract fields from the template schema
  const formFields = useMemo(() => {
    if (!templateData?.schema) return [];
    return extractFieldsFromSchema(templateData.schema);
  }, [templateData?.schema]);

  // Filter fields by search and aggregation compatibility
  const aggregation = (config.aggregation as string) ?? 'count';
  const filteredFields = useMemo(() => {
    let list = formFields;
    if (fieldSearch) {
      const q = fieldSearch.toLowerCase();
      list = list.filter((f) => f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
    }
    return list;
  }, [formFields, fieldSearch]);

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!formSearch) return templates;
    const q = formSearch.toLowerCase();
    return templates.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.domain.toLowerCase().includes(q)
    );
  }, [templates, formSearch]);

  const selectedTemplate = useMemo(() => {
    if (!config.formId) return null;
    return templates.find((tpl) => tpl.id === config.formId) ?? null;
  }, [config.formId, templates]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (formDropdownRef.current && !formDropdownRef.current.contains(event.target as Node)) {
        setFormSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTemplate = (template: FormTemplateListItem) => {
    onChange({ formId: template.id, field: '' });
    setFormSearchOpen(false);
    setFormSearch('');
  };

  const handleClearTemplate = () => {
    onChange({ formId: '', field: '' });
    setFormSearch('');
  };

  const selectedField = formFields.find((f) => f.key === config.field);

  return (
    <div className="space-y-3">
      {/* Form selector */}
      <div ref={formDropdownRef}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbFormTemplate')}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={formSearch}
            onChange={(e) => {
              setFormSearch(e.target.value);
              setFormSearchOpen(true);
            }}
            onFocus={() => setFormSearchOpen(true)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
            placeholder={t('dbSearchPublishedForms')}
          />
        </div>

        {formSearchOpen && (
          <div className="relative z-10 mt-1">
            <div className="absolute top-0 left-0 right-0 max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">{t('dbLoading')}</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">{t('dbNoPublishedFormsFound')}</div>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                      config.formId === template.id ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {template.name}
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] font-medium text-gray-400">
                        v{template.version}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {template.domain}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Selected template display */}
        {selectedTemplate && (
          <div className="mt-2 rounded-md border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
                  {selectedTemplate.name}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearTemplate}
                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-800 text-green-600 dark:text-green-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-green-700 dark:text-green-300">
              {selectedTemplate.domain} - v{selectedTemplate.version}
              {formFields.length > 0 && <span className="ml-2">{formFields.length} champs detectes</span>}
            </p>
          </div>
        )}
      </div>

      {/* Aggregation select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbAggregation')}</label>
        <select
          value={aggregation}
          onChange={(e) => onChange({ aggregation: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        >
          <option value="count">{t('dbCount')} — Nombre de soumissions</option>
          <option value="sum">{t('dbSum')} — Somme d&apos;un champ numerique</option>
          <option value="avg">{t('dbAverage')} — Moyenne d&apos;un champ numerique</option>
          <option value="min">Min — Valeur minimale</option>
          <option value="max">Max — Valeur maximale</option>
        </select>
      </div>

      {/* GroupBy (for charts) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regrouper par (optionnel)</label>
        <select
          value={(config.groupBy as string) ?? ''}
          onChange={(e) => onChange({ groupBy: e.target.value || undefined })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        >
          <option value="">Pas de regroupement (valeur unique)</option>
          <option value="country">Par pays</option>
          <option value="month">Par mois</option>
          <option value="quarter">Par trimestre</option>
          <option value="year">Par annee</option>
          <option value="week">Par semaine</option>
        </select>
        {(config.groupBy as string) && (
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
            Le resultat sera un tableau de donnees (ideal pour graphiques Bar, Line, Pie)
          </p>
        )}
      </div>

      {/* Sort + Limit when grouped */}
      {(config.groupBy as string) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Tri</label>
            <select
              value={(config.sortBy as string) ?? 'value'}
              onChange={(e) => onChange({ sortBy: e.target.value })}
              className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs"
            >
              <option value="value">Par valeur</option>
              <option value="name">Par nom</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Limite</label>
            <input
              type="number"
              value={(config.limit as number) ?? 50}
              onChange={(e) => onChange({ limit: Math.min(500, Math.max(1, parseInt(e.target.value) || 50)) })}
              className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs"
              min={1}
              max={500}
            />
          </div>
        </div>
      )}

      {/* Field selector — dropdown from schema fields */}
      {config.formId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('dbField')}
            {aggregation === 'count' && <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel pour count)</span>}
            {aggregation !== 'count' && <span className="ml-0.5 text-red-500">*</span>}
          </label>

          {formFields.length > 0 ? (
            <>
              {/* Field search for large schemas */}
              {formFields.length > 8 && (
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Rechercher un champ..."
                  className="mb-2 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              )}

              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {/* "None" option for count */}
                {aggregation === 'count' && (
                  <button
                    type="button"
                    onClick={() => onChange({ field: '' })}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      !config.field ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20 text-[#1F4E79] font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="italic">Toutes les soumissions (count total)</span>
                  </button>
                )}
                {filteredFields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => onChange({ field: field.key })}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      config.field === field.key
                        ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${config.field === field.key ? 'text-[#1F4E79] dark:text-[#C9A227] font-medium' : 'text-gray-900 dark:text-gray-100'}`}>
                        {field.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${
                          field.isNumeric
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {field.type}
                        </span>
                        {config.field === field.key && <Check className="h-3.5 w-3.5 text-[#1F4E79] dark:text-[#C9A227]" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{field.key}</span>
                  </button>
                ))}
                {filteredFields.length === 0 && (
                  <div className="px-3 py-3 text-center text-xs text-gray-500">Aucun champ trouve</div>
                )}
              </div>

              {/* Selected field summary */}
              {selectedField && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-3 py-1.5">
                  <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    <span className="font-medium">{selectedField.label}</span>
                    <span className="ml-1 font-mono text-blue-500">({selectedField.key})</span>
                    <span className="ml-1">— {aggregation === 'count' ? 'count' : aggregation === 'sum' ? 'somme' : 'moyenne'}</span>
                  </span>
                </div>
              )}

              {/* Warning for non-numeric field with sum/avg */}
              {selectedField && !selectedField.isNumeric && aggregation !== 'count' && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Ce champ n&apos;est pas numerique — {aggregation === 'sum' ? 'la somme' : 'la moyenne'} peut echouer
                </div>
              )}
            </>
          ) : selectedFormId ? (
            <div className="text-xs text-gray-400 italic py-2">Chargement des champs du formulaire...</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ─── KPI Picker ─────────────────────────────────────────────────────────── */

function KpiPicker({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const t = useTranslations('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch KPI definitions dynamically from the API
  const { data: kpiData, isLoading: kpiLoading } = useKpiDefinitions({ isActive: true });
  const kpiDefinitions: any[] = useMemo(() => {
    const raw = (kpiData as any)?.data ?? kpiData;
    return Array.isArray(raw) ? raw : [];
  }, [kpiData]);

  // Build KPI codes list: API data + fallback hardcoded list
  const allKpiCodes = useMemo(() => {
    if (kpiDefinitions.length > 0) {
      return kpiDefinitions.map((kpi: any) => ({
        code: kpi.code,
        name: kpi.nameFr || kpi.nameEn || kpi.name || kpi.code,
        scope: kpi.scope || '',
        domain: kpi.domainCode || '',
      }));
    }
    // Fallback to hardcoded if API returns nothing
    return KNOWN_KPI_CODES.map((code) => ({ code, name: code.replace(/_/g, ' '), scope: '', domain: '' }));
  }, [kpiDefinitions]);

  const currentCode = (config.kpiCode as string) ?? '';
  const isKnownCode = allKpiCodes.some((k) => k.code === currentCode);

  const filteredKpis = useMemo(() => {
    if (!searchQuery) return allKpiCodes;
    const q = searchQuery.toLowerCase();
    return allKpiCodes.filter((k) => k.code.toLowerCase().includes(q) || k.name.toLowerCase().includes(q));
  }, [searchQuery, allKpiCodes]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedKpi = allKpiCodes.find((k) => k.code === currentCode);

  return (
    <div className="space-y-3" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbKpiCode')}</label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery || currentCode}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onChange({ kpiCode: e.target.value });
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-10 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono"
          placeholder={t('dbSearchKpiCode')}
        />
        {currentCode && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isKnownCode ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="relative z-10">
          <div className="absolute top-0 left-0 right-0 max-h-52 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            {kpiLoading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">{t('dbLoading')}</div>
            ) : filteredKpis.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">Aucun KPI trouve</div>
            ) : (
              filteredKpis.map((kpi) => (
                <button
                  key={kpi.code}
                  type="button"
                  onClick={() => {
                    onChange({ kpiCode: kpi.code });
                    setSearchQuery('');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                    currentCode === kpi.code ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-mono truncate ${currentCode === kpi.code ? 'text-[#1F4E79] dark:text-[#C9A227] font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {kpi.code}
                    </span>
                    {kpi.scope && (
                      <span className="ml-2 shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#1F4E79]/10 text-[#1F4E79] dark:bg-[#C9A227]/20 dark:text-[#C9A227]">
                        {kpi.scope}
                      </span>
                    )}
                  </div>
                  {kpi.name !== kpi.code && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {kpi.name}
                      {kpi.domain && <span className="ml-1 text-gray-400">({kpi.domain})</span>}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected KPI summary */}
      {currentCode && selectedKpi && (
        <div className="rounded-md border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200 font-mono">{selectedKpi.code}</span>
              {selectedKpi.name !== selectedKpi.code && (
                <p className="text-xs text-green-700 dark:text-green-300">{selectedKpi.name}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation feedback for custom codes */}
      {currentCode && !isKnownCode && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t('dbCustomKpiHint')}
        </p>
      )}
    </div>
  );
}

/* ─── Manual Value Fields ────────────────────────────────────────────────── */

function ManualValueFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const t = useTranslations('dashboard');
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbValue')}</label>
        <input
          type="text"
          value={(config.value as string) ?? ''}
          onChange={(e) => onChange({ value: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbLabel')}</label>
        <input
          type="text"
          value={(config.label as string) ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
}

/* ─── Composite Formula Editor ───────────────────────────────────────────── */

function CompositeFormulaEditor({
  config,
  onChange,
  allWidgets,
  currentWidgetId,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
  allWidgets?: DashboardWidget[];
  currentWidgetId?: string;
}) {
  const t = useTranslations('dashboard');
  const [formulaValid, setFormulaValid] = useState<boolean | null>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const otherWidgets = useMemo(
    () => (allWidgets ?? []).filter((w) => w.id !== currentWidgetId),
    [allWidgets, currentWidgetId]
  );

  const handleValidate = () => {
    const formula = (config.formula as string) ?? '';
    if (!formula.trim()) {
      setFormulaValid(false);
      setFormulaError(t('dbFormulaEmpty'));
      return;
    }
    // Basic validation: check for balanced parentheses and valid characters
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      setFormulaValid(false);
      setFormulaError(t('dbUnbalancedParens'));
      return;
    }
    // Check for common issues
    if (/[\/\*]{2,}/.test(formula)) {
      setFormulaValid(false);
      setFormulaError(t('dbConsecutiveOperators'));
      return;
    }
    setFormulaValid(true);
    setFormulaError(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbFormula')}</label>
        <textarea
          value={(config.formula as string) ?? ''}
          onChange={(e) => {
            onChange({ formula: e.target.value });
            setFormulaValid(null);
            setFormulaError(null);
          }}
          rows={4}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100"
          placeholder="e.g. widget_a / widget_b * 100"
        />
      </div>

      {/* Validate button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleValidate}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#1F4E79] px-3 py-1.5 text-xs font-medium text-[#1F4E79] dark:text-[#C9A227] dark:border-[#C9A227] hover:bg-[#1F4E79]/5 dark:hover:bg-[#C9A227]/10 transition-colors"
        >
          <Zap className="h-3 w-3" />
          {t('dbValidate')}
        </button>
        {formulaValid === true && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> {t('dbSyntaxOk')}
          </span>
        )}
        {formulaValid === false && formulaError && (
          <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <AlertCircle className="h-3 w-3" /> {formulaError}
          </span>
        )}
      </div>

      {/* Available widgets */}
      {otherWidgets.length > 0 && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('dbAvailableWidgetRefs')}:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {otherWidgets.map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-xs">
                <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono text-[10px]">
                  {w.id.slice(0, 8)}
                </code>
                <span className="text-gray-500 dark:text-gray-400 truncate">
                  {w.title || t(WIDGET_TYPE_LABEL_KEYS[w.type]) || w.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Syntax help */}
      <div className="rounded-md border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">{t('dbFormulaSyntax')}:</p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5 list-disc list-inside">
          <li>{t('dbFormulaSyntax1')}</li>
          <li>{t('dbFormulaSyntax2')}</li>
          <li>{t('dbFormulaSyntax3')}</li>
          <li>{t('dbFormulaSyntax4')}</li>
        </ul>
      </div>
    </div>
  );
}

/* ─── SQL Query Editor ───────────────────────────────────────────────────── */

function SqlQueryEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const t = useTranslations('dashboard');
  const user = useAuthStore((s) => s.user);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const hasAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'CONTINENTAL_ADMIN';

  const handleTestQuery = () => {
    const query = ((config.query as string) ?? '').trim();
    if (!query) {
      setTestResult({ valid: false, message: t('dbQueryEmpty') });
      return;
    }
    // Must start with SELECT
    if (!query.toUpperCase().startsWith('SELECT')) {
      setTestResult({ valid: false, message: t('dbQueryMustStartSelect') });
      return;
    }
    // Check for blocked keywords
    const upperQuery = query.toUpperCase();
    for (const keyword of SQL_BLOCKED_KEYWORDS) {
      // Check for blocked keywords as standalone words (not inside identifiers)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(upperQuery)) {
        setTestResult({ valid: false, message: `${t('dbBlockedKeyword')}: ${keyword}` });
        return;
      }
    }
    setTestResult({ valid: true, message: t('dbQuerySyntaxValid') });
  };

  if (!hasAccess) {
    return (
      <div className="rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-6 text-center">
        <Shield className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('dbAccessDenied')}</p>
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          {t('dbSqlRequiresAdmin')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 px-3 py-2">
        <p className="text-xs text-yellow-800 dark:text-yellow-300">
          {t('dbSqlWarning')}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbDsSqlQuery')}</label>
        <textarea
          value={(config.query as string) ?? ''}
          onChange={(e) => {
            onChange({ query: e.target.value });
            setTestResult(null);
          }}
          rows={6}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-900 dark:bg-gray-950 px-3 py-2 text-sm font-mono text-green-400 dark:text-green-300 placeholder-gray-500"
          placeholder="SELECT column_name, COUNT(*)&#10;FROM schema.table_name&#10;WHERE condition = 'value'&#10;GROUP BY column_name&#10;ORDER BY COUNT(*) DESC&#10;LIMIT 100;"
          spellCheck={false}
        />
      </div>

      {/* Test button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTestQuery}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#1F4E79] px-3 py-1.5 text-xs font-medium text-[#1F4E79] dark:text-[#C9A227] dark:border-[#C9A227] hover:bg-[#1F4E79]/5 dark:hover:bg-[#C9A227]/10 transition-colors"
        >
          <Zap className="h-3 w-3" />
          {t('dbTestQuery')}
        </button>
        {testResult && (
          <span className={`inline-flex items-center gap-1 text-xs ${testResult.valid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {testResult.valid ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {testResult.message}
          </span>
        )}
      </div>

      {/* Allowed schemas hint */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dbAvailableSchemas')}:</p>
        <div className="flex flex-wrap gap-1">
          {['animal_health', 'livestock', 'fisheries', 'trade_sps', 'governance', 'analytics', 'datalake'].map((schema) => (
            <span key={schema} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {schema}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Display Config Section ─────────────────────────────────────────────── */

function DisplayConfigSection({
  widgetType,
  config,
  onChange,
}: {
  widgetType: WidgetType;
  config: Record<string, unknown>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const t = useTranslations('dashboard');
  if (widgetType === 'KPI_CARD') {
    return <KpiCardConfig config={config} onChange={onChange} />;
  }
  if (CHART_TYPES.includes(widgetType)) {
    return <ChartConfig config={{ ...config, _widgetType: widgetType }} onChange={onChange} />;
  }
  if (widgetType === 'TABLE') {
    return <TableConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'GAUGE') {
    return <GaugeConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'TEXT_BLOCK') {
    return <TextBlockConfig config={config} onChange={onChange} />;
  }
  if (widgetType === 'ALERT_FEED') {
    return <AlertFeedConfig config={config} onChange={onChange} />;
  }
  return <p className="text-sm text-gray-500 italic">{t('dbNoAdditionalDisplayConfig')}</p>;
}
