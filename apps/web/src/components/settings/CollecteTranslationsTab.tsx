'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Loader2,
  Save,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  FileText,
  Megaphone,
  AlertTriangle,
  Filter,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderTemplates, useUpdateFormTemplate, FormTemplateListItem } from '@/lib/api/form-builder-hooks';
import { useCollectionCampaigns, useUpdateCollectionCampaign } from '@/lib/api/workflow-hooks';
import { useTranslateText } from '@/lib/api/translation-hooks';
import { toast } from 'sonner';
import type { MultilingualText, FormField, FormSection } from '@/components/form-builder/utils/form-schema';

/* ──────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────── */

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'fr', name: 'Fran\u00e7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'pt', name: 'Portugu\u00eas', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
  { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
  { code: 'es', name: 'Espa\u00f1ol', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
] as const;

type SubTab = 'forms' | 'campaigns';

/* ──────────────────────────────────────────────────────────────
   Types for flattened translatable rows
   ────────────────────────────────────────────────────────────── */

interface TranslatableRow {
  /** Unique key: e.g. "template:uuid:section:sid:name" or "template:uuid:field:fid:label" */
  key: string;
  /** Display label: e.g. "Section: General Info > field_code (label)" */
  path: string;
  /** The multilingual text object reference */
  values: MultilingualText;
  /** Row type for visual grouping */
  type: 'template-name' | 'section-name' | 'section-desc' | 'field-label' | 'field-placeholder' | 'field-helptext' | 'campaign-name' | 'campaign-desc';
}

interface TranslatableGroup {
  id: string;
  name: string;
  domain: string;
  status: string;
  rows: TranslatableRow[];
}

/* ──────────────────────────────────────────────────────────────
   Helper: get text value from MultilingualText
   ────────────────────────────────────────────────────────────── */

function mlVal(ml: MultilingualText | undefined, lang: string): string {
  return ml?.[lang] ?? '';
}

function mlDisplay(ml: MultilingualText | undefined): string {
  if (!ml) return '—';
  return ml.en || ml.fr || ml.pt || ml.ar || ml.es || '—';
}

/* ──────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────── */

export function CollecteTranslationsTab() {
  const t = useTranslations('settings');
  const [subTab, setSubTab] = useState<SubTab>('forms');

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'forms', label: t('collecteTransForms') !== 'collecteTransForms' ? t('collecteTransForms') : 'Formulaires', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'campaigns', label: t('collecteTransCampaigns') !== 'collecteTransCampaigns' ? t('collecteTransCampaigns') : 'Campagnes', icon: <Megaphone className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {subTabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              subTab === st.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {st.icon}
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'forms' && <FormsSubTab />}
      {subTab === 'campaigns' && <CampaignsSubTab />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sub-tab: Forms (templates + fields)
   ══════════════════════════════════════════════════════════════ */

function FormsSubTab() {
  const t = useTranslations('settings');
  const { data: templatesRes, isLoading } = useFormBuilderTemplates({ limit: 100 });
  const updateTemplate = useUpdateFormTemplate();
  const translateMut = useTranslateText();

  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'complete' | 'missing'>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoTranslating, setAutoTranslating] = useState<string | null>(null);

  // templatesRes from useQuery .data = API response { data: [...], meta: {...} }
  const templates: FormTemplateListItem[] = useMemo(() => {
    if (!templatesRes) return [];
    if (Array.isArray(templatesRes)) return templatesRes;
    if (Array.isArray((templatesRes as any).data)) return (templatesRes as any).data;
    return [];
  }, [templatesRes]);

  // Build translatable groups from templates
  const groups: TranslatableGroup[] = useMemo(() => {
    return templates.map((tpl) => {
      const rows: TranslatableRow[] = [];
      const schema = tpl.schema as { sections?: FormSection[] } | null;
      if (!schema?.sections) return { id: tpl.id, name: tpl.name, domain: tpl.domain, status: tpl.status, rows };

      for (const section of schema.sections) {
        // Section name
        if (section.name) {
          rows.push({
            key: `tpl:${tpl.id}:sec:${section.id}:name`,
            path: `${mlDisplay(section.name)}`,
            values: section.name,
            type: 'section-name',
          });
        }
        // Section description
        if (section.description && Object.values(section.description).some((v) => v)) {
          rows.push({
            key: `tpl:${tpl.id}:sec:${section.id}:desc`,
            path: `${mlDisplay(section.name)} (description)`,
            values: section.description,
            type: 'section-desc',
          });
        }
        // Fields
        for (const field of section.fields ?? []) {
          if (field.label) {
            rows.push({
              key: `tpl:${tpl.id}:fld:${field.id}:label`,
              path: `${field.code} — label`,
              values: field.label,
              type: 'field-label',
            });
          }
          if (field.placeholder && Object.values(field.placeholder).some((v) => v)) {
            rows.push({
              key: `tpl:${tpl.id}:fld:${field.id}:placeholder`,
              path: `${field.code} — placeholder`,
              values: field.placeholder,
              type: 'field-placeholder',
            });
          }
          if (field.helpText && Object.values(field.helpText).some((v) => v)) {
            rows.push({
              key: `tpl:${tpl.id}:fld:${field.id}:helptext`,
              path: `${field.code} — helpText`,
              values: field.helpText,
              type: 'field-helptext',
            });
          }
        }
      }

      return { id: tpl.id, name: tpl.name, domain: tpl.domain, status: tpl.status, rows };
    }).filter((g) => g.rows.length > 0);
  }, [templates]);

  // Domains for filter
  const domains = useMemo(() => {
    const set = new Set(groups.map((g) => g.domain));
    return Array.from(set).sort();
  }, [groups]);

  // Get cell value including pending edits
  const getCellValue = useCallback((row: TranslatableRow, lang: string): string => {
    const editKey = `${row.key}|${lang}`;
    if (editKey in edits) return edits[editKey];
    return mlVal(row.values, lang);
  }, [edits]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    let result = groups;
    if (filterDomain) {
      result = result.filter((g) => g.domain === filterDomain);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.map((g) => {
        // Match on form name → show all rows of that form
        if (g.name.toLowerCase().includes(q) || g.domain.replace(/_/g, ' ').toLowerCase().includes(q)) {
          return g;
        }
        // Otherwise filter rows
        const filtered = g.rows.filter((r) => {
          if (r.path.toLowerCase().includes(q)) return true;
          return LANGUAGES.some((l) => getCellValue(r, l.code).toLowerCase().includes(q));
        });
        return filtered.length > 0 ? { ...g, rows: filtered } : null;
      }).filter(Boolean) as TranslatableGroup[];
    }
    if (filterStatus === 'missing') {
      result = result.map((g) => {
        const filtered = g.rows.filter((r) =>
          LANGUAGES.some((l) => !getCellValue(r, l.code).trim()),
        );
        return filtered.length > 0 ? { ...g, rows: filtered } : null;
      }).filter(Boolean) as TranslatableGroup[];
    } else if (filterStatus === 'complete') {
      result = result.map((g) => {
        const filtered = g.rows.filter((r) =>
          LANGUAGES.every((l) => !!getCellValue(r, l.code).trim()),
        );
        return filtered.length > 0 ? { ...g, rows: filtered } : null;
      }).filter(Boolean) as TranslatableGroup[];
    }
    return result;
  }, [groups, filterDomain, search, filterStatus, getCellValue]);

  // Stats
  const stats = useMemo(() => {
    const allRows = groups.flatMap((g) => g.rows);
    const total = allRows.length;
    const perLang: Record<string, { filled: number; pct: number }> = {};
    for (const lang of LANGUAGES) {
      const filled = allRows.filter((r) => !!getCellValue(r, lang.code).trim()).length;
      perLang[lang.code] = { filled, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
    }
    return { total, perLang };
  }, [groups, getCellValue]);

  const totalRows = useMemo(() => filteredGroups.reduce((s, g) => s + g.rows.length, 0), [filteredGroups]);
  const editCount = Object.keys(edits).length;

  // Toggle group expand
  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Inline edit helpers
  const startEdit = (row: TranslatableRow, lang: string) => {
    const cellId = `${row.key}|${lang}`;
    setEditingCell(cellId);
    setEditBuffer(getCellValue(row, lang));
  };

  const confirmEdit = () => {
    if (!editingCell) return;
    const pipeIdx = editingCell.lastIndexOf('|');
    const key = editingCell.slice(0, pipeIdx);
    const lang = editingCell.slice(pipeIdx + 1);
    // Find the original value
    const originalRow = groups.flatMap((g) => g.rows).find((r) => r.key === key);
    const original = originalRow ? mlVal(originalRow.values, lang) : '';
    if (editBuffer !== original) {
      setEdits((prev) => ({ ...prev, [editingCell]: editBuffer }));
    } else {
      setEdits((prev) => { const next = { ...prev }; delete next[editingCell]; return next; });
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  // Save all edits — rebuild schemas and PATCH each affected template
  const handleSave = async () => {
    if (editCount === 0) return;
    setSaving(true);

    try {
      // Group edits by template ID
      const editsByTemplate: Record<string, Record<string, string>> = {};
      for (const [cellId, value] of Object.entries(edits)) {
        const pipeIdx = cellId.lastIndexOf('|');
        const key = cellId.slice(0, pipeIdx);
        const lang = cellId.slice(pipeIdx + 1);
        // key format: tpl:{tplId}:sec:{secId}:name  or  tpl:{tplId}:fld:{fldId}:label
        const parts = key.split(':');
        const tplId = parts[1];
        if (!editsByTemplate[tplId]) editsByTemplate[tplId] = {};
        editsByTemplate[tplId][`${key}|${lang}`] = value;
      }

      // For each affected template, rebuild schema with edits
      for (const [tplId, tplEdits] of Object.entries(editsByTemplate)) {
        const tpl = templates.find((t) => t.id === tplId);
        if (!tpl) continue;

        const schema = JSON.parse(JSON.stringify(tpl.schema)) as { sections: FormSection[] };

        for (const [cellId, value] of Object.entries(tplEdits)) {
          const pipeIdx = cellId.lastIndexOf('|');
          const key = cellId.slice(0, pipeIdx);
          const lang = cellId.slice(pipeIdx + 1);
          const parts = key.split(':');
          // parts: [tpl, tplId, sec|fld, entityId, prop]
          const entityType = parts[2]; // sec or fld
          const entityId = parts[3];
          const prop = parts[4]; // name, desc, label, placeholder, helptext

          if (entityType === 'sec') {
            const section = schema.sections.find((s) => s.id === entityId);
            if (!section) continue;
            if (prop === 'name') {
              if (!section.name) section.name = {};
              (section.name as Record<string, string>)[lang] = value;
            } else if (prop === 'desc') {
              if (!section.description) section.description = {};
              (section.description as Record<string, string>)[lang] = value;
            }
          } else if (entityType === 'fld') {
            for (const section of schema.sections) {
              const field = section.fields?.find((f) => f.id === entityId);
              if (!field) continue;
              if (prop === 'label') {
                if (!field.label) field.label = {};
                (field.label as Record<string, string>)[lang] = value;
              } else if (prop === 'placeholder') {
                if (!field.placeholder) field.placeholder = {};
                (field.placeholder as Record<string, string>)[lang] = value;
              } else if (prop === 'helptext') {
                if (!field.helpText) field.helpText = {};
                (field.helpText as Record<string, string>)[lang] = value;
              }
              break;
            }
          }
        }

        await updateTemplate.mutateAsync({ id: tplId, schema });
      }

      setEdits({});
      toast.success(t('collecteTransSaved') !== 'collecteTransSaved' ? t('collecteTransSaved') : 'Traductions sauvegardées');
    } catch (err: any) {
      toast.error('Erreur', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // Auto-translate missing for a group
  const handleAutoTranslate = async (group: TranslatableGroup) => {
    setAutoTranslating(group.id);
    try {
      let newEdits: Record<string, string> = {};
      // For each row, find missing languages and translate from English
      for (const row of group.rows) {
        const sourceText = getCellValue(row, 'en');
        if (!sourceText.trim()) continue;

        for (const lang of LANGUAGES) {
          if (lang.code === 'en') continue;
          const existing = getCellValue(row, lang.code);
          if (existing.trim()) continue;

          try {
            const res = await translateMut.mutateAsync({
              source: 'en',
              target: lang.code,
              input: sourceText,
            });
            const translated = res?.data?.outputs?.[0]?.output;
            if (translated) {
              newEdits[`${row.key}|${lang.code}`] = translated;
            }
          } catch {
            // Skip failed translations
          }
        }
      }

      if (Object.keys(newEdits).length > 0) {
        setEdits((prev) => ({ ...prev, ...newEdits }));
        toast.success(`${Object.keys(newEdits).length} traductions générées`);
      } else {
        toast.info('Aucune traduction manquante');
      }
    } catch (err: any) {
      toast.error('Erreur de traduction', { description: err?.message });
    } finally {
      setAutoTranslating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LANGUAGES.map((lang) => {
          const s = stats.perLang[lang.code];
          return (
            <div key={lang.code} className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900/50">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{lang.flag}</span>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{lang.name}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-xl font-bold text-gray-900 dark:text-white">{s?.pct ?? 0}%</span>
                <span className="text-[9px] text-gray-400 mb-0.5">{s?.filled ?? 0}/{stats.total}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    (s?.pct ?? 0) === 100 ? 'bg-green-500' : (s?.pct ?? 0) >= 80 ? 'bg-blue-500' : (s?.pct ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500',
                  )}
                  style={{ width: `${s?.pct ?? 0}%` }}
                />
              </div>
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
            placeholder={t('collecteTransSearch') !== 'collecteTransSearch' ? t('collecteTransSearch') : 'Rechercher un champ, label...'}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <option value="">{t('allDomains') !== 'allDomains' ? t('allDomains') : 'Tous les domaines'}</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
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
              {status === '' ? (t('all') !== 'all' ? t('all') : 'Tous') : status === 'complete' ? (t('translationComplete') !== 'translationComplete' ? t('translationComplete') : 'Complets') : (t('translationMissing') !== 'translationMissing' ? t('translationMissing') : 'Manquants')}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400">
          {totalRows} champs &middot; {filteredGroups.length} formulaires
        </span>

        {/* Save bar */}
        {editCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Pencil className="h-2.5 w-2.5" />
              {editCount} modification{editCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-aris-primary-600 px-3 py-1 text-[10px] font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button
              onClick={() => setEdits({})}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Groups (templates) */}
      <div className="space-y-2">
        {filteredGroups.map((group) => (
          <div key={group.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50 overflow-hidden">
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-center gap-2">
                {expandedGroups.has(group.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <FileText className="h-4 w-4 text-aris-primary-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.name}</span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-medium',
                  group.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                )}>
                  {group.status}
                </span>
                <span className="text-[10px] text-gray-400">{group.domain.replace(/_/g, ' ')}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {group.rows.length} champs
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Per-group completion badges */}
                <div className="flex gap-1">
                  {LANGUAGES.map((lang) => {
                    const filled = group.rows.filter((r) => !!getCellValue(r, lang.code).trim()).length;
                    const pct = group.rows.length > 0 ? Math.round((filled / group.rows.length) * 100) : 0;
                    return (
                      <span
                        key={lang.code}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold',
                          pct === 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : pct >= 80 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        )}
                      >
                        {lang.code.toUpperCase()} {pct}%
                      </span>
                    );
                  })}
                </div>
              </div>
            </button>

            {expandedGroups.has(group.id) && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                {/* Auto-translate button */}
                <div className="flex items-center justify-end px-4 py-2 border-b border-gray-50 dark:border-gray-800">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAutoTranslate(group); }}
                    disabled={autoTranslating === group.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {autoTranslating === group.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Traduire les vides
                  </button>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 w-[22%]">Champ</th>
                        {LANGUAGES.map((lang) => (
                          <th key={lang.code} className="px-2 py-2 text-left font-medium text-gray-500">
                            {lang.flag} {lang.code.toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {group.rows.map((row) => (
                        <tr key={row.key} className={cn(
                          'group hover:bg-gray-50/50 dark:hover:bg-gray-800/30',
                          row.type === 'section-name' && 'bg-aris-primary-50/30 dark:bg-aris-primary-900/5',
                        )}>
                          <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                              {row.type === 'section-name' && <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-400" />}
                              {row.type === 'section-desc' && <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-200" />}
                              {(row.type === 'field-label' || row.type === 'field-placeholder' || row.type === 'field-helptext') && (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 ml-2" />
                              )}
                              <span className={cn(
                                'truncate',
                                row.type === 'section-name' && 'font-semibold text-aris-primary-700 dark:text-aris-primary-400',
                              )}>
                                {row.path}
                              </span>
                            </div>
                          </td>
                          {LANGUAGES.map((lang) => {
                            const cellId = `${row.key}|${lang.code}`;
                            const val = getCellValue(row, lang.code);
                            const filled = !!val.trim();
                            const isEditing = editingCell === cellId;
                            const isEdited = cellId in edits;

                            if (isEditing) {
                              return (
                                <td key={lang.code} className="px-1 py-0.5">
                                  <div className="flex items-center gap-0.5">
                                    <input
                                      value={editBuffer}
                                      onChange={(e) => setEditBuffer(e.target.value)}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={confirmEdit}
                                      autoFocus
                                      dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                                      className="flex-1 rounded border border-aris-primary-400 bg-white px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-aris-primary-600 dark:bg-gray-800 dark:text-white"
                                    />
                                    <button onMouseDown={(e) => { e.preventDefault(); confirmEdit(); }} className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={lang.code}
                                onClick={() => startEdit(row, lang.code)}
                                className={cn(
                                  'px-2 py-1.5 max-w-[180px] truncate cursor-pointer rounded-sm transition-colors',
                                  'hover:bg-aris-primary-50/50 dark:hover:bg-aris-primary-900/10',
                                  isEdited
                                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/15 dark:text-amber-300'
                                    : filled
                                      ? 'text-gray-700 dark:text-gray-300'
                                      : 'text-red-400 italic',
                                )}
                                title={filled ? `${val}\nCliquer pour modifier` : 'Cliquer pour ajouter'}
                              >
                                <span className="flex items-center gap-1">
                                  {filled ? val : '\u2014'}
                                  {isEdited && <Pencil className="inline h-2 w-2 shrink-0 text-amber-500" />}
                                  {!isEditing && !isEdited && (
                                    <Pencil className="invisible inline h-2 w-2 shrink-0 text-gray-300 group-hover:visible" />
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="text-sm">Aucun formulaire trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sub-tab: Campaigns
   ══════════════════════════════════════════════════════════════ */

function CampaignsSubTab() {
  const t = useTranslations('settings');
  const { data: campaignsRes, isLoading, error } = useCollectionCampaigns({ limit: 100 });
  const updateCampaign = useUpdateCollectionCampaign();
  const translateMut = useTranslateText();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'complete' | 'missing'>('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoTranslating, setAutoTranslating] = useState(false);

  // campaignsRes = useQuery .data = raw API response { data: [...], meta: {...} }
  const campaigns: any[] = useMemo(() => {
    if (!campaignsRes) return [];
    if (Array.isArray(campaignsRes)) return campaignsRes;
    if (Array.isArray((campaignsRes as any).data)) return (campaignsRes as any).data;
    return [];
  }, [campaignsRes]);

  // Build translatable rows from campaigns
  const rows = useMemo(() => {
    const result: { campaign: any; fields: { key: string; label: string; values: MultilingualText; prop: 'name' | 'description' }[] }[] = [];

    for (const c of campaigns) {
      const fields: { key: string; label: string; values: MultilingualText; prop: 'name' | 'description' }[] = [];

      // Campaign name (JSON multilingual)
      const nameObj = typeof c.name === 'object' && c.name !== null ? c.name : { en: String(c.name ?? '') };
      fields.push({
        key: `camp:${c.id}:name`,
        label: 'Nom',
        values: nameObj,
        prop: 'name',
      });

      // Campaign description
      if (c.description) {
        const descObj = typeof c.description === 'object' && c.description !== null ? c.description : { en: String(c.description ?? '') };
        fields.push({
          key: `camp:${c.id}:desc`,
          label: 'Description',
          values: descObj,
          prop: 'description',
        });
      }

      result.push({ campaign: c, fields });
    }

    return result;
  }, [campaigns]);

  const editCount = Object.keys(edits).length;

  const getCellValue = useCallback((key: string, values: MultilingualText, lang: string): string => {
    const editKey = `${key}|${lang}`;
    if (editKey in edits) return edits[editKey];
    return mlVal(values, lang);
  }, [edits]);

  // Filter
  const filteredRows = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.fields.some((f) =>
          LANGUAGES.some((l) => getCellValue(f.key, f.values, l.code).toLowerCase().includes(q)) ||
          f.label.toLowerCase().includes(q),
        ) || mlDisplay(r.campaign.name).toLowerCase().includes(q),
      );
    }
    if (filterStatus === 'missing') {
      result = result.filter((r) =>
        r.fields.some((f) => LANGUAGES.some((l) => !getCellValue(f.key, f.values, l.code).trim())),
      );
    } else if (filterStatus === 'complete') {
      result = result.filter((r) =>
        r.fields.every((f) => LANGUAGES.every((l) => !!getCellValue(f.key, f.values, l.code).trim())),
      );
    }
    return result;
  }, [rows, search, filterStatus, getCellValue]);

  // Stats
  const stats = useMemo(() => {
    const allFields = rows.flatMap((r) => r.fields);
    const total = allFields.length;
    const perLang: Record<string, { filled: number; pct: number }> = {};
    for (const lang of LANGUAGES) {
      const filled = allFields.filter((f) => !!getCellValue(f.key, f.values, lang.code).trim()).length;
      perLang[lang.code] = { filled, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
    }
    return { total, perLang };
  }, [rows, getCellValue]);

  const startEdit = (key: string, values: MultilingualText, lang: string) => {
    const cellId = `${key}|${lang}`;
    setEditingCell(cellId);
    setEditBuffer(getCellValue(key, values, lang));
  };

  const confirmEdit = () => {
    if (!editingCell) return;
    const pipeIdx = editingCell.lastIndexOf('|');
    const key = editingCell.slice(0, pipeIdx);
    const lang = editingCell.slice(pipeIdx + 1);
    const field = rows.flatMap((r) => r.fields).find((f) => f.key === key);
    const original = field ? mlVal(field.values, lang) : '';
    if (editBuffer !== original) {
      setEdits((prev) => ({ ...prev, [editingCell]: editBuffer }));
    } else {
      setEdits((prev) => { const next = { ...prev }; delete next[editingCell]; return next; });
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  // Save
  const handleSave = async () => {
    if (editCount === 0) return;
    setSaving(true);

    try {
      // Group edits by campaign
      const editsByCampaign: Record<string, Record<string, string>> = {};
      for (const [cellId, value] of Object.entries(edits)) {
        const pipeIdx = cellId.lastIndexOf('|');
        const key = cellId.slice(0, pipeIdx);
        const lang = cellId.slice(pipeIdx + 1);
        const parts = key.split(':');
        const campId = parts[1];
        if (!editsByCampaign[campId]) editsByCampaign[campId] = {};
        editsByCampaign[campId][`${key}|${lang}`] = value;
      }

      for (const [campId, campEdits] of Object.entries(editsByCampaign)) {
        const campRow = rows.find((r) => r.campaign.id === campId);
        if (!campRow) continue;

        // Build updated name/description
        const nameField = campRow.fields.find((f) => f.prop === 'name');
        const descField = campRow.fields.find((f) => f.prop === 'description');
        const updatedName = nameField ? { ...nameField.values } : {};
        const updatedDesc = descField ? { ...descField.values } : {};

        for (const [cellId, value] of Object.entries(campEdits)) {
          const pipeIdx = cellId.lastIndexOf('|');
          const key = cellId.slice(0, pipeIdx);
          const lang = cellId.slice(pipeIdx + 1);
          const prop = key.split(':')[2]; // name or desc
          if (prop === 'name') (updatedName as Record<string, string>)[lang] = value;
          else if (prop === 'desc') (updatedDesc as Record<string, string>)[lang] = value;
        }

        const payload: any = { id: campId, name: updatedName };
        if (descField) payload.description = updatedDesc;
        await updateCampaign.mutateAsync(payload);
      }

      setEdits({});
      toast.success('Traductions des campagnes sauvegardées');
    } catch (err: any) {
      toast.error('Erreur', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // Auto-translate all missing
  const handleAutoTranslateAll = async () => {
    setAutoTranslating(true);
    try {
      let newEdits: Record<string, string> = {};
      for (const r of rows) {
        for (const field of r.fields) {
          const sourceText = getCellValue(field.key, field.values, 'en');
          if (!sourceText.trim()) continue;
          for (const lang of LANGUAGES) {
            if (lang.code === 'en') continue;
            const existing = getCellValue(field.key, field.values, lang.code);
            if (existing.trim()) continue;
            try {
              const res = await translateMut.mutateAsync({ source: 'en', target: lang.code, input: sourceText });
              const translated = res?.data?.outputs?.[0]?.output;
              if (translated) newEdits[`${field.key}|${lang.code}`] = translated;
            } catch { /* skip */ }
          }
        }
      }
      if (Object.keys(newEdits).length > 0) {
        setEdits((prev) => ({ ...prev, ...newEdits }));
        toast.success(`${Object.keys(newEdits).length} traductions générées`);
      } else {
        toast.info('Aucune traduction manquante');
      }
    } catch (err: any) {
      toast.error('Erreur', { description: err?.message });
    } finally {
      setAutoTranslating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span>Erreur de chargement des campagnes: {(error as Error)?.message || 'Erreur inconnue'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LANGUAGES.map((lang) => {
          const s = stats.perLang[lang.code];
          return (
            <div key={lang.code} className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900/50">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{lang.flag}</span>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{lang.name}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-xl font-bold text-gray-900 dark:text-white">{s?.pct ?? 0}%</span>
                <span className="text-[9px] text-gray-400 mb-0.5">{s?.filled ?? 0}/{stats.total}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    (s?.pct ?? 0) === 100 ? 'bg-green-500' : (s?.pct ?? 0) >= 80 ? 'bg-blue-500' : (s?.pct ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500',
                  )}
                  style={{ width: `${s?.pct ?? 0}%` }}
                />
              </div>
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
            placeholder="Rechercher une campagne..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

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
              {status === '' ? 'Tous' : status === 'complete' ? 'Complets' : 'Manquants'}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400">{filteredRows.length} campagne{filteredRows.length > 1 ? 's' : ''}</span>

        {/* Auto-translate all */}
        <button
          onClick={handleAutoTranslateAll}
          disabled={autoTranslating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {autoTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Traduire les vides
        </button>

        {/* Save bar */}
        {editCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Pencil className="h-2.5 w-2.5" />
              {editCount} modification{editCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-aris-primary-600 px-3 py-1 text-[10px] font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button
              onClick={() => setEdits({})}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Campaigns table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-[14%]">Campagne</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-[8%]">Champ</th>
                {LANGUAGES.map((lang) => (
                  <th key={lang.code} className="px-2 py-2 text-left font-medium text-gray-500">
                    {lang.flag} {lang.code.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredRows.map((r) =>
                r.fields.map((field, idx) => (
                  <tr key={field.key} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    {idx === 0 && (
                      <td className="px-4 py-1.5 text-gray-900 dark:text-white font-medium align-top" rowSpan={r.fields.length}>
                        <div className="flex items-center gap-1.5">
                          <Megaphone className="h-3.5 w-3.5 text-aris-primary-500 shrink-0" />
                          <span className="truncate">{mlDisplay(r.campaign.name)}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-medium',
                            r.campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : r.campaign.status === 'PLANNED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                          )}>
                            {r.campaign.status}
                          </span>
                          <span className="text-[9px] text-gray-400">{r.campaign.domain?.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                      {field.label}
                    </td>
                    {LANGUAGES.map((lang) => {
                      const cellId = `${field.key}|${lang.code}`;
                      const val = getCellValue(field.key, field.values, lang.code);
                      const filled = !!val.trim();
                      const isEditing = editingCell === cellId;
                      const isEdited = cellId in edits;

                      if (isEditing) {
                        return (
                          <td key={lang.code} className="px-1 py-0.5">
                            <div className="flex items-center gap-0.5">
                              <input
                                value={editBuffer}
                                onChange={(e) => setEditBuffer(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                onBlur={confirmEdit}
                                autoFocus
                                dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                                className="flex-1 rounded border border-aris-primary-400 bg-white px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-aris-primary-600 dark:bg-gray-800 dark:text-white"
                              />
                              <button onMouseDown={(e) => { e.preventDefault(); confirmEdit(); }} className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                                <Check className="h-3 w-3" />
                              </button>
                              <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={lang.code}
                          onClick={() => startEdit(field.key, field.values, lang.code)}
                          className={cn(
                            'px-2 py-1.5 max-w-[180px] truncate cursor-pointer rounded-sm transition-colors',
                            'hover:bg-aris-primary-50/50 dark:hover:bg-aris-primary-900/10',
                            isEdited
                              ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/15 dark:text-amber-300'
                              : filled
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-red-400 italic',
                          )}
                          title={filled ? `${val}\nCliquer pour modifier` : 'Cliquer pour ajouter'}
                        >
                          <span className="flex items-center gap-1">
                            {filled ? val : '\u2014'}
                            {isEdited && <Pencil className="inline h-2 w-2 shrink-0 text-amber-500" />}
                            {!isEditing && !isEdited && (
                              <Pencil className="invisible inline h-2 w-2 shrink-0 text-gray-300 group-hover:visible" />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="text-sm">Aucune campagne trouvée</p>
          </div>
        )}
      </div>
    </div>
  );
}
