'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Languages,
  Settings2,
  BookOpen,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wand2,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSystranStatus, useTranslateText } from '@/lib/api/translation-hooks';
import { SaveBar } from '@/components/settings/SaveBar';
import { toast } from 'sonner';

// Import message files for the reference browser
import enMessages from '@/messages/en.json';
import frMessages from '@/messages/fr.json';
import ptMessages from '@/messages/pt.json';
import arMessages from '@/messages/ar.json';
import esMessages from '@/messages/es.json';

const ALL_MESSAGES: Record<string, Record<string, unknown>> = {
  en: enMessages,
  fr: frMessages,
  pt: ptMessages,
  ar: arMessages,
  es: esMessages,
};

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'fr', name: 'Fran\u00e7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'pt', name: 'Portugu\u00eas', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
  { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
  { code: 'es', name: 'Espa\u00f1ol', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
] as const;

type TabId = 'config' | 'references' | 'review';

/* ──────────────────────────────────────────────────────────────
   Flatten nested JSON messages into flat key→value maps
   ────────────────────────────────────────────────────────────── */

function flattenMessages(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

/* ──────────────────────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────────────────────── */

export default function TranslationsPage() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<TabId>('config');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'config', label: t('systranConfig'), icon: <Settings2 className="h-4 w-4" /> },
    { id: 'references', label: t('i18nReferences'), icon: <BookOpen className="h-4 w-4" /> },
    { id: 'review', label: t('translationReview'), icon: <Languages className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aris-primary-500 to-aris-primary-700 text-white shadow-sm">
          <Languages className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('translationsTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('translationsDesc')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-aris-primary-500 text-aris-primary-600 dark:text-aris-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'references' && <ReferencesTab />}
      {activeTab === 'review' && <ReviewTab />}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tab 1: Systran API Configuration
   ────────────────────────────────────────────────────────────── */

function ConfigTab() {
  const t = useTranslations('settings');
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('systran');
  const { data, isLoading } = useSettingsConfig('systran');
  const bulkMutation = useBulkUpdateConfig();
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useSystranStatus();
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState(false);

  const configs: { key: string; value: unknown }[] = data?.data ?? [];

  const getValue = (configKey: string): string => {
    const ck = `systran:${configKey}`;
    if (ck in changes) return changes[ck];
    const found = configs.find((c) => c.key === `systran.${configKey}`);
    return (found?.value as string) ?? '';
  };

  const handleChange = (key: string, value: string) => {
    setChanges((prev) => ({ ...prev, [`systran:${key}`]: value }));
  };

  const handleSave = async () => {
    const list = Object.entries(changes).map(([ck, value]) => {
      const parts = ck.split(':');
      return { category: parts[0], key: `systran.${parts[1]}`, value };
    });
    try {
      await bulkMutation.mutateAsync(list);
      setChanges({});
      toast.success(t('systranConfigSaved'));
    } catch (err: any) {
      toast.error(t('systranConfigError'), { description: err?.message });
    }
  };

  const connected = statusData?.data?.connected === true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Connection Status */}
      <div className={cn(
        'rounded-xl border p-4',
        connected
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10',
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : connected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {connected ? t('systranConnected') : t('systranDisconnected')}
              </p>
              {statusData?.data?.apiUrl && (
                <p className="text-xs text-gray-500">{statusData.data.apiUrl}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => refetchStatus()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', statusLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* API URL */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
          {t('systranApiSettings')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('systranApiUrl')}
            </label>
            <input
              type="url"
              value={getValue('apiUrl') || changes['systran:apiUrl'] || ''}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
              placeholder="https://api-translate.systran.net"
              disabled={!canEdit}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              {t('systranApiUrlHint')}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('systranApiKey')}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={getValue('apiKey') || changes['systran:apiKey'] || ''}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!canEdit}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              {t('systranApiKeyHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Supported Languages Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          {t('targetLanguages')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <span
              key={lang.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <span>{lang.flag}</span>
              {lang.name}
              <span className="font-mono text-gray-400">{lang.code.toUpperCase()}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-400">
          {t('targetLanguagesHint')}
        </p>
      </div>

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tab 2: i18n Reference Browser
   ────────────────────────────────────────────────────────────── */

function ReferencesTab() {
  const t = useTranslations('settings');
  const [search, setSearch] = useState('');
  const [filterNamespace, setFilterNamespace] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'complete' | 'missing'>('');
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set());

  // Build flat maps for each language
  const flatMaps = useMemo(() => {
    const maps: Record<string, Record<string, string>> = {};
    for (const [lang, msgs] of Object.entries(ALL_MESSAGES)) {
      maps[lang] = flattenMessages(msgs as Record<string, unknown>);
    }
    return maps;
  }, []);

  // Extract all unique keys from English (reference language)
  const allKeys = useMemo(() => Object.keys(flatMaps['en'] ?? {}).sort(), [flatMaps]);

  // Get namespaces (top-level keys)
  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    for (const key of allKeys) {
      const dot = key.indexOf('.');
      if (dot > 0) ns.add(key.slice(0, dot));
    }
    return Array.from(ns).sort();
  }, [allKeys]);

  // Filter keys
  const filteredKeys = useMemo(() => {
    let keys = allKeys;

    if (filterNamespace) {
      keys = keys.filter((k) => k.startsWith(filterNamespace + '.'));
    }

    if (search) {
      const q = search.toLowerCase();
      keys = keys.filter((k) => {
        if (k.toLowerCase().includes(q)) return true;
        // Also search in values
        for (const lang of Object.keys(flatMaps)) {
          if (flatMaps[lang][k]?.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    if (filterStatus === 'missing') {
      keys = keys.filter((k) =>
        LANGUAGES.some((l) => !flatMaps[l.code]?.[k]?.trim()),
      );
    } else if (filterStatus === 'complete') {
      keys = keys.filter((k) =>
        LANGUAGES.every((l) => !!flatMaps[l.code]?.[k]?.trim()),
      );
    }

    return keys;
  }, [allKeys, filterNamespace, search, filterStatus, flatMaps]);

  // Completion stats
  const stats = useMemo(() => {
    const total = allKeys.length;
    const perLang: Record<string, { filled: number; missing: number; pct: number }> = {};
    for (const lang of LANGUAGES) {
      const filled = allKeys.filter((k) => !!flatMaps[lang.code]?.[k]?.trim()).length;
      perLang[lang.code] = {
        filled,
        missing: total - filled,
        pct: total > 0 ? Math.round((filled / total) * 100) : 0,
      };
    }
    return { total, perLang };
  }, [allKeys, flatMaps]);

  const toggleNs = (ns: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  // Group keys by namespace for display
  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const key of filteredKeys) {
      const dot = key.indexOf('.');
      const ns = dot > 0 ? key.slice(0, dot) : '_root';
      if (!groups[ns]) groups[ns] = [];
      groups[ns].push(key);
    }
    return groups;
  }, [filteredKeys]);

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LANGUAGES.map((lang) => {
          const s = stats.perLang[lang.code];
          return (
            <div
              key={lang.code}
              className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{lang.flag}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {lang.name}
                </span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{s?.pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    (s?.pct ?? 0) === 100
                      ? 'bg-green-500'
                      : (s?.pct ?? 0) >= 80
                        ? 'bg-blue-500'
                        : (s?.pct ?? 0) >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                  )}
                  style={{ width: `${s?.pct ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                {s?.filled}/{stats.total} {t('keysTranslated')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchTranslationKeys')}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select
          value={filterNamespace}
          onChange={(e) => setFilterNamespace(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <option value="">{t('allNamespaces')}</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {(['', 'complete', 'missing'] as const).map((status) => (
            <button
              key={status || 'all'}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filterStatus === status
                  ? status === 'complete'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : status === 'missing'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-aris-primary-100 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              )}
            >
              {status === '' ? t('all') : status === 'complete' ? t('translationComplete') : t('translationMissing')}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400">
          {filteredKeys.length} / {allKeys.length} {t('keys')}
        </span>
      </div>

      {/* Keys browser - grouped by namespace */}
      <div className="space-y-2">
        {Object.entries(groupedKeys).map(([ns, keys]) => (
          <div
            key={ns}
            className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50 overflow-hidden"
          >
            <button
              onClick={() => toggleNs(ns)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-center gap-2">
                {expandedNs.has(ns) ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{ns}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {keys.length}
                </span>
              </div>
              <div className="flex gap-1">
                {LANGUAGES.map((lang) => {
                  const filled = keys.filter((k) => !!flatMaps[lang.code]?.[k]?.trim()).length;
                  const pct = keys.length > 0 ? Math.round((filled / keys.length) * 100) : 0;
                  return (
                    <span
                      key={lang.code}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold',
                        pct === 100
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : pct >= 80
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}
                      title={`${lang.name}: ${pct}%`}
                    >
                      {lang.code.toUpperCase()} {pct}%
                    </span>
                  );
                })}
              </div>
            </button>

            {expandedNs.has(ns) && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 w-1/4">
                          {t('key')}
                        </th>
                        {LANGUAGES.map((lang) => (
                          <th key={lang.code} className="px-2 py-2 text-left font-medium text-gray-500">
                            {lang.flag} {lang.code.toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {keys.slice(0, 100).map((key) => {
                        const shortKey = key.slice(ns.length + 1);
                        return (
                          <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-1.5 font-mono text-gray-600 dark:text-gray-400 break-all">
                              {shortKey}
                            </td>
                            {LANGUAGES.map((lang) => {
                              const val = flatMaps[lang.code]?.[key];
                              const filled = !!val?.trim();
                              return (
                                <td
                                  key={lang.code}
                                  className={cn(
                                    'px-2 py-1.5 max-w-[200px] truncate',
                                    filled
                                      ? 'text-gray-700 dark:text-gray-300'
                                      : 'text-red-400 italic',
                                  )}
                                  title={val || t('translationMissing')}
                                >
                                  {filled ? val : '\u2014'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {keys.length > 100 && (
                    <p className="px-4 py-2 text-[10px] text-gray-400 text-center">
                      {t('showingFirst100', { total: String(keys.length) })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tab 3: Translation Review
   ────────────────────────────────────────────────────────────── */

function ReviewTab() {
  const t = useTranslations('settings');
  const translateMut = useTranslateText();
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [batchSource, setBatchSource] = useState('en');
  const [batchTarget, setBatchTarget] = useState('fr');
  const [batchResults, setBatchResults] = useState<{ key: string; source: string; translated: string }[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Build flat maps
  const flatMaps = useMemo(() => {
    const maps: Record<string, Record<string, string>> = {};
    for (const [lang, msgs] of Object.entries(ALL_MESSAGES)) {
      maps[lang] = flattenMessages(msgs as Record<string, unknown>);
    }
    return maps;
  }, []);

  // Quick translate single text
  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    try {
      const res = await translateMut.mutateAsync({
        source: sourceLang,
        target: targetLang,
        input: inputText,
      });
      setOutputText(res?.data?.outputs?.[0]?.output ?? '');
    } catch (err: any) {
      toast.error(t('translationError'), { description: err?.message });
    }
  };

  // Batch translate missing keys
  const handleBatchTranslate = async () => {
    const sourceMap = flatMaps[batchSource] ?? {};
    const targetMap = flatMaps[batchTarget] ?? {};

    // Find keys that exist in source but missing in target
    const missingKeys = Object.keys(sourceMap).filter(
      (k) => !!sourceMap[k]?.trim() && !targetMap[k]?.trim(),
    );

    if (missingKeys.length === 0) {
      toast.info(t('noMissingTranslations'));
      return;
    }

    // Limit to 50 at a time
    const batch = missingKeys.slice(0, 50);
    setBatchLoading(true);
    setBatchResults([]);

    try {
      const results: { key: string; source: string; translated: string }[] = [];

      // Translate in chunks of 10
      for (let i = 0; i < batch.length; i += 10) {
        const chunk = batch.slice(i, i + 10);
        const texts = chunk.map((k) => sourceMap[k]);
        const res = await translateMut.mutateAsync({
          source: batchSource,
          target: batchTarget,
          input: texts,
        });
        const outputs = res?.data?.outputs ?? [];
        chunk.forEach((key, idx) => {
          results.push({
            key,
            source: sourceMap[key],
            translated: outputs[idx]?.output ?? '',
          });
        });
      }

      setBatchResults(results);
      toast.success(t('batchTranslateComplete', { count: String(results.length) }));
    } catch (err: any) {
      toast.error(t('translationError'), { description: err?.message });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleEditResult = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(batchResults[idx].translated);
  };

  const handleSaveEdit = (idx: number) => {
    setBatchResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], translated: editValue };
      return next;
    });
    setEditingIdx(null);
  };

  const handleExportResults = () => {
    if (batchResults.length === 0) return;
    // Build JSON object with the translated values
    const obj: Record<string, string> = {};
    for (const r of batchResults) {
      obj[r.key] = r.translated;
    }
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations_${batchTarget}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Quick translate */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Wand2 className="h-4 w-4 text-aris-primary-500" />
          {t('quickTranslate')}
        </h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">{t('sourceLanguage')}</span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              placeholder={t('enterTextToTranslate')}
              dir={sourceLang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {LANGUAGES.filter((l) => l.code !== sourceLang).map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">{t('targetLanguage')}</span>
            </div>
            <textarea
              value={outputText}
              onChange={(e) => setOutputText(e.target.value)}
              rows={4}
              placeholder={t('translationResult')}
              dir={targetLang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <button
            onClick={handleTranslate}
            disabled={!inputText.trim() || translateMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {translateMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {t('translate')}
          </button>
        </div>
      </div>

      {/* Batch translate missing translations */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Languages className="h-4 w-4 text-aris-primary-500" />
          {t('batchTranslate')}
        </h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {t('batchTranslateDesc')}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('sourceLanguage')}
            </label>
            <select
              value={batchSource}
              onChange={(e) => setBatchSource(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('targetLanguage')}
            </label>
            <select
              value={batchTarget}
              onChange={(e) => setBatchTarget(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {LANGUAGES.filter((l) => l.code !== batchSource).map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleBatchTranslate}
            disabled={batchLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {batchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {t('translateMissing')}
          </button>
        </div>

        {/* Batch results */}
        {batchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('batchResults', { count: String(batchResults.length) })}
              </span>
              <button
                onClick={handleExportResults}
                className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Save className="h-3 w-3" />
                {t('exportJson')}
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-1/4">{t('key')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-5/16">{t('sourceText')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-5/16">{t('translatedText')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500 w-1/16">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {batchResults.map((r, idx) => (
                    <tr key={r.key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2 font-mono text-gray-500 break-all">{r.key}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.source}</td>
                      <td className="px-3 py-2">
                        {editingIdx === idx ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 rounded border border-aris-primary-300 px-2 py-0.5 text-xs dark:border-aris-primary-700 dark:bg-gray-800 dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(idx)}
                              className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingIdx(null)}
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300">{r.translated}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editingIdx !== idx && (
                          <button
                            onClick={() => handleEditResult(idx)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                            title={t('edit')}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
