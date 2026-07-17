'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Check, AlertCircle, ChevronDown, Database, BarChart3, Filter, ArrowUpDown, Zap } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderTemplates, type FormTemplateListItem } from '@/lib/api/form-builder-hooks';
import { useQueryCatalogue, type QueryCatalogueData } from '@/lib/api/dashboard-hooks';

interface AnalyticsQueryConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

export function AnalyticsQueryConfig({ config, onChange }: AnalyticsQueryConfigProps) {
  const t = useTranslations('dashboard');
  const { data: catalogueRaw } = useQueryCatalogue();
  const catalogue = (catalogueRaw as any)?.data as QueryCatalogueData | undefined;

  const queryType = (config.queryType as string) || '';
  const domain = (config.domain as string) || '';
  const groupBy = (config.groupBy as string) || '';
  const metric = (config.metric as string) || 'count';
  const field = (config.field as string) || '';
  const sort = (config.sort as string) || 'value_desc';
  const limit = (config.limit as number) || 50;
  const formId = ((config.filters as any)?.formId as string) || '';

  const selectedQueryType = useMemo(
    () => catalogue?.queryTypes.find((qt) => qt.code === queryType),
    [catalogue, queryType],
  );

  // Form templates for form-based query types
  const needsForm = queryType === 'form_field_distribution' || queryType === 'form_time_series';
  const { data: templatesData } = useFormBuilderTemplates({ status: 'PUBLISHED', limit: 50 });
  const templates = templatesData?.data ?? [];

  const handleQueryTypeChange = (code: string) => {
    const qt = catalogue?.queryTypes.find((q) => q.code === code);
    onChange({
      queryType: code,
      groupBy: qt?.groupBy?.[0] || '',
      domain: '',
      metric: 'count',
      field: '',
      sort: 'value_desc',
      limit: 50,
      filters: {},
    });
  };

  if (!catalogue) {
    return <div className="text-sm text-gray-500 animate-pulse py-4 text-center">{t('dbLoading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Query Type ── */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Database className="h-3.5 w-3.5" />
          Type de requete
        </label>
        <div className="space-y-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {catalogue.queryTypes.map((qt) => (
            <button
              key={qt.code}
              type="button"
              onClick={() => handleQueryTypeChange(qt.code)}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                queryType === qt.code
                  ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  queryType === qt.code
                    ? 'text-[#1F4E79] dark:text-[#C9A227]'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {qt.labelFr}
                </span>
                {queryType === qt.code && <Check className="h-4 w-4 text-[#1F4E79] dark:text-[#C9A227] shrink-0" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{qt.description}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {qt.suggestedWidgets.slice(0, 3).map((w) => (
                  <span key={w} className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {w.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Domain Filter ── */}
      {queryType && selectedQueryType?.params.includes('domain') && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Filter className="h-3.5 w-3.5" />
            Domaine
          </label>
          <select
            value={domain}
            onChange={(e) => onChange({ domain: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Tous les domaines</option>
            {catalogue.domains.map((d) => (
              <option key={d.code} value={d.code}>{d.labelFr}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── 3. Form selector (for form-based queries) ── */}
      {queryType && needsForm && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Formulaire <span className="text-red-500">*</span>
          </label>
          <select
            value={formId}
            onChange={(e) => onChange({ filters: { ...(config.filters as any || {}), formId: e.target.value } })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Selectionner un formulaire...</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.domain})</option>
            ))}
          </select>
        </div>
      )}

      {/* ── 4. Field (for form_field_distribution) ── */}
      {queryType === 'form_field_distribution' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Champ a analyser <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={field}
            onChange={(e) => onChange({ field: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            placeholder="ex: species, disease_type, status..."
          />
        </div>
      )}

      {/* ── 5. GroupBy ── */}
      {queryType && selectedQueryType && selectedQueryType.groupBy.length > 0 && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Regrouper par
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selectedQueryType.groupBy.map((gb) => {
              const opt = catalogue.groupByOptions.find((o) => o.code === gb) || { code: gb, labelFr: gb };
              return (
                <button
                  key={gb}
                  type="button"
                  onClick={() => onChange({ groupBy: gb })}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    groupBy === gb
                      ? 'bg-[#1F4E79] text-white dark:bg-[#C9A227] dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.labelFr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6. Metric ── */}
      {queryType && queryType !== 'continental_summary' && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Zap className="h-3.5 w-3.5" />
            Metrique
          </label>
          <div className="flex flex-wrap gap-1.5">
            {catalogue.metrics.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => onChange({ metric: m.code })}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  metric === m.code
                    ? 'bg-[#1F4E79] text-white dark:bg-[#C9A227] dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {m.labelFr}
              </button>
            ))}
          </div>
          {metric !== 'count' && queryType !== 'domain_kpis' && (
            <div className="mt-2">
              <input
                type="text"
                value={field}
                onChange={(e) => onChange({ field: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                placeholder="Champ numerique pour sum/avg/min/max..."
              />
            </div>
          )}
        </div>
      )}

      {/* ── 7. Sort + Limit ── */}
      {queryType && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              <ArrowUpDown className="h-3 w-3" />
              Tri
            </label>
            <select
              value={sort}
              onChange={(e) => onChange({ sort: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
            >
              {catalogue.sortOptions.map((s) => (
                <option key={s.code} value={s.code}>{s.labelFr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Limite</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => onChange({ limit: Math.min(500, Math.max(1, parseInt(e.target.value) || 50)) })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
              min={1}
              max={500}
            />
          </div>
        </div>
      )}

      {/* ── 8. Additional Filters ── */}
      {queryType && (
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            <Filter className="h-3 w-3" />
            Filtres additionnels (optionnel)
          </label>
          <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Code pays</label>
                <input
                  type="text"
                  value={((config.filters as any)?.countryCode as string) || ''}
                  onChange={(e) => onChange({ filters: { ...(config.filters as any || {}), countryCode: e.target.value || undefined } })}
                  className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                  placeholder="KE, NG..."
                  maxLength={2}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Annee</label>
                <input
                  type="number"
                  value={((config.filters as any)?.year as number) || ''}
                  onChange={(e) => onChange({ filters: { ...(config.filters as any || {}), year: e.target.value ? parseInt(e.target.value) : undefined } })}
                  className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                  placeholder="2026"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Date debut</label>
                <input
                  type="date"
                  value={((config.filters as any)?.dateFrom as string) || ''}
                  onChange={(e) => onChange({ filters: { ...(config.filters as any || {}), dateFrom: e.target.value || undefined } })}
                  className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Date fin</label>
                <input
                  type="date"
                  value={((config.filters as any)?.dateTo as string) || ''}
                  onChange={(e) => onChange({ filters: { ...(config.filters as any || {}), dateTo: e.target.value || undefined } })}
                  className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {queryType && (
        <div className="rounded-md border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Configuration actuelle :</p>
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
            <p><span className="font-medium">Requete :</span> {selectedQueryType?.labelFr}</p>
            {domain && <p><span className="font-medium">Domaine :</span> {catalogue.domains.find((d) => d.code === domain)?.labelFr || domain}</p>}
            {groupBy && <p><span className="font-medium">Regroupement :</span> {catalogue.groupByOptions.find((o) => o.code === groupBy)?.labelFr || groupBy}</p>}
            <p><span className="font-medium">Metrique :</span> {catalogue.metrics.find((m) => m.code === metric)?.labelFr || metric}</p>
            <p><span className="font-medium">Tri :</span> {catalogue.sortOptions.find((s) => s.code === sort)?.labelFr || sort} | Limite : {limit}</p>
          </div>
        </div>
      )}
    </div>
  );
}
